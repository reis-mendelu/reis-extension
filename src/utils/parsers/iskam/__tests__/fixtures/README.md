# WebISKAM parser fixtures

**These are synthetic reconstructions, not real IS/WebISKAM captures.**

Each file was rebuilt from the assertions in the sibling `*.test.ts` files plus the
selector/column contract of the parser under test. They reproduce the DOM shape the
parsers rely on (`.vyskaRiadkuKonto`, `#tablePrevodyUhrady`, `#PozadavkyNaUhradyTable`,
`#tablePrehledUbytovani`, `a.pdf.uis-ds`) and contain only invented data.

## Why they exist

The tests previously read from `.agent/fixtures/`, which is gitignored — real IS HTML
contains real student data and must never be committed. That directory does not exist on
a fresh clone, so all five suites failed at collection time. Because vitest emits its
coverage report only on a fully green run, those failures also silently disabled
**coverage reporting for the entire repository**.

Synthetic fixtures make the suites hermetic: they run identically on any clone and in CI,
with no privacy exposure.

## What they do NOT prove

Passing these tests is **not** evidence that a parser handles real IS Mendelu HTML.
They are regression guards over the parsing logic, nothing more.

Per the Parser Rules in `CLAUDE.md`, any change to a parser still requires a real IS
Mendelu HTML sample as evidence. Do not treat a green run here as a substitute. If you
capture real HTML to validate a change, keep it in gitignored `.agent/` — never commit it.
