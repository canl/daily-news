import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateNewsFile } from '../src/lib/validate';
import type { FeedConfig } from '../src/pipeline/feeds';
import { FEEDS } from '../src/pipeline/feeds';
import { buildNews } from '../src/pipeline/news';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('news.json contract', () => {
  it('a built file passes validation', async () => {
    const feeds: FeedConfig[] = ['rss2', 'atom', 'rdf'].map((name) => ({
      source: name,
      url: `https://feeds.test/${name}`,
      topic: 'ai',
      region: 'global',
    }));
    const { file } = await buildNews(feeds, (url) => Promise.resolve(fixture(`${url.split('/').pop()}.xml`)), new Date('2026-10-10T12:00:00Z'));
    expect(file.stories.length).toBeGreaterThan(0);
    expect(validateNewsFile(file)).toEqual([]);
  });

  it('reports a broken file', () => {
    const errors = validateNewsFile({
      schemaVersion: 1,
      generatedAt: 'nope',
      stories: [
        { id: 'x', title: ' ', url: 'ftp://a', source: '', topic: 'sport' as never, region: 'mars' as never, publishedAt: '2026-10-09T00:00:00Z', snippet: 'a'.repeat(241), alsoReportedBy: [] },
        { id: 'x', title: 'b', url: 'https://b', source: 'b', topic: 'ai', region: 'global', publishedAt: '2026-10-10T00:00:00Z', snippet: '', alsoReportedBy: [] },
      ],
    });
    expect(errors).toEqual(expect.arrayContaining([
      'generatedAt must be an ISO date',
      'stories[0].id is not a 12-char hex id',
      'stories[1].id x is duplicated',
      'stories[0].title is empty',
      'stories[0].url is not http(s)',
      'stories[0].topic sport is unknown',
      'stories[0].region mars is unknown',
      'stories[0].snippet is over 240 characters',
      'stories must be newest first',
    ]));
  });
});

describe('feed config', () => {
  it('has at least 10 feeds covering both topics, all https', () => {
    expect(FEEDS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(FEEDS.map((f) => f.topic))).toEqual(new Set(['finance', 'ai']));
    expect(FEEDS.every((f) => f.url.startsWith('https://'))).toBe(true);
    expect(new Set(FEEDS.map((f) => f.url)).size).toBe(FEEDS.length);
  });
});
