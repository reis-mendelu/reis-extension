#!/usr/bin/env node
// Reads the latest public posts of MENDELU societies and official accounts
// through Apify's logged-out instagram-profile-scraper, and writes a digest of
// the posts it has not seen before. No Instagram account is involved, ever.
// See README.md beside this file.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAFE_NAME, checkHealth, findNewPosts, formatDigest, normalizeProfiles } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = 'https://api.apify.com/v2';
const ACTOR = 'apify~instagram-profile-scraper';
// A hard ceiling Apify enforces per run: 16 profiles cost $0.042 on the Free tier.
const MAX_CHARGE_USD = 0.2;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const stateDir = process.env.REIS_IG_STATE ?? join(homedir(), '.reis', 'instagram-watch');
const staleDays = Number(option('--stale-days') ?? 60);
const dryRun = flag('--dry-run');

const accounts = JSON.parse(readFileSync(join(HERE, 'accounts.json'), 'utf8'));
const allHandles = [...Object.keys(accounts.societies), ...accounts.official];
const handles = option('--only')?.split(',') ?? allHandles;

const token = process.env.APIFY_TOKEN ?? tokenFromMainCheckoutEnv();
if (!token) {
  console.error('APIFY_TOKEN is not set: add it to the main checkout .env, or export it.');
  process.exit(1);
}

const run = await runActor(handles);
if (!SAFE_NAME.test(run.id)) throw new Error('Apify returned an unexpected run id.');
const items = await apify(`/datasets/${run.defaultDatasetId}/items?clean=true`);
mkdirSync(join(stateDir, 'runs'), { recursive: true });
const day = new Date().toISOString().slice(0, 10);
writeFileSync(join(stateDir, 'runs', `${day}-${run.id}.json`), JSON.stringify(items, null, 2));

const profiles = normalizeProfiles(items);
const seenPath = join(stateDir, 'seen.json');
const seen = readJson(seenPath, {});
const result = findNewPosts(profiles, seen, { baseline: !flag('--no-baseline') });
const problems = checkHealth(profiles, handles, new Date(), staleDays);

// Instagram's CDN links are signed and expire, so the poster is saved now or never.
mkdirSync(join(stateDir, 'posters'), { recursive: true });
result.newPosts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
for (const post of result.newPosts) {
  post.localImages = await savePosters(post);
  post.society = accounts.societies[post.handle] ?? null;
}

// usageTotalUsd lags the charge by minutes; the charged-event count does not.
const settled = await apify(`/actor-runs/${run.id}`);
const profilePrice =
  settled.pricingInfo?.pricingPerEvent?.actorChargeEvents?.profile?.eventPriceUsd ?? 0;
const costUsd = Math.max(
  settled.usageTotalUsd ?? 0,
  (settled.chargedEventCounts?.profile ?? 0) * profilePrice
);
const digest = formatDigest({
  date: day,
  newPosts: result.newPosts,
  baselined: result.baselined,
  problems,
  costUsd,
  profileCount: profiles.length,
});
mkdirSync(join(stateDir, 'digests'), { recursive: true });
writeFileSync(join(stateDir, 'digests', `${day}.md`), digest);
writeFileSync(join(stateDir, 'latest.json'), JSON.stringify({ day, ...result, problems }, null, 2));
if (!dryRun) writeFileSync(seenPath, JSON.stringify(result.seen, null, 2));

console.log(digest);
console.log(`State: ${stateDir}${dryRun ? ' (dry run: seen.json not updated)' : ''}`);

async function runActor(usernames) {
  const query = `waitForFinish=60&maxTotalChargeUsd=${MAX_CHARGE_USD}`;
  let current = await apify(`/acts/${ACTOR}/runs?${query}`, {
    method: 'POST',
    body: JSON.stringify({ usernames, includeAboutSection: false }),
  });
  while (current.status === 'READY' || current.status === 'RUNNING') {
    current = await apify(`/actor-runs/${current.id}?waitForFinish=60`);
  }
  if (current.status !== 'SUCCEEDED') {
    throw new Error(`Apify run ${current.id} ended ${current.status}; seen.json left as it was.`);
  }
  return current;
}

async function apify(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok)
    throw new Error(`Apify ${init.method ?? 'GET'} ${path.split('?')[0]}: HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? body : body.data;
}

async function savePosters(post) {
  const saved = [];
  for (const [i, url] of post.images.entries()) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const file = join(stateDir, 'posters', `${post.shortCode}${i ? `-${i}` : ''}.jpg`);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      saved.push(file);
    } catch {
      // A slide that will not download is skipped; the post link still goes in the digest.
    }
  }
  return saved;
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

// The token lives in the main checkout's .env, which a worktree does not have.
function tokenFromMainCheckoutEnv() {
  try {
    const gitDir = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      {
        cwd: HERE,
        encoding: 'utf8',
      }
    ).trim();
    const env = readFileSync(join(dirname(gitDir), '.env'), 'utf8');
    return env
      .match(/^APIFY_TOKEN=(.+)$/m)?.[1]
      .trim()
      .replace(/^["']|["']$/g, '');
  } catch {
    return undefined;
  }
}
