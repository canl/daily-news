/** Regenerates tests/fixtures/markets.sample.json: deterministic prices for every configured instrument. */
import { writeFile } from 'node:fs/promises';
import { INSTRUMENTS } from '../src/pipeline/instruments';
import { buildMarkets, yahooUrl } from '../src/pipeline/markets';

const now = new Date('2026-10-10T18:00:00Z');
const bases: Record<string, number> = { 'EURUSD=X': 1.09, 'JPY=X': 148.2, 'GBPUSD=X': 1.31, 'CNY=X': 7.12, '^TNX': 4.1, 'BTC-USD': 98000, 'ETH-USD': 3600 };

const fetcher = async (url: string) => {
  const index = INSTRUMENTS.findIndex((i) => url === yahooUrl(i.symbol));
  if (index < 0) throw new Error(`unexpected ${url}`);
  const config = INSTRUMENTS[index]!;
  const base = bases[config.symbol] ?? 100 * (index + 3);
  // Alternate up and down days so the sample has both directions.
  const drift = index % 3 === 0 ? -1 : 1;
  const closes = Array.from({ length: 30 }, (_, d) => base * (1 + drift * 0.002 * d + 0.01 * Math.sin(d + index)));
  const t0 = Date.parse('2026-09-11T20:00:00Z') / 1000;
  return JSON.stringify({
    chart: {
      result: [{
        meta: { regularMarketPrice: closes.at(-1), regularMarketTime: Date.parse('2026-10-10T16:00:00Z') / 1000 },
        timestamp: closes.map((_, d) => t0 + d * 86400),
        indicators: { quote: [{ close: closes }] },
      }],
    },
  });
};

const { file } = await buildMarkets(INSTRUMENTS, fetcher, now);
await writeFile('tests/fixtures/markets.sample.json', `${JSON.stringify(file, null, 1)}\n`);
console.log(`Wrote ${file.instruments.length} instruments`);
