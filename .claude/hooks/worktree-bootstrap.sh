#!/usr/bin/env bash
# SessionStart: make a git worktree usable without a full reinstall.
#
# Worktrees start with only tracked files, so everything gitignored is missing:
# node_modules, the scraped dev snapshot, .env. The failure mode is quiet rather
# than loud — Vite 403s on @fontsource/inter and the app renders in a fallback
# typeface, or dev:web serves index.html for the missing snapshot and the UI
# silently falls back to stale IndexedDB. Both have cost real debugging time.
#
# Links (never copies) from the main checkout, and only when the target is
# actually missing. Prints what it did so the session knows.

set -uo pipefail

# The common git dir is the MAIN checkout's .git even from inside a worktree.
common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
main_root=$(dirname "$common_dir")

# The WORKTREE ROOT, not the cwd. A session with a persisted working directory
# fires this hook from wherever it last was, and `pwd` would then create
# src/api/node_modules while leaving the real worktree root empty. Derived from
# git rather than $CLAUDE_PROJECT_DIR so the hook is also correct when run by
# hand or from a test, where that variable is unset.
here=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -n "$here" ] || exit 0

# Not a worktree (or somehow the main checkout itself) — nothing to do.
[ "$main_root" = "$here" ] && exit 0
[ -d "$main_root" ] || exit 0

linked=()

link_if_missing() {
  local rel="$1"
  local src="$main_root/$rel"
  local dst="$here/$rel"
  [ -e "$src" ] || return 0
  # A dangling symlink counts as missing; -e follows links.
  if [ -e "$dst" ]; then return 0; fi
  [ -L "$dst" ] && rm -f "$dst"
  ln -s "$src" "$dst" 2>/dev/null && linked+=("$rel")
}

# node_modules is the expensive one. Treat a near-empty directory as missing:
# a partial install produces the same silent 403s as no install at all.
if [ -d "$here/node_modules" ] && [ ! -L "$here/node_modules" ]; then
  count=$(find "$here/node_modules" -maxdepth 1 -mindepth 1 2>/dev/null | wc -l | tr -d ' ')
  if [ "${count:-0}" -lt 50 ]; then
    rm -rf "$here/node_modules"
  fi
fi
link_if_missing "node_modules"

# Gitignored dev inputs: the real-data snapshot and the scraper credentials.
link_if_missing "public/dev-real-data.json"
link_if_missing ".env"

if [ ${#linked[@]} -gt 0 ]; then
  echo "worktree bootstrap: linked ${linked[*]} from $main_root"
  case " ${linked[*]} " in
    *" node_modules "*)
      echo "  node_modules is shared with the main checkout — if this branch changes dependencies, run 'npm ci' here instead."
      ;;
  esac
fi

exit 0
