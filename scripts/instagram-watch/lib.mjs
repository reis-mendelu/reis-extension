// Pure logic of the Instagram watcher (watch.mjs): which posts are new, and
// which profiles came back looking wrong. No I/O here, so it is testable and
// the CLI stays a thin shell around Apify and the state file.

/** How many shortCodes to remember per handle; far above the 12 a run returns. */
const SEEN_CAP = 200;
/** Carousel slides kept per post: enough for a schedule, not a whole photo recap. */
const MAX_SLIDES = 5;
/** Instagram shortCodes and Apify ids are [A-Za-z0-9_-]; anything else is refused. */
export const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

/**
 * Splits a run's posts into new ones and remembered ones.
 *
 * "New" is set membership on shortCode, never "newer than the last post":
 * a profile can pin up to three old posts above its newest one.
 *
 * A handle with no remembered posts is baselined — everything it returned is
 * marked seen and nothing is reported — so adding an account does not flood
 * the digest with its last twelve posts. A handle that came back empty is not
 * baselined: an empty answer is what a broken scrape looks like, and
 * baselining it would swallow its first real posts.
 *
 * @param {{handle: string, posts: {shortCode: string}[]}[]} profiles
 * @param {Record<string, string[]>} seen
 * @param {{baseline?: boolean}} [options] `baseline: false` reports a new
 *   handle's posts in full — for a first run someone reads by hand.
 */
export function findNewPosts(profiles, seen, { baseline = true } = {}) {
  const nextSeen = { ...seen };
  const newPosts = [];
  const baselined = [];

  for (const { handle, posts } of profiles) {
    if (posts.length === 0) continue;
    const known = new Set(seen[handle] ?? []);
    if (known.size === 0 && baseline) {
      baselined.push(handle);
    } else {
      for (const p of posts) if (!known.has(p.shortCode)) newPosts.push({ handle, ...p });
    }
    const merged = [...posts.map((p) => p.shortCode), ...(seen[handle] ?? [])];
    nextSeen[handle] = [...new Set(merged)].slice(0, SEEN_CAP);
  }

  return { newPosts, baselined, seen: nextSeen };
}

/**
 * Apify's dataset items → `{ handle, posts }`. Items without a username (an
 * error row) are dropped, which checkHealth then reports as `missing`.
 *
 * @param {any[]} items
 */
export function normalizeProfiles(items) {
  return items
    .filter((item) => typeof item?.username === 'string')
    .map((item) => ({
      handle: item.username.toLowerCase(),
      posts: (item.latestPosts ?? [])
        // shortCode names the saved poster file, so it must not be able to leave posters/.
        .filter((p) => SAFE_NAME.test(p?.shortCode ?? '') && p?.timestamp)
        .map((p) => ({
          shortCode: p.shortCode,
          url: p.url ?? `https://www.instagram.com/p/${p.shortCode}/`,
          timestamp: p.timestamp,
          caption: p.caption ?? '',
          images: [...new Set([p.displayUrl, ...(p.images ?? [])].filter(Boolean))].slice(
            0,
            MAX_SLIDES
          ),
          type: p.type ?? null,
          pinned: Boolean(p.isPinned),
        })),
    }));
}

/**
 * Plain-markdown digest of one run: the input the morning Claude task reads,
 * and what a person reads when running the script by hand.
 *
 * @param {{date: string, newPosts: any[], baselined: string[], problems: any[], costUsd?: number, profileCount: number}} run
 */
export function formatDigest({ date, newPosts, baselined, problems, costUsd, profileCount }) {
  const lines = [`# Instagram watch · ${date}`, ''];
  const cost = typeof costUsd === 'number' ? ` · $${costUsd.toFixed(4)}` : '';
  lines.push(`${profileCount} profiles · ${newPosts.length} new posts${cost}`, '');

  for (const p of newPosts) {
    lines.push(
      `## @${p.handle}${p.society ? ` (${p.society})` : ''} · ${p.timestamp.slice(0, 10)} · ${p.type ?? 'post'}`
    );
    lines.push(p.url);
    for (const file of p.localImages ?? []) lines.push(`image: ${file}`);
    lines.push('', p.caption.trim() || '(no caption)', '');
  }
  if (baselined.length)
    lines.push(`First run for: ${baselined.join(', ')} — remembered, not reported.`, '');
  for (const { handle, problem, newestAt } of problems) {
    lines.push(
      `PROBLEM @${handle}: ${problem}${newestAt ? ` (newest ${newestAt.slice(0, 10)})` : ''}`
    );
  }
  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Profiles that came back wrong. Apify's run badge stays green when a profile
 * returns partially (13–15 Oct 2026), so emptiness and staleness are checked
 * here instead of trusted there.
 *
 * @param {{handle: string, posts: {timestamp: string}[]}[]} profiles
 * @param {string[]} handles every handle the run asked for
 * @param {Date} now
 * @param {number} staleDays
 */
export function checkHealth(profiles, handles, now, staleDays) {
  const byHandle = new Map(profiles.map((p) => [p.handle, p]));
  const problems = [];

  for (const handle of handles) {
    const profile = byHandle.get(handle);
    if (!profile) {
      problems.push({ handle, problem: 'missing' });
      continue;
    }
    if (profile.posts.length === 0) {
      problems.push({ handle, problem: 'no-posts' });
      continue;
    }
    const newestAt = profile.posts
      .map((p) => p.timestamp)
      .sort()
      .at(-1);
    const ageDays = (now.getTime() - Date.parse(newestAt)) / 86_400_000;
    if (ageDays > staleDays) problems.push({ handle, problem: 'stale', newestAt });
  }

  return problems;
}
