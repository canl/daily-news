import { createHash } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { formatPrice } from '../lib/format';
import { SCHEMA_VERSION, type MarketsFile, type NewsFile, type Story, type SummaryBullet, type SummaryFile, type Topic } from '../lib/types';

export const SUMMARY_MODEL = 'claude-haiku-5-5';
export const HEADLINES_PER_TOPIC = 40;
export const BULLETS_PER_TOPIC = 5;
/** Fewer valid bullets than this and the topic keeps its previous summary instead. */
export const MIN_BULLETS = 3;
/**
 * Thinking is always on for this model and counts toward these caps. AI bullets need about 400 tokens;
 * finance bullets, with why it matters and market impact, about 1,200.
 */
const MAX_TOKENS: Record<Topic, number> = { finance: 4000, ai: 2000 };

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

/**
 * Hours (UTC) after which a new summary is written; the hourly build reuses the previous one in between.
 * 06:00 UTC is before the London open (08:00) and 17:00 UTC is after the close (16:30), in both
 * summer (BST) and winter (GMT) time.
 */
export const SUMMARY_HOURS_UTC = [6, 17] as const;

/** The latest summary time at or before now. */
export function lastSummarySlot(now: Date, hours: readonly number[] = SUMMARY_HOURS_UTC): Date {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const slots = [-1, 0].flatMap((d) => hours.map((h) => day + d * 86_400_000 + h * 3_600_000));
  return new Date(Math.max(...slots.filter((t) => t <= now.getTime())));
}

/** True when no summary has been written since the latest summary time. */
export function summaryDue(previous: SummaryFile | null, now: Date, hours: readonly number[] = SUMMARY_HOURS_UTC): boolean {
  if (!previous) return true;
  return Date.parse(previous.generatedAt) < lastSummarySlot(now, hours).getTime();
}

/** Changes only when the set of headlines the summary would read changes. */
export function headlinesHash(news: NewsFile): string {
  const ids = (['finance', 'ai'] as const).flatMap((t) => selectHeadlines(news, t).map((s) => s.id)).sort();
  return createHash('sha256').update(ids.join(',')).digest('hex').slice(0, 16);
}

const GROUNDING = `Grounding rules:
- Cite the ids of the one to three stories each bullet is based on.
- If two stories report the same thing, write one bullet that cites both.
- Only use a number, percentage, price or date if it appears in a story you cite`;

const AI_SYSTEM = `You write the daily brief for a news site. You are given numbered headlines with short snippets from public news feeds.

Write exactly ${BULLETS_PER_TOPIC} bullets covering the most important separate developments. Each bullet is one plain sentence of at most 30 words, written for a general reader.

${GROUNDING}.
- Use only facts stated in the headlines and snippets. Do not add context, causes, predictions or opinions of your own.`;

const FINANCE_SYSTEM = `You write the daily markets brief for a news site, for readers who follow markets but are not professionals. You are given numbered finance headlines with short snippets from public news feeds, and the latest delayed daily moves for major markets.

Pick the ${BULLETS_PER_TOPIC} most important separate developments for markets. For each, write three short parts:
- text: what happened. One sentence of at most 30 words, using only facts stated in the cited headlines and snippets.
- why: why it matters. One or two sentences, at most 35 words. You may draw on general background knowledge (how central banks, earnings, trade, energy or currencies usually work) to explain the significance, but do not state new facts about the event itself.
- impact: the likely effect on markets. One or two sentences, at most 35 words. Name the assets, sectors or regions most exposed and the usual direction of pressure. Where the market moves provided show a related move, mention it; never claim the news caused it.

${GROUNDING}, or in the market moves provided.
- Do not forecast specific prices, levels or dates, and do not give investment advice.
- Write plainly and with appropriate hedging ("could", "tends to", "may"); avoid hype.`;

/** The market moves the finance brief may refer to, one line per instrument. */
export function marketLines(markets: MarketsFile | null): string {
  if (!markets) return '';
  return markets.instruments
    .map((m) => `${m.name}: ${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(2)}% on the day, at ${formatPrice(m)}`)
    .join('\n');
}

