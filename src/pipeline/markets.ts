import { SCHEMA_VERSION, type Instrument, type MarketsFile } from '../lib/types';
import type { InstrumentConfig } from './instruments';

export const MAX_CLOSES = 30;
const FETCH_TIMEOUT_MS = 15_000;

/** What a source gives us for one instrument: daily closes oldest first, plus the latest price. */
export interface Quote {
  closes: number[];
  last: number;
  /** ISO 8601 time of the last price. */
  asOf: string;
  /** Close of the session before the one the last price belongs to, when the source can tell. */
  previousClose?: number;
}

export type FetchText = (url: string) => Promise<string>;

export const fetchText: FetchText = async (url) => {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; DailyNewsBot/1.0; +https://canl.github.io/daily-news/)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

export const yahooUrl = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;

export const stooqUrl = (symbol: string) => `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;

/** Parses Yahoo's chart JSON. Throws when it holds no usable prices. */
export function parseYahoo(body: string): Quote {
  const json = JSON.parse(body);
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description ?? 'No chart result');
  const offset = Number(result.meta?.gmtoffset ?? 0);
  const sessionDay = (seconds: number) => new Date((seconds + offset) * 1000).toISOString().slice(0, 10);
  const timestamps: number[] = result.timestamp ?? [];
  const raw: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  // One close per session day: Yahoo can repeat the live session as an extra bar.
  const byDay = new Map<string, number>();
  raw.forEach((close, i) => {
    const t = timestamps[i];
    if (typeof close === 'number' && Number.isFinite(close) && typeof t === 'number') byDay.set(sessionDay(t), close);
  });
  const days = [...byDay.keys()].sort();
  const closes = days.map((d) => byDay.get(d)!);

  const last = Number(result.meta?.regularMarketPrice ?? closes.at(-1));
  const time = Number(result.meta?.regularMarketTime ?? timestamps.at(-1));
  if (closes.length < 2 || !Number.isFinite(last) || !Number.isFinite(time)) throw new Error('Not enough price history');

  const today = sessionDay(time);
  const before = days.filter((d) => d < today);
  const previousClose = before.length > 0 ? byDay.get(before.at(-1)!) : undefined;
  return { closes, last, asOf: new Date(time * 1000).toISOString(), previousClose };
}

/** Parses Stooq's daily CSV (Date,Open,High,Low,Close,Volume). Throws when it holds no usable prices. */
export function parseStooq(body: string): Quote {
  const lines = body.trim().split(/\r?\n/);
  const header = lines[0]?.toLowerCase().split(',') ?? [];
  const dateCol = header.indexOf('date');
  const closeCol = header.indexOf('close');
  if (dateCol < 0 || closeCol < 0) throw new Error('Not a Stooq price CSV');
  const rows = lines
    .slice(1)
    .map((line) => line.split(','))
    .map((cols) => ({ date: cols[dateCol] ?? '', close: Number(cols[closeCol]) }))
    .filter((r) => r.date && Number.isFinite(r.close));
  if (rows.length < 2) throw new Error('Not enough price history');
  const lastRow = rows.at(-1)!;
  return { closes: rows.map((r) => r.close), last: lastRow.close, asOf: new Date(`${lastRow.date}T00:00:00Z`).toISOString() };
}

const round = (n: number, places: number) => Number(n.toFixed(places));

/** Daily change against the previous close. */
export function toInstrument(config: InstrumentConfig, quote: Quote): Instrument {
  const closes = quote.closes.slice(-MAX_CLOSES);
  // Without a previous close from the source: when the latest close already equals the live price,
  // the previous session is one further back.
  const prev = quote.previousClose ?? (closes.at(-1) === quote.last ? closes.at(-2)! : closes.at(-1)!);
  const change = quote.last - prev;
  const places = Math.max(config.decimals, 2) + 2;
  return {
    symbol: config.symbol,
    name: config.name,
    group: config.group,
    last: round(quote.last, places),
    change: round(change, places),
    changePct: round((change / prev) * 100, 2),
    currency: config.currency,
    asOf: quote.asOf,
    closes: closes.map((c) => round(c, places)),
  };
}

export interface MarketFailure {
  symbol: string;
  name: string;
  error: string;
}

export interface BuildMarketsResult {
  file: MarketsFile;
  failures: MarketFailure[];
  /** Instruments that came from the fallback source. */
  fallbacks: string[];
}

async function quoteFor(config: InstrumentConfig, fetcher: FetchText): Promise<{ quote: Quote; fallback: boolean }> {
  try {
    return { quote: parseYahoo(await fetcher(yahooUrl(config.symbol))), fallback: false };
  } catch (primary) {
    if (!config.stooq) throw primary;
    try {
      return { quote: parseStooq(await fetcher(stooqUrl(config.stooq))), fallback: true };
    } catch (secondary) {
      throw new Error(`Yahoo: ${(primary as Error).message}; Stooq: ${(secondary as Error).message}`);
    }
  }
}

/** Fetches every instrument in parallel; an instrument that fails both sources is reported and left out. */
export async function buildMarkets(
  instruments: InstrumentConfig[],
  fetcher: FetchText = fetchText,
  now: Date = new Date(),
): Promise<BuildMarketsResult> {
  const results = await Promise.allSettled(instruments.map((config) => quoteFor(config, fetcher)));
  const out: Instrument[] = [];
  const failures: MarketFailure[] = [];
  const fallbacks: string[] = [];
  results.forEach((result, i) => {
    const config = instruments[i]!;
    if (result.status === 'fulfilled') {
      out.push(toInstrument(config, result.value.quote));
      if (result.value.fallback) fallbacks.push(config.symbol);
    } else {
      failures.push({ symbol: config.symbol, name: config.name, error: String(result.reason?.message ?? result.reason) });
    }
  });
  return { file: { schemaVersion: SCHEMA_VERSION, generatedAt: now.toISOString(), instruments: out }, failures, fallbacks };
}
