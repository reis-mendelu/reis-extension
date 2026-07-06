# Scraper-context hooks — design spec

## Problem

`reis-scraper` is the source of truth for real IS Mendelu / WebISKAM data shape and
behavior (CLAUDE.md, `/repos`). In practice Claude rarely consults it — across all
four modes: verifying data shape/behavior, building or changing a parser/API
integration, debugging a data-shape bug, and general task-start orientation.

Prose guidance already exists (CLAUDE.md "Multi-Repo Organization" section, the
`/repos` skill) and isn't sufficient — it depends on Claude recalling and applying it
at the right moment, which it doesn't reliably do. The fix needs to be deterministic:
fire automatically at the moment the task touches this surface, not rely on memory.

## Why the repo split itself is not the problem

`reis-extension` is **public** (`github.com/reis-mendelu/reis-extension`).
`reis-scraper` is **private** and contains WAF-evasion code (`debug-waf.js`,
`debug-waf-node.ts`), session cookies, and the full IS-Mendelu auth/crawl
methodology. Merging them would force either publishing the scraper (exposing the
scraping/WAF-evasion playbook to the university, risking a block) or making the
extension private (losing the free public security-scanning stack and the
"nothing leaves your browser" trust story a student-data extension relies on). A
monorepo or a git submodule both fail for the same reason: a public repo can't
host or reference private-repo internals safely. The sibling-repo layout is
correct; the actual gap is discoverability across that boundary, which these hooks
address directly.

## Design

Two new hook scripts in `.claude/hooks/`, wired into `.claude/settings.json`,
matching the existing style of `.claude/hooks/guard-parsers.py` (Python, reads
hook payload JSON from stdin, prints a `hookSpecificOutput` JSON response).

### 1. `nudge-scraper-prompt.py` — `UserPromptSubmit`

Reads the submitted prompt text and matches it against a precise, literal keyword
list kept as a constant at the top of the file (easy to widen later):

```
reis-scraper, scraper, IS Mendelu, webiskam, ISKAM, predmet, erasmus, syllabus,
tisk_dokumentu, odevzdavarny, success rate, grade distribution, harmonogram,
pruchod studiem, zápočet, zapocet, seznam osnov
```

Deliberately scoped to the scraper's actual CDN/crawl data pipeline. Deliberately
excludes generic words ("verify", "data", "field") that would make this fire on
unrelated prompts — the earlier CLAUDE.md prose already failed by being
un-targeted; a noisy hook would fail the same way, just louder. Also excludes the
parallel eduroam cert-install effort (not part of the scraper's crawl pipeline).

On match: emit non-blocking `additionalContext` (no permission gate — this is a
prompt, not a tool call) with tiered guidance matching the public/private
boundary:

1. **Data-shape question** ("does this field exist", "what does the response look
   like") → check locally first: `src/types/schemas/*.schema.ts` (already-hardened
   Zod schemas) and public `reis-data` JSON / `meta.json`.
2. **Ground-truth verification** (real HTML sample, sync-vs-async behavior, actual
   IS Mendelu quirk) → check the private `../reis-scraper` sibling:
   `db/schema.sql`, `scripts/`, its HTML/JSON fixtures. Do not guess.
3. **Changing scraper code, auth flow, or running a live crawl** → dispatch a
   sub-agent pointed at `../reis-scraper`, per `/repos`. Never copy scraper code
   into the extension.

### 2. `nudge-scraper-files.py` — `PreToolUse`, matcher `Edit|Write`

Fires on edits to extension files whose correctness depends on real IS Mendelu
data shape. Explicit include list, evidence-based off the recent "real Zod schema
(was z.custom no-op)" PR series (#115–122) — exactly the files where guessing the
shape without checking real data already caused problems:

- `src/types/schemas/*.schema.ts`
- `src/types/storage.ts`
- `src/api/successRate.ts`, `src/api/successRate.validators.ts`, `src/api/successRate/**`
- `src/api/erasmus.ts`
- `src/api/syllabus.ts`, `src/api/syllabusTransfer.ts`
- `src/api/odevzdavarny.ts`

Explicitly **excludes** files `guard-parsers.py` already gates
(`src/api/documents/parser.ts`, `src/api/cvicneTests.ts`,
`src/api/search/*Parser*.ts`, `src/utils/parsers/`) to avoid double-nagging on the
same edit.

On match: emit `permissionDecision: "ask"` (identical mechanism to
`guard-parsers.py`) with reason: this file's correctness depends on real IS
Mendelu data shape — cross-check `../reis-scraper` (`db/schema.sql`, `scripts/`,
fixtures) or the existing Zod schema before assuming a shape; confirm once
verified.

### Shared reasoning, not shared code

Both scripts duplicate their own short (~5 line) guidance string rather than
importing a shared module. Two files this small don't warrant an extra shared
module — matches the existing single-file-per-hook pattern already in this repo.

## Testing / verification

- Before finalizing, verify the exact `UserPromptSubmit` hook JSON contract
  (`hookSpecificOutput` field name for non-blocking additional-context injection)
  against current Claude Code hook documentation. The `PreToolUse` shape needs no
  verification — it's a direct copy of the working `guard-parsers.py` pattern.
- Manual test after implementation:
  - Prompt containing "erasmus stats" → `additionalContext` appears in the next
    turn's context.
  - Edit `src/api/erasmus.ts` → `ask` permission prompt appears with the reason
    text.
  - Edit `src/api/googleDrive.ts` (unrelated) → no prompt from either hook.
  - Edit `src/api/documents/parser.ts` → only `guard-parsers.py` fires, not the
    new file hook (no double-nag).

## Out of scope

- The `reis-scraper` internal modularization/refactor (script cruft, duplicated
  login/faculties/retry logic, stale SKILL.md reference) is a separate, larger
  piece of work with its own audit findings. It gets its own spec.
