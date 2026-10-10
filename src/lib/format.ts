import { INSTRUMENTS } from '../pipeline/instruments';
import type { Instrument } from './types';

const configFor = (symbol: string) => INSTRUMENTS.find((i) => i.symbol === symbol);

function decimals(m: Instrument): number {
  return configFor(m.symbol)?.decimals ?? 2;
}

const number = (value: number, places: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });

/** "6,612.50", "1.0980", "4.125%" */
export function formatPrice(m: Instrument): string {
  const text = number(m.last, decimals(m));
  return configFor(m.symbol)?.isYield ? `${text}%` : text;
}

/** "+12.50 (+0.19%)"; yields move in basis points: "+3.0 bp". */
export function formatChange(m: Instrument): string {
  const sign = m.change > 0 ? '+' : m.change < 0 ? '−' : '';
  if (configFor(m.symbol)?.isYield) return `${sign}${number(Math.abs(m.change) * 100, 1)} bp`;
  return `${sign}${number(Math.abs(m.change), decimals(m))} (${sign}${number(Math.abs(m.changePct), 2)}%)`;
}

export function direction(m: Instrument): 'up' | 'down' | 'flat' {
  return m.change > 0 ? 'up' : m.change < 0 ? 'down' : 'flat';
}

/** "Oct 10, 16:00 UTC" */
export function formatAsOf(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${date}, ${time} UTC`;
}
