/**
 * Writes public/data/v1/summary.json: a short AI brief per topic, grounded in the current news.json.
 * The summary is optional: without an API key, or when Claude fails, it leaves any previous file in place and exits 0.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { loadMarkets } from '../src/lib/markets-data';
import { loadNews } from '../src/lib/news-data';
import { loadSummary } from '../src/lib/summary-data';
import { validateSummaryFile } from '../src/lib/validate';
import { buildSummary, SUMMARY_HOURS_UTC, summaryDue } from '../src/pipeline/summary';

const OUT_DIR = 'public/data/v1';
const OUT = `${OUT_DIR}/summary.json`;
// Claude Haiku 5.5 list prices per million tokens, for the cost line in the log.
const INPUT_PER_MTOK = 0.1;
const OUTPUT_PER_MTOK = 0.5;

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('Skipped the summary: ANTHROPIC_API_KEY is not set.');
  process.exit(0);
}

const news = loadNews();
if (!news) {
  console.error('error: no news.json; run npm run fetch:news first');
  process.exit(1);
}

const previous = existsSync(OUT) ? loadSummary(OUT) : null;
// SUMMARY_FORCE=1 writes a new summary now, whatever the age of the previous one.
if (!process.env.SUMMARY_FORCE && !summaryDue(previous, new Date())) {
  console.log(`Kept the summary from ${previous!.generatedAt}; new ones are written after ${SUMMARY_HOURS_UTC.map((h) => `${String(h).padStart(2, '0')}:00`).join(' and ')} UTC.`);
  process.exit(0);
}
const client = new Anthropic();
// The finance brief refers to the day's market moves when markets.json is there; it still works without.
const markets = loadMarkets();
const { file, reports } = await buildSummary(news, (params) => client.messages.create(params), previous, new Date(), markets);

let input = 0;
let output = 0;
for (const r of reports) {
  input += r.inputTokens ?? 0;
  output += r.outputTokens ?? 0;
  console.log(`${r.topic.padEnd(8)} ${r.outcome.padEnd(6)} ${r.bullets} bullets${r.error ? `  (${r.error})` : ''}`);
  for (const reason of r.rejected) console.warn(`  warn: dropped a bullet that ${reason}`);
}
if (reports.length > 0) {
  const cost = (input * INPUT_PER_MTOK + output * OUTPUT_PER_MTOK) / 1e6;
  console.log(`Tokens: ${input} in, ${output} out, about $${cost.toFixed(4)}.`);
}

if (!file) {
  console.log(reports.length === 0 ? 'Headlines unchanged since the last summary; kept it.' : 'No new bullets; kept the previous summary.');
  process.exit(0);
}

const errors = validateSummaryFile(file, news);
if (errors.length > 0) {
  console.error(`warn: summary.json failed validation, not writing it:\n${errors.join('\n')}`);
  process.exit(0);
}

for (const topic of ['finance', 'ai'] as const) {
  console.log(`\n${topic}:`);
  for (const b of file[topic]) {
    console.log(`- ${b.text} [${b.storyIds.join(', ')}]`);
    if (b.why) console.log(`    Why it matters: ${b.why}`);
    if (b.impact) console.log(`    Market impact: ${b.impact}`);
  }
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, JSON.stringify(file));
console.log(`\nWrote ${OUT}`);
