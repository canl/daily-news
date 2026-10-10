import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../src/lib/types';
import { dedupe, similarity } from '../src/pipeline/dedupe';
import type { FeedConfig } from '../src/pipeline/feeds';
import { buildNews, type FetchText } from '../src/pipeline/news';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const now = new Date('2026-10-10T12:00:00Z');

const feeds: FeedConfig[] = [
  { source: 'Example Business', url: 'https://feeds.test/rss2', topic: 'finance', region: 'europe' },
  { source: 'Example AI', url: 'https://feeds.test/atom', topic: 'ai', region: 'americas' },
  { source: 'Example Asia', url: 'https://feeds.test/rdf', topic: 'finance', region: 'asia-pacific' },
];

const stub =
  (overrides: Record<string, () => Promise<string>> = {}): FetchText =>
  (url) => {
    if (overrides[url]) return overrides[url]!();
    const name = url.split('/').pop();
    return Promise.resolve(fixture(`${name}.xml`));
  };

describe('buildNews', () => {
  it('builds a news file newest first, inside the 48 hour window', async () => {
    const { file, failures } = await buildNews(feeds, stub(), now);
    expect(failures).toEqual([]);
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(file.generatedAt).toBe(now.toISOString());
    expect(file.stories.map((s) => s.title)).toEqual([
      'New open model tops coding benchmark',
      'Fed holds rates steady as inflation cools',
      'Oil prices rise on supply worries – analysts',
      'Asian shares edge higher',
    ]);
  });

  it('tags stories from their feed and writes a clean snippet', async () => {
    const { file } = await buildNews(feeds, stub(), now);
    const fed = file.stories.find((s) => s.title.startsWith('Fed'))!;
    expect(fed).toMatchObject({
      source: 'Example Business',
      topic: 'finance',
      region: 'europe',
      snippet: 'The US central bank kept its key rate at 4.25% & signalled patience.',
    });
  });

  it('merges the same story from two outlets and credits both', async () => {
    const { file } = await buildNews(feeds, stub(), now);
    const fed = file.stories.filter((s) => s.title.toLowerCase().includes('fed holds'));
    expect(fed).toHaveLength(1);
    expect(fed[0]!.alsoReportedBy).toEqual(['Example AI']);
  });

  it('skips a feed that errors or returns junk and keeps the rest', async () => {
    const { file, failures } = await buildNews(
      feeds,
      stub({
        'https://feeds.test/atom': () => Promise.reject(new Error('HTTP 500')),
        'https://feeds.test/rdf': () => Promise.resolve('<html>Bad gateway</html>'),
      }),
      now,
    );
    expect(failures.map((f) => [f.source, f.error])).toEqual([
      ['Example AI', 'HTTP 500'],
      ['Example Asia', 'Not an RSS or Atom feed'],
    ]);
    expect(file.stories).toHaveLength(2);
  });

  it('returns no stories and every failure when all feeds are down', async () => {
    const down = () => Promise.reject(new Error('timeout'));
    const { file, failures } = await buildNews(
      feeds,
      stub(Object.fromEntries(feeds.map((f) => [f.url, down]))),
      now,
    );
    expect(file.stories).toEqual([]);
    expect(failures).toHaveLength(3);
  });
});

describe('dedupe', () => {
  const base = {
    url: 'https://x.test',
    topic: 'finance' as const,
    region: 'global' as const,
    snippet: '',
    alsoReportedBy: [],
  };

  it('scores near-identical headlines as similar and different ones as not', () => {
    expect(similarity('Nvidia shares hit record high', 'Nvidia shares hit a record high')).toBeGreaterThanOrEqual(0.75);
    expect(similarity('Nvidia shares hit record high', 'Oil falls as demand slows')).toBeLessThan(0.2);
  });

  it('keeps the earliest report and does not credit the same publisher twice', () => {
    const out = dedupe([
      { ...base, id: 'b', title: 'Nvidia shares hit a record high', source: 'B', publishedAt: '2026-10-10T10:00:00Z' },
      { ...base, id: 'a', title: 'Nvidia shares hit record high', source: 'A', publishedAt: '2026-10-10T09:00:00Z' },
      { ...base, id: 'a2', title: 'Nvidia shares hit record high!', source: 'A', publishedAt: '2026-10-10T11:00:00Z' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: 'A', alsoReportedBy: ['B'] });
  });
});

describe('feed stats', () => {
  it('reports parsed and kept counts per feed', async () => {
    const { stats } = await buildNews(feeds, stub(), now);
    expect(stats.map(({ sample: _sample, ...rest }) => rest)).toEqual([
      { source: 'Example Business', url: 'https://feeds.test/rss2', parsed: 4, kept: 2, dropped: { noTitle: 0, noUrl: 0, noDate: 1, outsideWindow: 1 } },
      { source: 'Example AI', url: 'https://feeds.test/atom', parsed: 2, kept: 2, dropped: { noTitle: 0, noUrl: 0, noDate: 0, outsideWindow: 0 } },
      { source: 'Example Asia', url: 'https://feeds.test/rdf', parsed: 1, kept: 1, dropped: { noTitle: 0, noUrl: 0, noDate: 0, outsideWindow: 0 } },
    ]);
    expect(stats[0]!.sample?.title).toBe('Fed holds rates steady as inflation cools');
  });
});
