# Scraper-Context Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Claude reliably treat `../reis-scraper` as the source of truth for IS Mendelu/WebISKAM data, by firing two deterministic Claude Code hooks instead of relying on CLAUDE.md prose.

**Architecture:** Two standalone Python hook scripts in `.claude/hooks/`, wired into `.claude/settings.json`, following the exact style of the existing `.claude/hooks/guard-parsers.py` (stdlib-only, reads JSON payload from stdin, prints a `hookSpecificOutput` JSON response, exits 0). One fires on `UserPromptSubmit` (keyword match → non-blocking `additionalContext`), the other on `PreToolUse` for `Edit|Write` (file-path match → `permissionDecision: "ask"`).

**Tech Stack:** Python 3 (stdlib only: `json`, `re`, `sys` — no new dependencies), Claude Code hooks (`.claude/settings.json`).

## Global Constraints

- No new dependencies — stdlib only, matching `guard-parsers.py`.
- Hook scripts must exit `0` and silently no-op (no stdout) when they don't match, exactly like `guard-parsers.py` does for non-protected paths — a hook that errors or hangs blocks every prompt/edit in the repo.
- `UserPromptSubmit` output must omit the top-level `decision` field entirely (never block a prompt) — this hook is informational only.
- `PreToolUse` output must never use `"deny"` — only `"ask"`, since this is a nudge, not a block.
- File patterns in the new file hook must not overlap with `guard-parsers.py`'s existing `PROTECTED` list (`src/api/documents/parser.ts`, `src/api/cvicneTests.ts`, `src/api/search/*Parser*.ts`, `src/utils/parsers/`) — avoid double-nagging the same edit.
- Spec reference: `docs/superpowers/specs/2026-07-06-scraper-context-hooks-design.md`.

---

## Task 1: `UserPromptSubmit` keyword-nudge hook

**Files:**
- Create: `.claude/hooks/nudge-scraper-prompt.py`

**Interfaces:**
- Consumes: stdin JSON payload with a `"prompt"` field (confirmed field name — Claude Code `UserPromptSubmit` hooks receive `{"prompt": "<user's submitted text>", ...}`).
- Produces: stdout JSON `{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "<string>"}}` on match, or exits silently (code 0, no stdout) on no match/bad input.

- [ ] **Step 1: Write the script**

Create `.claude/hooks/nudge-scraper-prompt.py`:

```python
#!/usr/bin/env python3
"""UserPromptSubmit hook: nudge Claude toward reis-scraper as the source of
truth for IS Mendelu / WebISKAM data, instead of relying on CLAUDE.md prose
alone (which wasn't reliably followed — see the design spec).

Fires only on a precise, literal keyword list scoped to the scraper's actual
CDN/crawl data pipeline. See
docs/superpowers/specs/2026-07-06-scraper-context-hooks-design.md.
"""
import json
import re
import sys

try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(0)

prompt = payload.get("prompt", "") or ""

KEYWORDS = (
    "reis-scraper", "scraper", "IS Mendelu", "webiskam", "ISKAM", "predmet",
    "erasmus", "syllabus", "tisk_dokumentu", "odevzdavarny", "success rate",
    "grade distribution", "harmonogram", "pruchod studiem", "zápočet",
    "zapocet", "seznam osnov",
)

if not any(re.search(re.escape(k), prompt, re.IGNORECASE) for k in KEYWORDS):
    sys.exit(0)

context = (
    "This task touches IS Mendelu / WebISKAM data. reis-scraper (private "
    "sibling repo, ../reis-scraper) is the source of truth — do not guess "
    "data shape or behavior from memory. Tiered guidance:\n"
    "1. Data-shape question (does this field exist, what does the response "
    "look like)? Check locally first: src/types/schemas/*.schema.ts and the "
    "public reis-data JSON / meta.json.\n"
    "2. Need real ground truth (actual HTML sample, sync-vs-async behavior, "
    "an IS Mendelu quirk)? Check ../reis-scraper: db/schema.sql, scripts/, "
    "its HTML/JSON fixtures.\n"
    "3. Changing scraper code, auth flow, or running a live crawl? Dispatch "
    "a sub-agent pointed at ../reis-scraper per /repos — never copy scraper "
    "code into the extension."
)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": context,
    }
}))
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x .claude/hooks/nudge-scraper-prompt.py`

