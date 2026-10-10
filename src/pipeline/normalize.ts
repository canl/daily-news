import { createHash } from 'node:crypto';

export const SNIPPET_MAX = 240;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Plain text from feed HTML: tags removed, entities decoded, whitespace collapsed. */
export function toPlainText(html: string): string {
  const noTags = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(noTags).replace(/\s+/g, ' ').trim();
}

/** Cut at a word boundary and add an ellipsis when longer than max. */
export function truncate(text: string, max = SNIPPET_MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

/** Lowercase words with punctuation and a trailing " - Publisher" suffix removed; used to match duplicates. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+[-–—|]\s+[^-–—|]{2,40}$/, '')
    .replace(/[‘’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function storyId(title: string): string {
  return createHash('sha256').update(normalizeTitle(title)).digest('hex').slice(0, 12);
}
