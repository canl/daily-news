import { SCHEMA_VERSION, type NewsFile, type Story } from '../lib/types';
import { dedupe } from './dedupe';
import type { FeedConfig } from './feeds';
import { storyId, toPlainText, truncate } from './normalize';
import { parseFeed } from './parse';

export const WINDOW_HOURS = 48;
export const MAX_STORIES = 400;
const FETCH_TIMEOUT_MS = 15_000;

export type FetchText = (url: string) => Promise<string>;

export const fetchText: FetchText = async (url) => {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'DailyNewsBot/1.0 (+https://canl.github.io/daily-news/)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

export interface FeedFailure {
  source: string;
  url: string;
  error: string;
}

export interface FeedStats {
  source: string;
  url: string;
  /** Items the feed returned. */
  parsed: number;
  /** Items kept: valid and inside the time window. */
  kept: number;
}

export interface BuildNewsResult {
  file: NewsFile;
  failures: FeedFailure[];
  stats: FeedStats[];
}

function toStories(feed: FeedConfig, xml: string, now: Date): { parsed: number; stories: Story[] } {
  const oldest = now.getTime() - WINDOW_HOURS * 3_600_000;
  const newest = now.getTime() + 10 * 60_000; // tolerate small clock skew
  const items = parseFeed(xml);
  const stories = items
    .filter((item) => item.title && /^https?:\/\//.test(item.url) && item.publishedAt)
    .filter((item) => {
      const t = Date.parse(item.publishedAt);
      return t >= oldest && t <= newest;
    })
    .map((item) => ({
      id: storyId(item.title),
      title: item.title,
      url: item.url,
      source: feed.source,
      topic: feed.topic,
      region: feed.region,
      publishedAt: item.publishedAt,
      snippet: truncate(toPlainText(item.description)),
      alsoReportedBy: [],
    }));
  return { parsed: items.length, stories };
}

/** Fetches every feed in parallel; a feed that fails is reported and skipped. */
export async function buildNews(
  feeds: FeedConfig[],
  fetcher: FetchText = fetchText,
  now: Date = new Date(),
): Promise<BuildNewsResult> {
  const results = await Promise.allSettled(feeds.map(async (feed) => toStories(feed, await fetcher(feed.url), now)));

  const failures: FeedFailure[] = [];
  const stats: FeedStats[] = [];
  const stories: Story[] = [];
  results.forEach((result, i) => {
    const feed = feeds[i]!;
    if (result.status === 'fulfilled') {
      stories.push(...result.value.stories);
      stats.push({ source: feed.source, url: feed.url, parsed: result.value.parsed, kept: result.value.stories.length });
    } else failures.push({ source: feed.source, url: feed.url, error: String(result.reason?.message ?? result.reason) });
  });

  const merged = dedupe(stories)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_STORIES);

  return {
    file: { schemaVersion: SCHEMA_VERSION, generatedAt: now.toISOString(), stories: merged },
    failures,
    stats,
  };
}
