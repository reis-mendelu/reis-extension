# IS snímky: daily snapshots of Dominik's IS Mendelu and WebISKAM

Written every morning at 07:00 by the job in `reis-extension/scripts/snapshots/` on his Mac.
This file is overwritten by every run. To change it, edit `ARCHIVE-README.md` there.

## What is here

| Path | What |
|---|---|
| `changes.md` | One section per run (`## YYYY-MM-DD HH:MM`): how many pages were read, which changed, the lines each one gained, and any problem (`⚠`). |
| `days/<date>/is/<page>.txt` | The visible text of an IS page, saved **only on days it changed**. |
| `days/<date>/is/<page>.html` | The same page as IS served it. |
| `days/<date>/…/<page>@HHMM.*` | A second change on the same day (a run by hand), kept next to the morning's copy. |
| `days/<date>/webiskam/…` | The same for WebISKAM: `Konta` (balance), `InformaceOKlientovi` (claims, rent), `_menu` (its menu links). |
| `state.json` | For each page: the day it was last saved and last seen. |

**A page as it was on a given day** is its newest file in `days/` dated on or before that day.

## How to answer questions from it (for Claude)

- "When did X appear / open?" → `grep -n "X" changes.md`, then the dated section above the hit. The
  lines after `+` are what the page gained that day. Confirm in that day's `.txt`.
- "What did page P say on date D?" → newest `days/*/<site>/P.txt` with a date ≤ D.
- "When did the rent appear, and when was it paid?" → `grep -n "InformaceOKlientovi" changes.md`: the
  claim's line appears with `+` the day it was created, and `−1` the day it disappeared.
- A day with no section is a day the Mac was off. A `⚠` line says what could not be read.
- IS pages: `index` (home, IS notices), `vyveska`, `studium`, `moje-studium`, `study-plan`,
  `exam-terms`, `odevzdavarny`, `list` (subjects), `pruchod-*` (grades, stats), `prehled-tydnu`,
  `seznam-osnov`, `slozka-<id>` (a subject's folder), `zaznamnik-<id>-…` (a subject's points).

What is never here: classmates' lists, exam sign-up lists (other students' names), the catalogue,
the password, cookies.
