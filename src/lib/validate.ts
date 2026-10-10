import { SCHEMA_VERSION, type NewsFile } from './types';

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
