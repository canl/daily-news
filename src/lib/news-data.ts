import { existsSync, readFileSync } from 'node:fs';
import type { NewsFile } from './types';

/**
 * Reads the news file produced by `npm run fetch:news` at build time.
 * NEWS_JSON points at another file (tests use a fixture). Returns null when there is no file yet.
 */
export function loadNews(path = process.env.NEWS_JSON ?? 'public/data/v1/news.json'): NewsFile | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as NewsFile;
}
