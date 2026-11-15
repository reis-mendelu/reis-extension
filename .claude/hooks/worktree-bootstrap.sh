#!/usr/bin/env bash
# SessionStart: make a session's checkout current and usable.
#
# A session worktree starts with only tracked files, on a branch cut from main
# (the last release), next to a main checkout nobody works in. Left alone, each
# of those goes wrong quietly:
#
# - the branch is 20+ commits behind test, so fixed bugs get reported as new;
# - node_modules is missing or a version behind, so typecheck and tests fail in
#   ways that look like real bugs;
# - the dev snapshot and .env are missing, so dev:web serves a fallback;
# - the main checkout — where Claude reads this repo's skills, slash commands
#   and hooks from, whatever worktree the session is in — stays on whatever was
#   last checked out there. It sat 374 commits behind test for 54 days, serving
#   a /release that predated the store pipeline.
#
# Only what is actually wrong is touched, and what was done is printed.
# Tested by scripts/__tests__/worktreeBootstrap.test.ts.

set -uo pipefail
export GIT_TERMINAL_PROMPT=0

# The common git dir is the MAIN checkout's .git even from inside a worktree.
common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
main_root=$(dirname "$common_dir")
[ -d "$main_root" ] || exit 0

# The checkout this hook file lives in. Its scripts are the ones that match this
# hook, whichever branch the session's own worktree happens to be on.
hook_repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)

# The WORKTREE ROOT, not the cwd. A session with a persisted working directory
# fires this hook from wherever it last was, and `pwd` would then create
# src/api/node_modules while leaving the real worktree root empty. Derived from
# git rather than $CLAUDE_PROJECT_DIR so the hook is also correct when run by
# hand or from a test, where that variable is unset.
here=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -n "$here" ] || exit 0

lines=()

# A PARKED main checkout (detached HEAD, no edits to tracked files) follows
# origin/test. Detached is the opt-in: a checkout someone put on a branch is
# their work and is never moved — the hook only says how far behind it is.
# To park it: git -C <main checkout> checkout --detach origin/test
advance_parked_main() {
  git -C "$main_root" symbolic-ref -q HEAD >/dev/null 2>&1 && return 0
  [ -z "$(git -C "$main_root" status --porcelain --untracked-files=no 2>/dev/null)" ] || return 0
  git -C "$main_root" fetch -q origin test 2>/dev/null || return 0
  [ "$(git -C "$main_root" rev-parse HEAD 2>/dev/null)" = "$(git -C "$main_root" rev-parse origin/test 2>/dev/null)" ] && return 0
  git -C "$main_root" checkout -q --detach origin/test 2>/dev/null
}

note_unparked_main() {
  local branch behind
  branch=$(git -C "$main_root" symbolic-ref -q --short HEAD 2>/dev/null) || return 0
  behind=$(git -C "$main_root" rev-list --count HEAD..origin/test 2>/dev/null) || return 0
  [ "${behind:-0}" -gt 0 ] || return 0
  lines+=("worktree bootstrap: the main checkout is on '$branch', $behind commits behind origin/test. Skills, slash commands and hooks are read from it. Park it: git -C $main_root checkout --detach origin/test")
}

# The fetch is a network call, so it never holds up the session: this run's
# skills are already loaded, and the next session gets the result.
if [ "${REIS_BOOTSTRAP_SYNC:-}" = "1" ]; then
  advance_parked_main
else
  (advance_parked_main &) >/dev/null 2>&1
fi
note_unparked_main

report() {
  for line in ${lines[@]+"${lines[@]}"}; do echo "$line"; done
  exit 0
}

# The main checkout itself: nothing to bootstrap.
[ "$main_root" = "$here" ] && report

# Work starts from test (CLAUDE.md > Branches), and a session worktree is cut
# from main. Move the branch only when there is nothing a reset could lose:
# every commit on it is already in main, nothing is pushed, the tree is clean.
# A detached checkout is left alone — that is how to read released code.
move_fresh_branch_to_test() {
  local branch
  branch=$(git -C "$here" symbolic-ref -q --short HEAD 2>/dev/null) || return 0
  case "$branch" in main | test) return 0 ;; esac
  git -C "$here" rev-parse -q --verify origin/test >/dev/null 2>&1 || return 0
  git -C "$here" rev-parse -q --verify origin/main >/dev/null 2>&1 || return 0
  [ "$(git -C "$here" rev-parse HEAD)" = "$(git -C "$here" rev-parse origin/test)" ] && return 0
  git -C "$here" merge-base --is-ancestor HEAD origin/main 2>/dev/null || return 0
  git -C "$here" rev-parse -q --verify "refs/remotes/origin/$branch" >/dev/null 2>&1 && return 0
  [ -z "$(git -C "$here" status --porcelain 2>/dev/null)" ] || return 0
  git -C "$here" reset -q --hard origin/test 2>/dev/null || return 0
  lines+=("worktree bootstrap: '$branch' had no commits of its own and was cut from main; it now starts from origin/test ($(git -C "$here" rev-parse --short HEAD))")
}

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

# Before the install: the lockfile on test is the one to install for.
move_fresh_branch_to_test

# node_modules belongs to the worktree, so `npm ci` here touches nothing else.
# scripts/ensure-install.mjs copies an install that MATCHES this lockfile from
# another checkout (an APFS copy-on-write clone, ~20 s) and leaves a matching
# one alone; when nothing matches it says to run `npm ci`, which `npm run check`
# does by itself. It never copies a stale install and never leaves a partial one.
if command -v node >/dev/null 2>&1 && [ -f "$hook_repo/scripts/ensure-install.mjs" ]; then
  install_line=$(node "$hook_repo/scripts/ensure-install.mjs" "$here" 2>/dev/null)
  [ -n "$install_line" ] && lines+=("worktree bootstrap: $install_line")
fi

# Gitignored dev inputs: the real-data snapshot and the scraper credentials.
# These stay symlinks on purpose — they are read, never rewritten, and a link
# means a fresh scrape in the main checkout reaches every worktree at once.
linked=()
link_if_missing "public/dev-real-data.json"
link_if_missing ".env"
[ ${#linked[@]} -gt 0 ] && lines+=("worktree bootstrap: linked ${linked[*]} from $main_root")

report
