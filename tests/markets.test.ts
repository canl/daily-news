import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateMarketsFile } from '../src/lib/validate';
import { INSTRUMENTS, type InstrumentConfig } from '../src/pipeline/instruments';
import { buildMarkets, MAX_CLOSES, parseStooq, parseYahoo, stooqUrl, toInstrument, yahooUrl, type FetchText } from '../src/pipeline/markets';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const now = new Date('2026-10-10T18:00:00Z');

const spx: InstrumentConfig = { symbol: '^GSPC', stooq: '^spx', name: 'S&P 500', group: 'indices', currency: 'USD', decimals: 2 };
const eur: InstrumentConfig = { symbol: 'EURUSD=X', stooq: 'eurusd', name: 'EUR/USD', group: 'fx', currency: 'USD', decimals: 4 };
const noFallback: InstrumentConfig = { symbol: 'XYZ', name: 'No fallback', group: 'ai-stocks', currency: 'USD', decimals: 2 };

describe('parseYahoo', () => {
  it('reads one close per session, skipping gaps and the repeated live bar', () => {
    expect(parseYahoo(fixture('yahoo-chart.json'))).toEqual({
      closes: [6500, 6550.25, 6612.5],
      last: 6612.5,
      asOf: '2026-10-09T20:00:00.000Z',
      previousClose: 6550.25,
    });
  });

  it('gives a real daily change when Yahoo repeats the last session', () => {
    const m = toInstrument(spx, parseYahoo(fixture('yahoo-chart.json')));
    expect(m).toMatchObject({ change: 62.25, changePct: 0.95 });
  });

  it('throws with Yahoo’s own message for an unknown symbol', () => {
    expect(() => parseYahoo(fixture('yahoo-error.json'))).toThrow('No data found');
  });
});

describe('parseStooq', () => {
  it('reads daily closes from CSV', () => {
    expect(parseStooq(fixture('stooq.csv'))).toEqual({
      closes: [1.092, 1.095, 1.098],
      last: 1.098,
      asOf: '2026-10-09T00:00:00.000Z',
    });
  });

  it('throws on Stooq’s "No data" reply', () => {
    expect(() => parseStooq('No data')).toThrow('Not a Stooq price CSV');
  });
});

describe('toInstrument', () => {
  it('computes the change against the previous close when the last close is today’s price', () => {
    const m = toInstrument(spx, { closes: [6500, 6550.25, 6600, 6612.5], last: 6612.5, asOf: '2026-10-10T16:00:00.000Z' });
    expect(m).toMatchObject({ last: 6612.5, change: 12.5, changePct: 0.19 });
  });

  it('computes the change against the last close when the live price has moved on', () => {
    const m = toInstrument(spx, { closes: [6500, 6600], last: 6534, asOf: '2026-10-10T16:00:00.000Z' });
    expect(m).toMatchObject({ change: -66, changePct: -1 });
  });

  it('keeps at most 30 closes', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    expect(toInstrument(spx, { closes, last: 159, asOf: now.toISOString() }).closes).toHaveLength(MAX_CLOSES);
  });
});

describe('buildMarkets', () => {
  const routes = (map: Record<string, () => string>): FetchText => (url) => {
    const hit = map[url];
    return hit ? Promise.resolve(hit()) : Promise.reject(new Error('HTTP 404'));
  };

  it('uses Yahoo first, Stooq as fallback, and reports what failed', async () => {
    const { file, failures, fallbacks } = await buildMarkets(
      [spx, eur, noFallback],
      routes({
        [yahooUrl('^GSPC')]: () => fixture('yahoo-chart.json'),
        [yahooUrl('EURUSD=X')]: () => fixture('yahoo-error.json'),
        [stooqUrl('eurusd')]: () => fixture('stooq.csv'),
      }),
      now,
    );
    expect(file.instruments.map((m) => m.symbol)).toEqual(['^GSPC', 'EURUSD=X']);
    expect(file.instruments.every((m) => m.change !== 0)).toBe(true);
    expect(fallbacks).toEqual(['EURUSD=X']);
    expect(failures).toEqual([{ symbol: 'XYZ', name: 'No fallback', error: 'HTTP 404' }]);
    expect(validateMarketsFile(file)).toEqual([]);
  });

  it('names both sources when both fail', async () => {
    const { failures } = await buildMarkets([eur], routes({}), now);
    expect(failures[0]!.error).toBe('Yahoo: HTTP 404; Stooq: HTTP 404');
  });
});

describe('instrument config', () => {
  it('lists 25 instruments with unique symbols in all five groups', () => {
    expect(INSTRUMENTS).toHaveLength(25);
    expect(new Set(INSTRUMENTS.map((i) => i.symbol)).size).toBe(25);
    expect(new Set(INSTRUMENTS.map((i) => i.group))).toEqual(new Set(['indices', 'ai-stocks', 'fx', 'commodities-rates', 'crypto']));
  });
});

describe('validateMarketsFile', () => {
  it('reports a broken file', () => {
    const errors = validateMarketsFile({
      schemaVersion: 1,
      generatedAt: now.toISOString(),
      instruments: [
        { symbol: 'A', name: '', group: 'bonds' as never, last: 0, change: NaN, changePct: 1, currency: 'USD', asOf: 'x', closes: [1] },
      ],
    });
    expect(errors).toEqual(expect.arrayContaining([
      'instruments[0].name is empty',
      'instruments[0].group bonds is unknown',
      'instruments[0].change must be a number',
      'instruments[0].last must be positive',
      'instruments[0].asOf must be an ISO date',
      'instruments[0].closes must hold 2 to 30 numbers',
    ]));
  });
});