- [ ] **Step 3: Verify no-match case (before wiring into settings.json)**

Run:
```bash
echo '{"prompt": "please run the vitest suite for the exam slice"}' | python3 .claude/hooks/nudge-scraper-prompt.py; echo "exit:$?"
```
Expected: no stdout output, `exit:0`.

- [ ] **Step 4: Verify match case**

Run:
```bash
echo '{"prompt": "does the erasmus response always include a country code?"}' | python3 .claude/hooks/nudge-scraper-prompt.py
```
Expected: a single line of JSON on stdout with `"hookEventName": "UserPromptSubmit"` and an `"additionalContext"` string starting with `"This task touches IS Mendelu / WebISKAM data."` Pipe through `python3 -m json.tool` to confirm it's valid JSON:
```bash
echo '{"prompt": "does the erasmus response always include a country code?"}' | python3 .claude/hooks/nudge-scraper-prompt.py | python3 -m json.tool
```
Expected: pretty-printed JSON, no errors.

- [ ] **Step 5: Verify malformed-input case doesn't crash**

Run:
```bash
echo 'not json' | python3 .claude/hooks/nudge-scraper-prompt.py; echo "exit:$?"
```
Expected: no stdout, `exit:0`.

- [ ] **Step 6: Commit**

```bash
git add .claude/hooks/nudge-scraper-prompt.py
git commit -m "feat(hooks): add UserPromptSubmit nudge toward reis-scraper as source of truth"
```

---

## Task 2: `PreToolUse` file-edit nudge hook

**Files:**
- Create: `.claude/hooks/nudge-scraper-files.py`

**Interfaces:**
- Consumes: stdin JSON payload with `tool_input.file_path` (same shape `guard-parsers.py` already reads successfully for `Edit|Write`).
- Produces: stdout JSON `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "ask", "permissionDecisionReason": "<string>"}}` on match, or exits silently on no match/bad input.

- [ ] **Step 1: Write the script**

Create `.claude/hooks/nudge-scraper-files.py`:

```python
#!/usr/bin/env python3
"""PreToolUse hook for Edit|Write: nudge toward cross-checking reis-scraper
before editing files whose correctness depends on real IS Mendelu data shape.

Scope is evidence-based off the "real Zod schema (was z.custom no-op)" PR
series (#115-122) — the files where guessing the shape already caused bugs.
Deliberately excludes files guard-parsers.py already gates, to avoid
double-nagging on the same edit. See
docs/superpowers/specs/2026-07-06-scraper-context-hooks-design.md.
"""
import json
import re
import sys

try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(0)

path = (payload.get("tool_input") or {}).get("file_path", "") or ""

PATTERNS = (
    r"src/types/schemas/\w+\.schema\.ts$",
    r"src/types/storage\.ts$",
    r"src/api/successRate\.ts$",
    r"src/api/successRate\.validators\.ts$",
    r"src/api/successRate/",
    r"src/api/erasmus\.ts$",
    r"src/api/syllabus\.ts$",
    r"src/api/syllabusTransfer\.ts$",
    r"src/api/odevzdavarny\.ts$",
)
if not any(re.search(p, path) for p in PATTERNS):
    sys.exit(0)

reason = (
    "This file's correctness depends on real IS Mendelu data shape. "
    "Cross-check ../reis-scraper (db/schema.sql, scripts/, fixtures) or the "
    "existing Zod schema before assuming a shape. Confirm only once you've "
    "verified."
)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": reason,
    }
}))
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x .claude/hooks/nudge-scraper-files.py`

- [ ] **Step 3: Verify no-match case**

Run:
```bash
echo '{"tool_input": {"file_path": "src/api/googleDrive.ts"}}' | python3 .claude/hooks/nudge-scraper-files.py; echo "exit:$?"
```
Expected: no stdout, `exit:0`.

- [ ] **Step 4: Verify match case — schema file**

Run:
```bash
echo '{"tool_input": {"file_path": "src/types/schemas/erasmus.schema.ts"}}' | python3 .claude/hooks/nudge-scraper-files.py | python3 -m json.tool
```
Expected: valid JSON with `"permissionDecision": "ask"` and a `"permissionDecisionReason"` starting with `"This file's correctness depends on real IS Mendelu data shape."`

- [ ] **Step 5: Verify match case — successRate directory**

