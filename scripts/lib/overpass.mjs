/**
 * A polite Overpass client: rotates mirrors, backs off on the 429/5xx that the
 * public endpoints hand out freely, and caps each attempt so a hanging mirror
 * cannot stall a run indefinitely. Split out of `fetch-remote-places.mjs` so
 * that script stays about WHICH places are fetched rather than how.
 */

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export async function overpass(query, attempt = 0) {
  const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
  let res;
  let body;
  let status = 0;
  let ok = false;
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 30000); // some mirrors hang — cap the wait
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        signal: ac.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'reIS-mendelu-remote-places-fetch/1.0 (https://github.com/reis-mendelu)',
        },
        body: 'data=' + encodeURIComponent(query),
      });
      // Read the BODY inside the timed block too. Clearing the timer once the
      // headers land leaves the body read unbounded, and a mirror that stalls
      // mid-stream then hangs the run forever — the exact failure the abort
      // exists to prevent. Parsing here also routes a truncated or non-JSON
      // response into the retry/rotate path below instead of throwing raw.
      status = res.status;
      ok = res.ok;
      if (res.ok) body = await res.json();
    } finally {
      clearTimeout(to);
    }
  } catch (e) {
    if (attempt < 8) {
      await new Promise((r) => setTimeout(r, 3000));
      return overpass(query, attempt + 1);
    }
    throw e;
  }
  // 429 (rate limit) and 5xx (overloaded/timeout) are transient — back off and
  // rotate to the next mirror.
  if ((status === 429 || status >= 500) && attempt < 8) {
    const wait = 3000 * (attempt + 1);
    console.warn(`  HTTP ${status} from ${endpoint}, retrying in ${wait / 1000}s…`);
    await new Promise((r) => setTimeout(r, wait));
    return overpass(query, attempt + 1);
  }
  if (!ok) throw new Error(`Overpass HTTP ${status}`);
  return body;
}
