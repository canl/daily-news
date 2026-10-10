import { createHash } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { SCHEMA_VERSION, type NewsFile, type Story, type SummaryBullet, type SummaryFile, type Topic } from '../lib/types';

export const SUMMARY_MODEL = 'claude-haiku-5-5';
export const HEADLINES_PER_TOPIC = 40;
export const BULLETS_PER_TOPIC = 5;
/** Fewer valid bullets than this and the topic keeps its previous summary instead. */
export const MIN_BULLETS = 3;
/** Thinking is always on for this model and counts toward this cap; the bullets themselves need about 400 tokens. */
const MAX_TOKENS = 2000;

/** The one SDK call the summary makes; tests pass a stub. */
export type CreateMessage = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

const TOPIC_NAMES: Record<Topic, string> = { finance: 'finance and markets', ai: 'artificial intelligence' };

/** Stories covered by the most publishers first, then the newest. */
export function selectHeadlines(news: NewsFile, topic: Topic, limit = HEADLINES_PER_TOPIC): Story[] {
  return news.stories
    .filter((s) => s.topic === topic)
    .sort((a, b) => b.alsoReportedBy.length - a.alsoReportedBy.length || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

/** How often a new summary is written; the hourly build reuses the previous one in between. */
export const SUMMARY_EVERY_HOURS = 4;

/**
 * True when the previous summary is old enough to replace. A 15-minute allowance keeps a
 * slightly early scheduled run from skipping a whole cycle.
 */
export function summaryDue(previous: SummaryFile | null, now: Date, everyHours = SUMMARY_EVERY_HOURS): boolean {
  if (!previous) return true;
  const age = now.getTime() - Date.parse(previous.generatedAt);
  return !(age < everyHours * 3_600_000 - 15 * 60_000);
}

/** Changes only when the set of headlines the summary would read changes. */
export function headlinesHash(news: NewsFile): string {
  const ids = (['finance', 'ai'] as const).flatMap((t) => selectHeadlines(news, t).map((s) => s.id)).sort();
  return createHash('sha256').update(ids.join(',')).digest('hex').slice(0, 16);
}

const SYSTEM = `You write the daily brief for a news site. You are given numbered headlines with short snippets from public news feeds.

Write exactly ${BULLETS_PER_TOPIC} bullets covering the most important separate developments. Each bullet is one plain sentence of at most 30 words, written for a general reader.

Grounding rules:
- Use only facts stated in the headlines and snippets. Do not add context, causes, predictions or opinions of your own.
- Only use a number, percentage, price or date if it appears in a story you cite.
- Cite the ids of the one to three stories each bullet is based on.
- If two stories report the same thing, write one bullet that cites both.`;

function headlineList(stories: Story[]): string {
  return stories
    .map((s) => `[${s.id}] ${s.title} (${s.source})${s.snippet ? `\n${s.snippet}` : ''}`)
    .join('\n\n');
}

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    bullets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          storyIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'storyIds'],
        additionalProperties: false,
      },
    },
  },
  required: ['bullets'],
  additionalProperties: false,
};

const numberPattern = /\d[\d,.]*\d|\d/g;
const normalizeNumber = (n: string) => n.replace(/,/g, '').replace(/\.0+$/, '');

/** Numbers in the bullet that none of its cited stories contain. */
function unsupportedNumbers(text: string, cited: Story[]): string[] {
  const source = cited.map((s) => `${s.title} ${s.snippet}`).join(' ');
  const known = new Set((source.match(numberPattern) ?? []).map(normalizeNumber));
  return (text.match(numberPattern) ?? []).filter((n) => !known.has(normalizeNumber(n)));
}

