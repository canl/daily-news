import type { Region, Topic } from '../lib/types';

export interface FeedConfig {
  /** Publisher name shown on story cards. */
  source: string;
  url: string;
  topic: Topic;
  region: Region;
}

/**
 * Free public RSS/Atom feeds. Add or remove a publisher here; nothing else needs to change.
 * A feed that fails to load is skipped for that build and logged as a warning.
 */
export const FEEDS: FeedConfig[] = [
  { source: 'BBC News', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', topic: 'finance', region: 'europe' },
  { source: 'The Guardian', url: 'https://www.theguardian.com/business/rss', topic: 'finance', region: 'europe' },
  { source: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', topic: 'finance', region: 'americas' },
  { source: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', topic: 'finance', region: 'americas' },
  { source: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', topic: 'finance', region: 'americas' },
  { source: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss/feed/nar', topic: 'finance', region: 'asia-pacific' },
  { source: 'South China Morning Post', url: 'https://www.scmp.com/rss/92/feed', topic: 'finance', region: 'asia-pacific' },
  { source: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', topic: 'finance', region: 'middle-east' },
  { source: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', topic: 'ai', region: 'americas' },
  { source: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', topic: 'ai', region: 'americas' },
  { source: 'MIT Technology Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', topic: 'ai', region: 'global' },
  { source: 'Ars Technica', url: 'https://arstechnica.com/ai/feed/', topic: 'ai', region: 'americas' },
  { source: 'The Guardian', url: 'https://www.theguardian.com/technology/artificialintelligence/rss', topic: 'ai', region: 'europe' },
  { source: 'VentureBeat', url: 'https://venturebeat.com/category/ai/feed/', topic: 'ai', region: 'americas' },
];
