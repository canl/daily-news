import { readFileSync } from 'node:fs';
import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { NewsFile, SummaryFile } from '../src/lib/types';
import { validateSummaryFile } from '../src/lib/validate';
import { buildSummary, checkBullets, headlinesHash, selectHeadlines, SUMMARY_MODEL, summaryDue, type CreateMessage } from '../src/pipeline/summary';

const news: NewsFile = JSON.parse(readFileSync(new URL('./fixtures/news.sample.json', import.meta.url), 'utf8'));
const sample: SummaryFile = JSON.parse(readFileSync(new URL('./fixtures/summary.sample.json', import.meta.url), 'utf8'));
const now = new Date('2026-10-10T12:00:00Z');

/** A stub for client.messages.create that answers each call with the next JSON body. */
function stub(...bodies: (object | Error | Partial<Anthropic.Message>)[]): CreateMessage & { mock: { calls: unknown[][] } } {
  const fn = vi.fn(async () => {
    const next = bodies.shift();
    if (next instanceof Error) throw next;
    if (next && 'stop_reason' in next) return { content: [], usage: { input_tokens: 1, output_tokens: 1 }, ...next } as Anthropic.Message;
    return {
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify(next) }],
      usage: { input_tokens: 1000, output_tokens: 300 },
    } as unknown as Anthropic.Message;
  });
  return fn as never;
}

const financeBody = { bullets: sample.finance };
const aiBody = { bullets: sample.ai };

describe('selectHeadlines', () => {
  it('puts stories covered by more publishers first, then the newest, for one topic', () => {
    const finance = selectHeadlines(news, 'finance');
    expect(finance.every((s) => s.topic === 'finance')).toBe(true);
    expect(finance[0]!.id).toBe('f0bca2357107');
    expect(selectHeadlines(news, 'ai', 2).map((s) => s.id)).toEqual(['329d019416ba', 'bc21bc9d78ba']);
  });
});

describe('checkBullets', () => {
  const stories = selectHeadlines(news, 'finance');

  it('keeps grounded bullets', () => {
    expect(checkBullets(financeBody, stories)).toEqual({ bullets: sample.finance, rejected: [] });
  });

  it('drops bullets that cite nothing, cite unknown stories or invent numbers', () => {
    const { bullets, rejected } = checkBullets(
      {
        bullets: [
          { text: 'No sources here.', storyIds: [] },
          { text: 'Made-up source.', storyIds: ['f0bca2357107', 'ffffffffffff'] },
          { text: 'Brent crude rose 5% to $90.', storyIds: ['405a8205dc0c'] },
          { text: 'Brent crude rose 2%.', storyIds: ['405a8205dc0c', '405a8205dc0c'] },
        ],
      },
      stories,
    );
    expect(bullets).toEqual([{ text: 'Brent crude rose 2%.', storyIds: ['405a8205dc0c'] }]);
    expect(rejected).toHaveLength(3);
    expect(rejected[2]).toContain('5, 90');
  });

  it('handles a body without bullets', () => {
    expect(checkBullets({}, stories).bullets).toEqual([]);
  });
});

describe('buildSummary', () => {
  it('makes one Haiku call per topic and writes a valid file', async () => {
    const create = stub(financeBody, aiBody);
    const { file, reports } = await buildSummary(news, create, null, now);
    expect(create.mock.calls).toHaveLength(2);
    const params = create.mock.calls[0]![0] as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.model).toBe(SUMMARY_MODEL);
    expect(params.output_config?.format?.type).toBe('json_schema');
    expect(JSON.stringify(params.messages)).toContain('[f0bca2357107] Fed holds rates steady');
    expect(JSON.stringify(params.messages)).not.toContain('Nvidia');

    expect(file).not.toBeNull();
    expect(file!.finance).toEqual(sample.finance);
    expect(file!.ai).toEqual(sample.ai);
    expect(file!.basedOn).toBe(headlinesHash(news));
    expect(validateSummaryFile(file!, news)).toEqual([]);
    expect(reports.map((r) => r.outcome)).toEqual(['wrote', 'wrote']);
  });

  it('skips the calls when the headlines have not changed', async () => {
    const create = stub();
    const { file } = await buildSummary(news, create, { ...sample, basedOn: headlinesHash(news) }, now);
    expect(file).toBeNull();
    expect(create.mock.calls).toHaveLength(0);
  });

  it('keeps the previous bullets for a topic whose call fails or is declined', async () => {
    const create = stub({ stop_reason: 'refusal' }, aiBody);
    const { file, reports } = await buildSummary(news, create, { ...sample, finance: sample.finance.slice(0, 1) }, now);
    expect(file!.finance).toEqual(sample.finance.slice(0, 1));
    expect(reports[0]).toMatchObject({ outcome: 'kept', error: expect.stringContaining('declined') });
  });

  it('leaves a topic empty when it has too few grounded bullets and nothing to fall back on', async () => {
    const create = stub({ bullets: [{ text: 'Rates rose 9%.', storyIds: ['f0bca2357107'] }] }, aiBody);
    const { file, reports } = await buildSummary(news, create, null, now);
    expect(file!.finance).toEqual([]);
    expect(reports[0]).toMatchObject({ outcome: 'empty', error: 'only 0 grounded bullets' });
  });

  it('drops previous bullets whose stories have left the page', async () => {
    const stale = { ...sample, finance: [{ text: 'Old news.', storyIds: ['aaaaaaaaaaaa'] }] };
    const { file } = await buildSummary(news, stub(new Error('timeout'), aiBody), stale, now);
    expect(file!.finance).toEqual([]);
  });

  it('writes nothing when no topic gets new bullets, so the next run tries again', async () => {
    const { file, reports } = await buildSummary(news, stub(new Error('overloaded'), new Error('overloaded')), sample, now);
    expect(file).toBeNull();
    expect(reports.map((r) => r.outcome)).toEqual(['kept', 'kept']);
  });
});

describe('summaryDue', () => {
  const at = (iso: string) => ({ ...sample, generatedAt: iso });

  it('is due with no previous summary, or once it is 4 hours old', () => {
    expect(summaryDue(null, now)).toBe(true);
    expect(summaryDue(at('2026-10-10T08:00:00Z'), now)).toBe(true);
    expect(summaryDue(at('2026-10-10T06:00:00Z'), now)).toBe(true);
  });

  it('is not due within 4 hours, allowing a scheduled run to start a few minutes early', () => {
    expect(summaryDue(at('2026-10-10T09:00:00Z'), now)).toBe(false);
    expect(summaryDue(at('2026-10-10T08:10:00Z'), now)).toBe(true);
    expect(summaryDue(at('2026-10-10T08:20:00Z'), now)).toBe(false);
  });
});

describe('summary.json contract', () => {
  it('the sample used by the browser tests is valid against the sample news', () => {
    expect(validateSummaryFile(sample, news)).toEqual([]);
  });

  it('reports uncited bullets and unknown stories', () => {
    const errors = validateSummaryFile({ ...sample, model: '', finance: [{ text: ' ', storyIds: [] }], ai: [{ text: 'x', storyIds: ['nope'] }] }, news);
    expect(errors).toEqual(['model is empty', 'finance[0].text is empty', 'finance[0] cites no stories', 'ai[0] cites unknown story nope']);
  });
});