/** Keeps bullets that cite at least one given story and invent no numbers. Returns the kept bullets and why others were dropped. */
export function checkBullets(raw: unknown, stories: Story[]): { bullets: SummaryBullet[]; rejected: string[] } {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const bullets: SummaryBullet[] = [];
  const rejected: string[] = [];
  const items = (raw as { bullets?: unknown })?.bullets;
  if (!Array.isArray(items)) return { bullets, rejected: ['response has no bullets array'] };

  for (const item of items.slice(0, BULLETS_PER_TOPIC)) {
    const text = typeof item?.text === 'string' ? item.text.trim() : '';
    const ids: string[] = Array.isArray(item?.storyIds) ? [...new Set<string>(item.storyIds.filter((id: unknown) => typeof id === 'string'))] : [];
    const cited = ids.map((id) => byId.get(id)).filter((s): s is Story => s !== undefined);
    if (!text) rejected.push('empty bullet');
    else if (cited.length === 0) rejected.push(`cites no known story: "${text}"`);
    else if (cited.length < ids.length) rejected.push(`cites an unknown story: "${text}"`);
    else {
      const invented = unsupportedNumbers(text, cited);
      if (invented.length > 0) rejected.push(`numbers not in its stories (${invented.join(', ')}): "${text}"`);
      else bullets.push({ text, storyIds: cited.map((s) => s.id) });
    }
  }
  return { bullets, rejected };
}

export async function summarizeTopic(
  create: CreateMessage,
  topic: Topic,
  stories: Story[],
): Promise<{ bullets: SummaryBullet[]; rejected: string[]; usage: Anthropic.Usage }> {
  const response = await create({
    model: SUMMARY_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Today's ${TOPIC_NAMES[topic]} headlines:\n\n${headlineList(stories)}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error(`declined (${response.stop_details?.category ?? 'no category'})`);
  if (response.stop_reason === 'max_tokens') throw new Error('ran out of output tokens');
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text;
  if (!text) throw new Error('no text in the response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('response was not valid JSON');
  }
  return { ...checkBullets(parsed, stories), usage: response.usage };
}

export interface TopicReport {
  topic: Topic;
  /** wrote: new bullets; kept: the previous bullets stayed; empty: nothing to show. */
  outcome: 'wrote' | 'kept' | 'empty';
  bullets: number;
  rejected: string[];
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface BuildSummaryResult {
  /** null when the headlines have not changed since the previous summary, or no topic got new bullets. */
  file: SummaryFile | null;
  reports: TopicReport[];
}

/**
 * Writes the finance and AI briefs. A topic whose call fails, or returns too few grounded bullets,
 * keeps its previous bullets so the site never shows a half-written brief.
 */
export async function buildSummary(
  news: NewsFile,
  create: CreateMessage,
  previous: SummaryFile | null = null,
  now: Date = new Date(),
): Promise<BuildSummaryResult> {
  const basedOn = headlinesHash(news);
  if (previous?.basedOn === basedOn) return { file: null, reports: [] };

  const current = new Set(news.stories.map((s) => s.id));
  const reports: TopicReport[] = [];
  const out: Record<Topic, SummaryBullet[]> = { finance: [], ai: [] };

  for (const topic of ['finance', 'ai'] as const) {
    const stories = selectHeadlines(news, topic);
    // Previous bullets stay only while every story they cite is still on the page.
    const fallback = (previous?.[topic] ?? []).filter((b) => b.storyIds.every((id) => current.has(id)));
    const keep = (error: string, rejected: string[] = []): TopicReport => {
      out[topic] = fallback;
      return { topic, outcome: fallback.length > 0 ? 'kept' : 'empty', bullets: fallback.length, rejected, error };
    };

    if (stories.length === 0) {
      reports.push(keep('no headlines for this topic'));
      continue;
    }
    try {
      const { bullets, rejected, usage } = await summarizeTopic(create, topic, stories);
      const tokens = { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
      if (bullets.length < MIN_BULLETS) {
        reports.push({ ...keep(`only ${bullets.length} grounded bullets`, rejected), ...tokens });
      } else {
        out[topic] = bullets;
        reports.push({ topic, outcome: 'wrote', bullets: bullets.length, rejected, ...tokens });
      }
    } catch (error) {
      reports.push(keep(error instanceof Error ? error.message : String(error)));
    }
  }

  // Nothing new was written: leave the previous file alone so the next run tries again.
  if (!reports.some((r) => r.outcome === 'wrote')) return { file: null, reports };

  return {
    file: { schemaVersion: SCHEMA_VERSION, generatedAt: now.toISOString(), finance: out.finance, ai: out.ai, model: SUMMARY_MODEL, basedOn },
    reports,
  };
}
