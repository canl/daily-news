import { describe, expect, it } from 'vitest';
import { decodeEntities, normalizeTitle, storyId, toPlainText, truncate } from '../src/pipeline/normalize';

describe('normalize', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('A &amp; B &#8211; C &#x2019;s &unknown;')).toBe('A & B – C ’s &unknown;');
  });

  it('turns feed HTML into plain text', () => {
    expect(toPlainText('<p>Hello <b>world</b></p><script>alert(1)</script>\n  again')).toBe('Hello world again');
  });

  it('truncates at a word boundary with an ellipsis', () => {
    const long = 'word '.repeat(100);
    const out = truncate(long, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith('word…')).toBe(true);
    expect(truncate('short', 40)).toBe('short');
  });

  it('normalizes titles so the same headline from two outlets matches', () => {
    expect(normalizeTitle('Fed Holds Rates Steady - Reuters')).toBe('fed holds rates steady');
    expect(normalizeTitle('Fed holds rates steady!')).toBe('fed holds rates steady');
    expect(storyId('Fed Holds Rates Steady - Reuters')).toBe(storyId('Fed holds rates steady!'));
    expect(storyId('Fed holds rates steady')).toMatch(/^[0-9a-f]{12}$/);
  });
});