function headlineList(stories: Story[]): string {
  return stories
    .map((s) => `[${s.id}] ${s.title} (${s.source})${s.snippet ? `\n${s.snippet}` : ''}`)
    .join('\n\n');
}

function outputSchema(topic: Topic) {
  const extra = topic === 'finance' ? { why: { type: 'string' }, impact: { type: 'string' } } : {};
  return {
    type: 'object',
    properties: {
      bullets: {
        type: 'array',
        items: {
          type: 'object',
          properties: { text: { type: 'string' }, storyIds: { type: 'array', items: { type: 'string' } }, ...extra },
          required: ['text', 'storyIds', ...Object.keys(extra)],
          additionalProperties: false,
        },
      },
    },
    required: ['bullets'],
    additionalProperties: false,
  };
}

const numberPattern = /\d[\d,.]*\d|\d/g;
/** "1,200", "1200.0" and "1200" compare equal, as do "0.80" and "0.8". */
const normalizeNumber = (n: string) => String(Number(n.replace(/,/g, '')));

/** Numbers in the text that the given source text does not contain. */
function unsupportedNumbers(text: string, source: string): string[] {
  const known = new Set((source.match(numberPattern) ?? []).map(normalizeNumber));
  return (text.match(numberPattern) ?? []).filter((n) => !known.has(normalizeNumber(n)));
}

const storyText = (cited: Story[]) => cited.map((s) => `${s.title} ${s.snippet}`).join(' ');

/**
 * Keeps bullets that cite at least one given story and invent no numbers. Returns the kept bullets and why others were dropped.
 * With `analysis`, each bullet must also carry why and impact; their numbers may come from the cited stories or `marketText`.
 */
export function checkBullets(
  raw: unknown,
  stories: Story[],
  { analysis = false, marketText = '' }: { analysis?: boolean; marketText?: string } = {},
): { bullets: SummaryBullet[]; rejected: string[] } {
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
      const source = storyText(cited);
      const invented = unsupportedNumbers(text, source);
      const why = typeof item?.why === 'string' ? item.why.trim() : '';
      const impact = typeof item?.impact === 'string' ? item.impact.trim() : '';
      const inventedInAnalysis = unsupportedNumbers(`${why} ${impact}`, `${source} ${marketText}`);
      if (invented.length > 0) rejected.push(`numbers not in its stories (${invented.join(', ')}): "${text}"`);
      else if (analysis && (!why || !impact)) rejected.push(`is missing why it matters or market impact: "${text}"`);
      else if (analysis && inventedInAnalysis.length > 0) {
        rejected.push(`analysis has numbers not in its stories or the market data (${inventedInAnalysis.join(', ')}): "${text}"`);
      } else bullets.push({ text, storyIds: cited.map((s) => s.id), ...(analysis ? { why, impact } : {}) });
    }
  }
  return { bullets, rejected };
}

export async function summarizeTopic(
  create: CreateMessage,
  topic: Topic,
  stories: Story[],
  markets: MarketsFile | null = null,
): Promise<{ bullets: SummaryBullet[]; rejected: string[]; usage: Anthropic.Usage }> {
  const finance = topic === 'finance';
  const marketText = finance ? marketLines(markets) : '';
  const headlines = `Today's ${TOPIC_NAMES[topic]} headlines:\n\n${headlineList(stories)}`;
  const response = await create({
    model: SUMMARY_MODEL,
    max_tokens: MAX_TOKENS[topic],
    system: finance ? FINANCE_SYSTEM : AI_SYSTEM,
    // The finance brief explains and connects events, so it gets more room to think.
    output_config: { effort: finance ? 'medium' : 'low', format: { type: 'json_schema', schema: outputSchema(topic) } },
    messages: [
      {
        role: 'user',
        content: marketText ? `${headlines}\n\nLatest market moves (delayed):\n${marketText}` : headlines,
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
  return { ...checkBullets(parsed, stories, { analysis: finance, marketText }), usage: response.usage };
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
  markets: MarketsFile | null = null,
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
      const { bullets, rejected, usage } = await summarizeTopic(create, topic, stories, markets);
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
