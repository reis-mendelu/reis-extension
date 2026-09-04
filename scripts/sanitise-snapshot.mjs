// Reads the raw scrape and writes the only file a deployed build may ship.
//
// Two separate filenames on purpose: scripts/stripDevRealData.mjs deletes
// dev-real-data.json from every web build unconditionally, with no flag that
// can switch it off. A conditional strip would mean one wrong environment
// variable publishes a real student record.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IN = resolve(root, 'public/dev-real-data.json');
const OUT = resolve(root, 'public/preview-data.json');

if (!existsSync(IN)) {
  console.error(
    `\nNo scrape found at public/dev-real-data.json.\nRun \`npm run scrape:real\` first — it needs MENDELU_USER / MENDELU_PASS in .env.\n`
  );
  process.exit(1);
}

// tsx registers the TS loader; see the npm script.
const require = createRequire(import.meta.url);
const { sanitiseSnapshot } = require('./sanitiseSnapshot.ts');

const { data, report } = sanitiseSnapshot(JSON.parse(readFileSync(IN, 'utf8')));
writeFileSync(OUT, JSON.stringify(data));
for (const line of report) console.log(line);
console.log(`Wrote ${OUT}`);
