#!/usr/bin/env bash
# Runs catalog_fingerprint.sql against prod (read-only) and the local stack, and
# diffs the two. Fails closed: a CLI error, unparsable output or a suspiciously
# short result stops it before any comparison, so two failures can never
# "match". Needs a running local stack (`npx supabase start`).
#
#   npm run db:fingerprint
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
SQL=supabase/scripts/catalog_fingerprint.sql
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

fingerprint() { # $1 = --linked | --local, $2 = output file
  local raw
  if ! raw=$(npx supabase db query "$1" -f "$SQL" 2>&1); then
    echo "FAILED: supabase db query $1 exited non-zero:" >&2
    echo "$raw" >&2
    exit 1
  fi
  if ! sed -n '/^{/,$p' <<<"$raw" | jq -er '.rows[].line' >"$2"; then
    echo "FAILED: no fingerprint rows in the $1 output:" >&2
    echo "$raw" >&2
    exit 1
  fi
  # Prod had 359 lines on 2026-10-16; every build has the cron job and a bucket.
  if [ "$(wc -l <"$2")" -lt 100 ] || ! grep -q '^cron ' "$2" || ! grep -q '^bucket ' "$2"; then
    echo "FAILED: the $1 fingerprint is incomplete ($(wc -l <"$2") lines)" >&2
    exit 1
  fi
}

fingerprint --linked "$OUT/prod.txt"
fingerprint --local "$OUT/local.txt"

if diff "$OUT/prod.txt" "$OUT/local.txt"; then
  echo "SAME: $(wc -l <"$OUT/prod.txt" | tr -d ' ') lines, prod = local"
else
  echo "DIFFERENT: lines marked < are prod only, > local only" >&2
  exit 1
fi
