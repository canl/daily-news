import { existsSync, readFileSync } from 'node:fs';
import type { SummaryFile } from './types';

/**
 * Reads the summary file produced by `npm run fetch:summary` at build time.
 * SUMMARY_JSON points at another file (tests use a fixture). Returns null when there is no file yet.
 */
export function loadSummary(path = process.env.SUMMARY_JSON ?? 'public/data/v1/summary.json'): SummaryFile | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as SummaryFile;
}
