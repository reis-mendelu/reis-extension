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
