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
