#!/usr/bin/env python3
"""PreToolUse hook for Edit|Write: gate edits to brittle HTML parsers.

Enforces the rule from CLAUDE.md "Parser Rules" — parsers must not be
modified to silence lint/vitest errors. Returns permissionDecision:"ask"
so the user has to confirm; the rule text is shown as the reason.
"""
import json
import re
import sys

try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(0)

path = (payload.get("tool_input") or {}).get("file_path", "") or ""

PROTECTED = (
    r"src/api/documents/parser\.ts$",
    r"src/api/ukoly\.ts$",
    r"src/api/osnovy\.ts$",
    r"src/utils/parsers/",
)
if not any(re.search(p, path) for p in PROTECTED):
    sys.exit(0)

reason = (
    "Protected parser file (CLAUDE.md > Parser Rules). "
    "Do NOT modify the parser to fix a lint or vitest error — suppress the rule "
    "or fix the test fixture instead. Any change requires a real IS Mendelu HTML "
    "sample as evidence. Confirm only if you have that evidence."
)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": reason,
    }
}))
