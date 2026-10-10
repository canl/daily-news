/**
 * Fetches delayed prices for every instrument and writes public/data/v1/markets.json.
 * Exits non-zero when fewer than half the instruments load, so a broken source never ships an empty page.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { validateMarketsFile } from '../src/lib/validate';
import { INSTRUMENTS } from '../src/pipeline/instruments';
import { buildMarkets } from '../src/pipeline/markets';

const OUT_DIR = 'public/data/v1';

const { file, failures, fallbacks } = await buildMarkets(INSTRUMENTS);

for (const f of failures) console.warn(`warn: skipped ${f.name} (${f.symbol}): ${f.error}`);
if (fallbacks.length > 0) console.log(`Used the Stooq fallback for: ${fallbacks.join(', ')}`);
console.log(`Loaded ${file.instruments.length}/${INSTRUMENTS.length} instruments.`);
for (const m of file.instruments) {
  console.log(`${m.name.padEnd(20)} ${String(m.last).padStart(12)} ${(m.changePct >= 0 ? '+' : '') + m.changePct.toFixed(2)}%  ${m.asOf}`);
}

const unchanged = file.instruments.filter((m) => m.change === 0).length;
if (unchanged > file.instruments.length / 2) {
  console.warn(`warn: ${unchanged} instruments show no change at all; check how the previous close is found`);
}

if (file.instruments.length < INSTRUMENTS.length / 2) {
  console.error('error: fewer than half the instruments loaded; not writing markets.json');
  process.exit(1);
}

const errors = validateMarketsFile(file);
if (errors.length > 0) {
  console.error(`error: markets.json failed validation:\n${errors.join('\n')}`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(`${OUT_DIR}/markets.json`, JSON.stringify(file));
console.log(`Wrote ${OUT_DIR}/markets.json`);
