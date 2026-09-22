#!/usr/bin/env bash
# SessionStart: make a git worktree usable without a full reinstall.
#
# Worktrees start with only tracked files, so everything gitignored is missing:
# node_modules, the scraped dev snapshot, .env. The failure mode is quiet rather
# than loud — Vite 403s on @fontsource/inter and the app renders in a fallback
# typeface, or dev:web serves index.html for the missing snapshot and the UI
# silently falls back to stale IndexedDB. Both have cost real debugging time.
#
# node_modules is CLONED; the read-only dev inputs are linked. Only what is
# actually missing is touched, and what was done is printed.

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
cloned=()
notes=()

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

# How many top-level entries a directory has. A partial install produces the
# same silent 403s as no install at all, so "nearly empty" counts as missing at
# both ends of the copy.
entry_count() {
  [ -d "$1" ] || { echo 0; return 0; }
  find "$1" -maxdepth 1 -mindepth 1 2>/dev/null | wc -l | tr -d ' '
}

# node_modules is CLONED rather than symlinked, and that is the whole point of
# this function.
#
# A symlink made every worktree share the main checkout's single install. That
# is fine for as long as every session only READS it, and catastrophic the
# moment one runs `npm ci`: that deletes and rebuilds the whole tree underneath
# every other session. Two sessions doing it at once is worse still — they tear
# down each other's half-built trees, npm dies with ENOTEMPTY, and what is left
# is a directory that looks installed and cannot resolve `react`. That is not
# hypothetical; it happened across fourteen worktrees and emptied the main
# checkout's tree with it.
#
# `cp -c` is an APFS clone: copy-on-write, so it is near-instant and costs
# almost no disk until the two trees diverge. Each worktree can then run
# `npm ci` freely, because it owns its own copy.
clone_node_modules() {
  local src="$main_root/node_modules"
  local dst="$here/node_modules"

  # An earlier partial clone, or a tree some failed install left behind. It
  # would resolve some imports and 403 on the rest, which is the hardest of the
  # three states to debug — so treat it as missing and redo it.
  if [ -d "$dst" ] && [ ! -L "$dst" ] && [ "$(entry_count "$dst")" -lt 50 ]; then
    rm -rf "$dst"
  fi
  # A symlink from before this hook cloned: leave a real install alone, but a
  # dangling or now-empty link is worth replacing.
  if [ -L "$dst" ] && [ "$(entry_count "$dst")" -lt 50 ]; then
    rm -f "$dst"
  fi
  [ -e "$dst" ] && return 0

  if [ "$(entry_count "$src")" -lt 50 ]; then
    notes+=("node_modules: nothing usable to copy from $main_root — run 'npm ci' here.")
    return 0
  fi

  if cp -Rc "$src" "$dst" 2>/dev/null; then
    cloned+=("node_modules")
    return 0
  fi

  # Not APFS, or clonefile refused. A real copy would be minutes and gigabytes,
  # so fall back to the old shared symlink — and say what that costs, because it
  # is the arrangement the clone exists to avoid.
  [ -L "$dst" ] && rm -f "$dst"
  if ln -s "$src" "$dst" 2>/dev/null; then
    linked+=("node_modules")
    notes+=("node_modules is SHARED with the main checkout (clone unavailable). Do NOT run 'npm ci' here — it rebuilds the tree under every other worktree. Install in the main checkout, with no other session running.")
  fi
}

clone_node_modules

# Gitignored dev inputs: the real-data snapshot and the scraper credentials.
# These stay symlinks on purpose — they are read, never rewritten, and a link
# means a fresh scrape in the main checkout reaches every worktree at once.
link_if_missing "public/dev-real-data.json"
link_if_missing ".env"

[ ${#cloned[@]} -gt 0 ] && echo "worktree bootstrap: cloned ${cloned[*]} from $main_root (APFS copy-on-write — this worktree owns it, 'npm ci' here is safe)"
[ ${#linked[@]} -gt 0 ] && echo "worktree bootstrap: linked ${linked[*]} from $main_root"
for note in ${notes[@]+"${notes[@]}"}; do echo "  $note"; done

exit 0
