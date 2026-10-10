/**
 * Data contracts for the JSON files published under /data/v1/.
 * The site renders from these, and the future mobile app will read the same files.
 * A breaking change means a new /data/v2/ path, never an edit here.
 */

export const SCHEMA_VERSION = 1;

export type Topic = 'finance' | 'ai';
export type Region = 'global' | 'americas' | 'europe' | 'asia-pacific' | 'middle-east';

export interface Story {
  /** Short hash of the normalized headline; also the dedupe key. */
  id: string;
  title: string;
  url: string;
  source: string;
  topic: Topic;
  region: Region;
  /** ISO 8601, UTC. */
  publishedAt: string;
  /** Up to 240 characters of the feed's own description. */
  snippet: string;
  /** Other publishers that ran the same story. */
  alsoReportedBy: string[];
}

interface DataFile {
  schemaVersion: typeof SCHEMA_VERSION;
  /** ISO 8601, UTC. */
  generatedAt: string;
}

export interface NewsFile extends DataFile {
  stories: Story[];
}

export interface SummaryBullet {
  /** What happened, from the cited stories. */
  text: string;
  /** Ids of the stories this bullet draws on; never empty. */
  storyIds: string[];
  /** Finance only: why it matters. Claude's analysis, not reporting. */
  why?: string;
  /** Finance only: the likely effect on markets, citing the day's actual moves where relevant. Claude's analysis. */
  impact?: string;
}

export interface SummaryFile extends DataFile {
  /** Empty when no summary could be written for that topic; the site then hides it. */
  finance: SummaryBullet[];
  ai: SummaryBullet[];
  /** The model that wrote the bullets. */
  model: string;
  /** Hash of the headlines the bullets were written from; unchanged headlines skip a new summary. */
  basedOn: string;
}

export type InstrumentGroup = 'indices' | 'ai-stocks' | 'fx' | 'commodities-rates' | 'crypto';

export interface Instrument {
  symbol: string;
  name: string;
  group: InstrumentGroup;
  last: number;
  change: number;
  changePct: number;
  currency: string;
  /** ISO 8601 time of the last price. */
  asOf: string;
  /** Up to 30 daily closes, oldest first. */
  closes: number[];
}

export interface MarketsFile extends DataFile {
  instruments: Instrument[];
}
