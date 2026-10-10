import { existsSync, readFileSync } from 'node:fs';
import type { MarketsFile } from './types';

/**
 * Reads the markets file produced by `npm run fetch:markets` at build time.
 * MARKETS_JSON points at another file (tests use a fixture). Returns null when there is no file yet.
 */
export function loadMarkets(path = process.env.MARKETS_JSON ?? 'public/data/v1/markets.json'): MarketsFile | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as MarketsFile;
}
