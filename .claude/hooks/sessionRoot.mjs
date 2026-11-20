/**
 * Not a hook: the helper the Stop hooks use to find the checkout they are about.
 *
 * Claude desktop starts every session with --project-config-root <main
 * checkout>, so a project hook runs with its process cwd (and
 * $CLAUDE_PROJECT_DIR) set to the MAIN checkout, whichever worktree the session
 * is in. Only the `cwd` field of the hook input names the session's own
 * directory (PR #715). A hook that runs git or reads `src/` relative to its own
 * cwd therefore inspects the main checkout, finds nothing, and exits 0 — which
 * looks exactly like a pass.
 *
 * `enterSessionRoot` moves the process into the worktree root of the input's
 * `cwd`, so every git call AND every relative read after it (import closures,
 * privacy/disclosures.ts, the ask-once marker's git dir) is about the session.
 * With no usable `cwd` — run by hand, or outside a repository — it stays where
 * it is, as before.
 */
import { execFileSync } from 'node:child_process';

export const enterSessionRoot = (payload) => {
  const cwd = payload && typeof payload.cwd === 'string' ? payload.cwd : '';
  if (!cwd) return process.cwd();
  try {
    const root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (root) process.chdir(root);
  } catch {
    /* not a repository, or gone: keep the process cwd */
  }
  return process.cwd();
};
