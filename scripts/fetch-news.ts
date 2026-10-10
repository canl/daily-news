/**
 * Fetches all feeds and writes public/data/v1/news.json.
 * Exits non-zero when no feed could be read, so a scheduled build never deploys an empty page.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { validateNewsFile } from '../src/lib/validate';
import { FEEDS } from '../src/pipeline/feeds';
import { buildNews } from '../src/pipeline/news';

const OUT_DIR = 'public/data/v1';

const { file, failures } = await buildNews(FEEDS);

for (const f of failures) console.warn(`warn: skipped ${f.source} (${f.url}): ${f.error}`);
const read = FEEDS.length - failures.length;
console.log(`Read ${read}/${FEEDS.length} feeds, ${file.stories.length} stories after dedupe.`);

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
