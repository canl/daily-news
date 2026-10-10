import type { Story } from '../lib/types';
import { normalizeTitle } from './normalize';

/** Share of words two headlines have in common (Jaccard). */
export function similarity(a: string, b: string): number {
  const wa = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const wb = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / (wa.size + wb.size - shared);
}

export const DUPLICATE_THRESHOLD = 0.75;

/**
 * Merges stories whose headlines match or nearly match. The earliest report is kept
 * and the other publishers go into alsoReportedBy. Input order does not matter.
 */
export function dedupe(stories: Story[]): Story[] {
  const byTime = [...stories].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const kept: Story[] = [];
  for (const story of byTime) {
    const match = kept.find(
      (k) => k.id === story.id || similarity(k.title, story.title) >= DUPLICATE_THRESHOLD,
    );
    if (!match) {
      kept.push({ ...story, alsoReportedBy: [...story.alsoReportedBy] });
    } else if (match.source !== story.source && !match.alsoReportedBy.includes(story.source)) {
      match.alsoReportedBy.push(story.source);
    }
  }
  return kept;
}
