import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFeed } from '../src/pipeline/parse';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('parseFeed', () => {
  it('reads RSS 2.0 items, CDATA and entities', () => {
    const items = parseFeed(fixture('rss2.xml'));
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({
      title: 'Fed holds rates steady as inflation cools',
      url: 'https://example.com/fed-holds?utm=a&b=c',
      publishedAt: '2026-10-10T09:30:00.000Z',
      description: '<p>The US central bank kept its key rate at <b>4.25%</b> &amp; signalled patience.</p>',
    });
    expect(items[1]!.title).toBe('Oil prices rise on supply worries – analysts');
    expect(items[3]!.publishedAt).toBe('');
  });

  it('reads Atom entries and picks the alternate link', () => {
    const items = parseFeed(fixture('atom.xml'));
    expect(items).toHaveLength(2);
    expect(items[0]!.url).toBe('https://example.org/model');
    expect(items[0]!.publishedAt).toBe('2026-10-10T10:15:00.000Z');
    expect(items[1]!.publishedAt).toBe('2026-10-10T11:00:00.000Z');
    expect(items[1]!.description).toBe('Same Fed story from a second outlet.');
  });

  it('reads RSS 1.0 (RDF) items with dc:date', () => {
    const [item] = parseFeed(fixture('rdf.xml'));
    expect(item).toMatchObject({ title: 'Asian shares edge higher', publishedAt: '2026-10-10T03:00:00.000Z' });
  });

  it('handles a feed with a single item', () => {
    const xml = '<rss><channel><item><title>Only one</title><link>https://x.test/1</link><pubDate>2026-10-10T00:00:00Z</pubDate></item></channel></rss>';
    expect(parseFeed(xml)).toHaveLength(1);
  });

  it('throws on something that is not a feed', () => {
    expect(() => parseFeed('<html><body>Service unavailable</body></html>')).toThrow('Not an RSS or Atom feed');
  });
});
