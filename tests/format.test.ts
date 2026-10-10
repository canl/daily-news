import { describe, expect, it } from 'vitest';
import { direction, formatAsOf, formatChange, formatPrice } from '../src/lib/format';
import type { Instrument } from '../src/lib/types';

const make = (symbol: string, last: number, change: number, changePct: number): Instrument => ({
  symbol, name: symbol, group: 'indices', last, change, changePct, currency: 'USD', asOf: '2026-10-10T16:00:00Z', closes: [1, 2],
});

describe('format', () => {
  it('formats prices with the instrument’s decimals', () => {
    expect(formatPrice(make('^GSPC', 6612.5, 12.5, 0.19))).toBe('6,612.50');
    expect(formatPrice(make('EURUSD=X', 1.098, 0.003, 0.27))).toBe('1.0980');
    expect(formatPrice(make('BTC-USD', 98765.43, 1, 0))).toBe('98,765');
    expect(formatPrice(make('^TNX', 4.125, 0.03, 0.73))).toBe('4.125%');
  });

  it('formats changes with a sign and percent, and yields in basis points', () => {
    expect(formatChange(make('^GSPC', 6612.5, 12.5, 0.19))).toBe('+12.50 (+0.19%)');
    expect(formatChange(make('^GSPC', 6534, -66, -1))).toBe('−66.00 (−1.00%)');
    expect(formatChange(make('^TNX', 4.125, -0.03, -0.72))).toBe('−3.0 bp');
  });

  it('reports direction and a UTC time', () => {
    expect(direction(make('A', 1, 0.1, 1))).toBe('up');
    expect(direction(make('A', 1, -0.1, -1))).toBe('down');
    expect(direction(make('A', 1, 0, 0))).toBe('flat');
    expect(formatAsOf('2026-10-10T16:00:00Z')).toBe('Oct 10, 16:00 UTC');
  });
});
