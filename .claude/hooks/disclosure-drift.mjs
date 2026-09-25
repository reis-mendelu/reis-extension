#!/usr/bin/env node
/**
 * Stop hook: did this turn change how reIS sends data without saying so in
 * privacy/disclosures.ts?
 *
 * That file is the single source for every store declaration and the privacy
 * policy table; the release checklist is generated from its diff. A data-flow
 * change that skips it ships undeclared. CI's privacy:check catches most of
 * those for every contributor; this catches them in a Claude turn, before the
 * push, including the ones CI cannot see — a flow that keeps its call names but
 * starts sending a new field.
 *
 * Same shape as tree-parity.mjs: exit 2 feeds the reason back; it asks once per
 * distinct set of files (marker in the git dir), so "not a data-flow change" is
 * a valid answer that ends the turn. Exported functions are imported by
 * src/test/guards/disclosureDriftHookSees.test.ts, so a hook that goes quiet is
 * noticed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE = 'privacy/disclosures.ts';

/** Files outside the flows' own `files:` that change what reIS declares. */
export const ALWAYS_DATA_FLOW = [
  /^supabase\/migrations\//,
  /^wxt\.config\.ts$/,
  /^ios\/App\/App\/Info\.plist$/,
  /^android\/app\/src\/main\/AndroidManifest\.xml$/,
  /^src\/test\/guards\/noStudentDataLeaves\.test\.ts$/,
  /^privacy\/play-data-safety\.csv$/,
  /^docs\/privacy-policy-app\.md$/,
  /^PRIVACY\.md$/,
];

/** The `files:` entries of every flow and exemption in privacy/disclosures.ts. */
export const flowFiles = (sourceText) =>
  new Set([...sourceText.matchAll(/'(src\/[^']+\.tsx?)'/g)].map((m) => m[1]));

export const dataFlowFiles = (changed, flowSet) =>
  [...changed].filter((f) => flowSet.has(f) || ALWAYS_DATA_FLOW.some((re) => re.test(f))).sort();

/** The data-flow files a turn left undeclared, or [] when there is nothing to ask. */
export const undeclared = (changed, sourceText) => {
  const set = new Set(changed);
  if (!set.size || set.has(SOURCE)) return [];
  return dataFlowFiles(set, flowFiles(sourceText));
};

export const buildReason = (files) =>
  'This turn changed files that decide what reIS sends or declares, and did not touch ' +
  `${SOURCE}:\n` +
  files.map((f) => `  - ${f}`).join('\n') +
  '\n\nThat file is the one source for the privacy policy table, the App Store label, Play Data ' +
  'safety, the Chrome Web Store practices and the Firefox manifest; the release PR checklist is ' +
  'generated from its diff.\n\nDo ONE of these, then stop:\n' +
  `  1. Update ${SOURCE} (and privacy/play-data-safety.csv if Play changes), run ` +
  '`npm run privacy:generate`, and `npx vitest run scripts/lib/__tests__/privacyDisclosures.test.ts`.\n' +
  '  2. If what the student sends and what the stores should say are unchanged, say so in one line ' +
  'and stop — this will not ask twice about the same set of files.';

const main = () => {
  const ok = () => process.exit(0);
  let payload = {};
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    /* never fail a turn on malformed input */
  }
  if (payload.stop_hook_active) ok();

  const git = (...args) => {
    try {
      return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return '';
    }
  };
  const base = ['origin/test', 'origin/main', 'test', 'main']
    .map((ref) => git('merge-base', 'HEAD', ref).trim())
    .find(Boolean);
  const changed = new Set(
    [
      git('diff', '--name-only', 'HEAD'),
      git('ls-files', '--others', '--exclude-standard'),
      base ? git('diff', '--name-only', `${base}...HEAD`) : '',
    ]
      .join('\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  );
  if (!existsSync(SOURCE)) ok();
  const files = undeclared(changed, readFileSync(SOURCE, 'utf8'));
  if (!files.length) ok();

  const marker = join(
    git('rev-parse', '--absolute-git-dir').trim() || '.git',
    'reis-disclosure-drift'
  );
  const fingerprint = files.join('\n');
  try {
    if (readFileSync(marker, 'utf8') === fingerprint) ok();
  } catch {
    /* first time */
  }
  try {
    writeFileSync(marker, fingerprint);
  } catch {
    /* unwritable git dir: ask every turn rather than never */
  }
  process.stderr.write(buildReason(files) + '\n');
  process.exit(2);
};

const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};
export const isDirectRun = (argv1, moduleUrl) =>
  Boolean(argv1) && real(argv1) === real(fileURLToPath(moduleUrl));

if (isDirectRun(process.argv[1], import.meta.url)) main();
