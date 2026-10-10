/**
 * Fetches all feeds and writes public/data/v1/news.json.
 * Exits non-zero when no feed could be read, so a scheduled build never deploys an empty page.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { validateNewsFile } from '../src/lib/validate';
import { FEEDS } from '../src/pipeline/feeds';
import { buildNews } from '../src/pipeline/news';

const OUT_DIR = 'public/data/v1';

const { file, failures, stats } = await buildNews(FEEDS);

for (const f of failures) console.warn(`warn: skipped ${f.source} (${f.url}): ${f.error}`);
for (const s of stats.filter((s) => s.kept === 0)) {
  console.warn(`warn: ${s.source} (${s.url}) returned ${s.parsed} items but none were usable or recent: ${JSON.stringify(s.dropped)}`);
  if (s.sample) console.warn(`  first item: ${JSON.stringify({ ...s.sample, description: s.sample.description.slice(0, 80) })}`);
}
const read = FEEDS.length - failures.length;
console.log(`Read ${read}/${FEEDS.length} feeds, ${file.stories.length} stories after dedupe.`);

const perSource = new Map<string, number>();
for (const s of file.stories) {
  const key = `${s.source} (${s.topic})`;
  perSource.set(key, (perSource.get(key) ?? 0) + 1);
}
for (const [key, n] of [...perSource].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${key}`);

if (read === 0) {
  console.error('error: no feed could be read; not writing news.json');
  process.exit(1);
}

const errors = validateNewsFile(file);
if (errors.length > 0) {
  console.error(`error: news.json failed validation:\n${errors.join('\n')}`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(`${OUT_DIR}/news.json`, JSON.stringify(file));
console.log(`Wrote ${OUT_DIR}/news.json`);