Run:
```bash
echo '{"tool_input": {"file_path": "src/api/successRate/index.ts"}}' | python3 .claude/hooks/nudge-scraper-files.py; echo "exit:$?"
```
Expected: JSON output (match), `exit:0`.

- [ ] **Step 6: Verify no double-nag on already-guarded parser files**

Run:
```bash
echo '{"tool_input": {"file_path": "src/api/documents/parser.ts"}}' | python3 .claude/hooks/nudge-scraper-files.py; echo "exit:$?"
```
Expected: no stdout from *this* script (code 0) — confirms `nudge-scraper-files.py`'s own `PATTERNS` don't overlap with `guard-parsers.py`'s `PROTECTED` list. (`guard-parsers.py` still independently fires on this same path when both hooks run together in Task 3 — that's expected and correct.)

- [ ] **Step 7: Commit**

```bash
git add .claude/hooks/nudge-scraper-files.py
git commit -m "feat(hooks): add PreToolUse nudge toward reis-scraper on IS-data-shape file edits"
```

---

## Task 3: Wire both hooks into `.claude/settings.json`

**Files:**
- Modify: `.claude/settings.json`

**Interfaces:**
- Consumes: the two scripts created in Tasks 1 and 2 (`.claude/hooks/nudge-scraper-prompt.py`, `.claude/hooks/nudge-scraper-files.py`).
- Produces: a working `settings.json` hooks configuration that fires both alongside the existing `guard-parsers.py`.

The current file (verified via `Read` before this plan was written):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 .claude/hooks/guard-parsers.py",
            "timeout": 5
          }
        ]
      }
    ]
  },
  "worktree": {
    "bgIsolation": "none"
  },
  "enabledPlugins": {
    "code-review@claude-plugins-official": true,
    "supabase@claude-plugins-official": true
  }
}
```

- [ ] **Step 1: Add the new file hook to the existing `PreToolUse` matcher, and add a new `UserPromptSubmit` block**

Replace the `"hooks"` top-level object with:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 .claude/hooks/guard-parsers.py",
            "timeout": 5
          },
          {
            "type": "command",
            "command": "python3 .claude/hooks/nudge-scraper-files.py",
            "timeout": 5
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 .claude/hooks/nudge-scraper-prompt.py",
            "timeout": 5
          }
        ]
      }
    ]
  },
  "worktree": {
    "bgIsolation": "none"
  },
  "enabledPlugins": {
    "code-review@claude-plugins-official": true,
    "supabase@claude-plugins-official": true
  }
}
```

(No `"matcher"` key on the `UserPromptSubmit` entry — this event isn't a tool call and doesn't use matchers, per Claude Code's hooks reference.)

- [ ] **Step 2: Validate the JSON is well-formed**

Run: `python3 -m json.tool .claude/settings.json`
Expected: pretty-printed JSON, no parse errors.

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "chore(hooks): wire scraper-context nudge hooks into settings.json"
```

---

## Task 4: End-to-end verification in a live session

**Files:** none (manual verification only — hooks are session-level config, not unit-testable in isolation from the harness).

- [ ] **Step 1: Restart / start a fresh Claude Code session in this repo** so `settings.json` is reloaded.

- [ ] **Step 2: Submit a prompt containing a trigger keyword**, e.g. "what does the erasmus success-rate response look like for a course with no fail grades?"

Expected: the next assistant turn's context includes the `additionalContext` reminder text from Task 1 (visible as a system-reminder-style block, not as a literal chat message).

- [ ] **Step 3: Ask Claude to edit `src/api/erasmus.ts`** (a trivial edit, e.g. adding a comment).

Expected: a permission prompt appears with the reason text from Task 2 ("This file's correctness depends on real IS Mendelu data shape...").

- [ ] **Step 4: Ask Claude to edit an unrelated file**, e.g. `src/api/googleDrive.ts`.

Expected: no nudge prompt from either new hook (only whatever normal edit permissions already apply).

- [ ] **Step 5: Ask Claude to edit `src/api/documents/parser.ts`**.

Expected: only the existing `guard-parsers.py` "ask" prompt appears (parser-rules reason) — not a second, separate prompt from `nudge-scraper-files.py`.

- [ ] **Step 6: Record the verification result** by noting in the PR/commit description (or directly to the user) that all four manual checks passed, per `superpowers:verification-before-completion`.

No commit for this task — it's manual verification of already-committed work.
