#!/usr/bin/env bash
# Has anyone changed prod outside supabase/migrations? Builds a throwaway
# database from exactly the migrations prod's ledger says are applied (not the
# branch's newest files, which may still be pending), then compares it with
# prod: `db diff` for the schema, the fingerprint for grants, policies, buckets
# and the cron job. Read-only against prod. Runs nightly (db-drift.yml) and by
# hand:
#
#   npm run db:drift
#
# Uses its own project_id and ports, so it never touches the repo's local stack
# or another worktree's.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
REF="${SUPABASE_PROJECT_REF:-zvbpgkmnrqyprtkyxkwn}"
W=$(mktemp -d)
sb() { if command -v supabase >/dev/null; then supabase "$@"; else npx supabase "$@"; fi; }
cleanup() { sb stop --workdir "$W" --no-backup >/dev/null 2>&1 || true; rm -rf "$W"; }
trap cleanup EXIT

# 1. What prod says it has applied.
raw=$(sb db query --linked --project-ref "$REF" \
  "select version from supabase_migrations.schema_migrations order by version" 2>&1) \
  || { echo "FAILED: could not read prod's ledger:" >&2; echo "$raw" >&2; exit 1; }
applied=$(sed -n '/^{/,$p' <<<"$raw" | jq -er '.rows[].version') \
  || { echo "FAILED: no ledger rows in:" >&2; echo "$raw" >&2; exit 1; }

# 2. Those files, and only those, into a separate workdir.
mkdir -p "$W/supabase/migrations"
cat >"$W/supabase/config.toml" <<'EOF'
project_id = "reis-drift"
[api]
port = 56321
[db]
port = 56322
shadow_port = 56320
major_version = 17
[db.pooler]
port = 56329
[db.seed]
enabled = false
[studio]
port = 56323
[local_smtp]
port = 56324
[analytics]
enabled = false
port = 56327
EOF
missing=0
for v in $applied; do
  f=$(ls supabase/migrations/"${v}"_*.sql 2>/dev/null | head -1 || true)
  if [ -z "$f" ]; then echo "DRIFT: prod's ledger has $v, which is not in supabase/migrations" >&2; missing=1
  else cp "$f" "$W/supabase/migrations/"; fi
done
[ "$missing" -eq 0 ] || exit 1
for f in supabase/migrations/*.sql; do
  v=$(basename "$f" | cut -c1-14)
  grep -qx "$v" <<<"$applied" || echo "pending (not in prod yet, applies at the next release): $(basename "$f")"
done

# 3. Schema.
diff_out=$(sb db diff --linked --project-ref "$REF" --workdir "$W" -s public 2>&1) \
  || { echo "FAILED: db diff errored:" >&2; echo "$diff_out" >&2; exit 1; }
if ! grep -q "No schema changes found" <<<"$diff_out"; then
  echo "DRIFT: prod's public schema differs from its applied migrations:" >&2
  echo "$diff_out" >&2
  exit 1
fi
echo "schema: no changes"

# 4. Grants, policies, buckets, cron.
sb start --workdir "$W" -x studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor,realtime </dev/null >/dev/null
SUPABASE_WORKDIR="$W" bash supabase/scripts/compare-fingerprint.sh
