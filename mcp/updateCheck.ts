// A .mcpb installed from GitHub never updates itself, so the server tells the
// student when a newer release exists (Dominik, 2026-11-20). One anonymous GET
// to GitHub per server start, nothing about the student in it; any failure is
// silent. The plugin build swaps this module for updateCheckOff.ts: Claude's
// plugin directory updates the plugin on its own.

export const LATEST_RELEASE_URL =
  'https://api.github.com/repos/reis-mendelu/reis-for-claude/releases/latest';
const GUIDE_URL = 'https://reisapp.cz/navody/reis-v-claude';

export const updateNotice = (version: string) =>
  `Je venku nová verze reIS for Claude (${version}): ${GUIDE_URL} · A new version is out.`;

const parts = (v: string) => v.split('.').map(Number);

/** True when `a` is a later X.Y.Z than `b`. */
export function isNewer(a: string, b: string): boolean {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

/** The notice when GitHub's latest release is newer than `current`, else null. Never throws. */
export async function checkForUpdate(
  current: string,
  fetchImpl: typeof fetch,
  timeoutMs = 3000
): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(LATEST_RELEASE_URL, {
      method: 'GET',
      headers: { accept: 'application/vnd.github+json' },
      credentials: 'omit',
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const { tag_name } = (await res.json()) as { tag_name?: unknown };
    const m = typeof tag_name === 'string' && /^(?:mcp-)?v(\d+\.\d+\.\d+)$/.exec(tag_name);
    return m && isNewer(m[1]!, current) ? updateNotice(m[1]!) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Starts the check once and returns a synchronous getter: a tool call never
 * waits for GitHub, it only picks up the answer once it has arrived.
 */
export function startUpdateCheck(current: string, fetchImpl: typeof fetch): () => string | null {
  let notice: string | null = null;
  void checkForUpdate(current, fetchImpl).then((n) => (notice = n));
  return () => notice;
}
