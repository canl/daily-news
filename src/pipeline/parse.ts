import { XMLParser } from 'fast-xml-parser';
import { decodeEntities, toPlainText } from './normalize';

/** One entry as the feed gave it, before tagging and dedupe. */
export interface RawItem {
  title: string;
  url: string;
  /** ISO 8601, UTC; empty when the feed gave no usable date. */
  publishedAt: string;
  description: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  removeNSPrefix: true,
  processEntities: false,
  htmlEntities: false,
  trimValues: true,
});

const asArray = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object' && '#text' in value) return text((value as Record<string, unknown>)['#text']);
  return '';
}

function isoDate(value: string): string {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString();
}

function atomLink(links: unknown): string {
  const all = asArray(links as Record<string, string> | Record<string, string>[]);
  const alternate = all.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? all[0];
  return alternate?.['@_href'] ?? '';
}

/** Parses RSS 2.0, RSS 1.0 (RDF) and Atom. Throws on input that is not a feed. */
export function parseFeed(xml: string): RawItem[] {
  const doc = parser.parse(xml) as Record<string, any>;

  if (doc.rss?.channel || doc.RDF) {
    const items = doc.rss ? asArray(doc.rss.channel.item) : asArray(doc.RDF.item);
    return items.map((item: Record<string, unknown>) => ({
      title: toPlainText(text(item.title)),
      url: decodeEntities(text(item.link).trim() || text(item.guid).trim()),
      publishedAt: isoDate(text(item.pubDate) || text(item.date)),
      description: text(item.description) || text(item.encoded),
    }));
  }

  if (doc.feed) {
    return asArray(doc.feed.entry).map((entry: Record<string, unknown>) => ({
      title: toPlainText(text(entry.title)),
      url: decodeEntities(atomLink(entry.link)),
      publishedAt: isoDate(text(entry.published) || text(entry.updated)),
      description: text(entry.summary) || text(entry.content),
    }));
  }

  throw new Error('Not an RSS or Atom feed');
}
