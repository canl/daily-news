import { describe, expect, it } from 'vitest';
import { relativeTime } from '../src/lib/time';

const now = new Date('2026-10-10T12:00:00Z');

describe('relativeTime', () => {
  it.each([
    ['2026-10-10T11:59:30Z', 'just now'],
    ['2026-10-10T11:48:00Z', '12 min ago'],
    ['2026-10-10T09:00:00Z', '3 h ago'],
    ['2026-10-08T11:00:00Z', '2 d ago'],
    ['2026-10-10T12:05:00Z', 'just now'],
  ])('%s -> %s', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });

  it('returns empty text for an unparseable date', () => {
    expect(relativeTime('not a date', now)).toBe('');
  });
});
