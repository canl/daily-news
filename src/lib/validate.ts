import { SCHEMA_VERSION, type MarketsFile, type NewsFile, type SummaryFile } from './types';

const TOPICS = new Set(['finance', 'ai']);
const REGIONS = new Set(['global', 'americas', 'europe', 'asia-pacific', 'middle-east']);
const isIso = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Returns a list of contract violations; empty means the file is valid. */
export function validateNewsFile(file: NewsFile): string[] {
  const errors: string[] = [];
  if (file.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (!isIso(file.generatedAt)) errors.push('generatedAt must be an ISO date');
  const ids = new Set<string>();
  file.stories.forEach((s, i) => {
    const at = `stories[${i}]`;
    if (!/^[0-9a-f]{12}$/.test(s.id)) errors.push(`${at}.id is not a 12-char hex id`);
    if (ids.has(s.id)) errors.push(`${at}.id ${s.id} is duplicated`);
    ids.add(s.id);
    if (!s.title.trim()) errors.push(`${at}.title is empty`);
    if (!/^https?:\/\//.test(s.url)) errors.push(`${at}.url is not http(s)`);
    if (!s.source.trim()) errors.push(`${at}.source is empty`);
    if (!TOPICS.has(s.topic)) errors.push(`${at}.topic ${s.topic} is unknown`);
    if (!REGIONS.has(s.region)) errors.push(`${at}.region ${s.region} is unknown`);
    if (!isIso(s.publishedAt)) errors.push(`${at}.publishedAt must be an ISO date`);
    if (s.snippet.length > 240) errors.push(`${at}.snippet is over 240 characters`);
    if (!Array.isArray(s.alsoReportedBy)) errors.push(`${at}.alsoReportedBy must be an array`);
  });
  for (let i = 1; i < file.stories.length; i++) {
    if (file.stories[i - 1]!.publishedAt < file.stories[i]!.publishedAt) {
      errors.push('stories must be newest first');
      break;
    }
  }
  return errors;
}

const GROUPS = new Set(['indices', 'ai-stocks', 'fx', 'commodities-rates', 'crypto']);

/** Returns a list of contract violations; empty means the file is valid. */
export function validateMarketsFile(file: MarketsFile): string[] {
  const errors: string[] = [];
  if (file.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (!isIso(file.generatedAt)) errors.push('generatedAt must be an ISO date');
  const symbols = new Set<string>();
  file.instruments.forEach((m, i) => {
    const at = `instruments[${i}]`;
    if (!m.symbol) errors.push(`${at}.symbol is empty`);
    if (symbols.has(m.symbol)) errors.push(`${at}.symbol ${m.symbol} is duplicated`);
    symbols.add(m.symbol);
    if (!m.name) errors.push(`${at}.name is empty`);
    if (!GROUPS.has(m.group)) errors.push(`${at}.group ${m.group} is unknown`);
    for (const key of ['last', 'change', 'changePct'] as const) {
      if (!Number.isFinite(m[key])) errors.push(`${at}.${key} must be a number`);
    }
    if (!(m.last > 0)) errors.push(`${at}.last must be positive`);
    if (!isIso(m.asOf)) errors.push(`${at}.asOf must be an ISO date`);
    if (m.closes.length < 2 || m.closes.length > 30 || !m.closes.every(Number.isFinite)) {
      errors.push(`${at}.closes must hold 2 to 30 numbers`);
    }
  });
  return errors;
}

/**
 * Returns a list of contract violations; empty means the file is valid.
 * With `news`, every cited story id must also exist in that news file.
 */
export function validateSummaryFile(file: SummaryFile, news?: NewsFile): string[] {
  const errors: string[] = [];
  if (file.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (!isIso(file.generatedAt)) errors.push('generatedAt must be an ISO date');
  if (!file.model) errors.push('model is empty');
  if (!file.basedOn) errors.push('basedOn is empty');
  const known = news ? new Set(news.stories.map((s) => s.id)) : null;
  for (const topic of ['finance', 'ai'] as const) {
    if (!Array.isArray(file[topic])) {
      errors.push(`${topic} must be an array`);
      continue;
    }
    file[topic].forEach((b, i) => {
      const at = `${topic}[${i}]`;
      if (!b.text.trim()) errors.push(`${at}.text is empty`);
      if (b.storyIds.length === 0) errors.push(`${at} cites no stories`);
      for (const id of b.storyIds) if (known && !known.has(id)) errors.push(`${at} cites unknown story ${id}`);
      for (const key of ['why', 'impact'] as const) {
        if (b[key] !== undefined && (typeof b[key] !== 'string' || !b[key].trim())) errors.push(`${at}.${key} is empty`);
      }
    });
  }
  return errors;
}
