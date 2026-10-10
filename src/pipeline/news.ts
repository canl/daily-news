import { SCHEMA_VERSION, type NewsFile, type Story } from '../lib/types';
import { dedupe } from './dedupe';
import type { FeedConfig } from './feeds';
import { storyId, toPlainText, truncate } from './normalize';
import { parseFeed, type RawItem } from './parse';

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
  /** Why the other items were dropped. */
  dropped: { noTitle: number; noUrl: number; noDate: number; outsideWindow: number };
  /** The first item as parsed, to help diagnose a feed that keeps nothing. */
  sample?: RawItem;
}

export interface BuildNewsResult {
  file: NewsFile;
  failures: FeedFailure[];
  stats: FeedStats[];
}

function toStories(
  feed: FeedConfig,
  xml: string,
  now: Date,
): { parsed: number; stories: Story[]; dropped: FeedStats['dropped']; sample?: RawItem } {
  const oldest = now.getTime() - WINDOW_HOURS * 3_600_000;
  const newest = now.getTime() + 10 * 60_000; // tolerate small clock skew
  const items = parseFeed(xml);
  const dropped = { noTitle: 0, noUrl: 0, noDate: 0, outsideWindow: 0 };
  const stories = items
    .filter((item) => {
      if (!item.title) dropped.noTitle++;
      else if (!/^https?:\/\//.test(item.url)) dropped.noUrl++;
      else if (!item.publishedAt) dropped.noDate++;
      else {
        const t = Date.parse(item.publishedAt);
        if (t >= oldest && t <= newest) return true;
        dropped.outsideWindow++;
      }
      return false;
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
  return { parsed: items.length, stories, dropped, sample: items[0] };
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
      const { parsed, stories: kept, dropped, sample } = result.value;
      stats.push({ source: feed.source, url: feed.url, parsed, kept: kept.length, dropped, sample });
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
