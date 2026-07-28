---
name: verify-ui
description: Use when building, reshaping, or reviewing any reIS screen or component — before proposing a design, after any visual change, and before claiming UI work is done. Covers screenshotting at mobile widths, measuring geometry, and catching invisible surfaces/text in the dark theme.
---

# Verifying reIS UI

Screenshots lie. A hidden preview pane returns stale frames, and dark-theme
tokens that differ in the source can be identical on screen. Measure instead.

## Before you design anything

1. **Ask whether a mockup already exists.** Claude Design screenshots, a
   vendored prototype under `_figma_desing/`, or an earlier spec. Two full
   design rounds have been thrown away for want of this one question.
2. **Show a cheap mock before building.** Describe or sketch the direction and
   get a yes. Do not write utils, tests, and components for a layout nobody has
   seen — a rejected spine cost 7 tests and 2 components.
3. **One todo per correction.** When a batch of pinned-element fixes arrives,
   record each as a task before touching code. Corrections arriving mid-verification
   are the normal case, not the exception.

## Running the check

The dev webapp must be serving. Start it with `preview_start` (config
`reis-webapp`, autoPort) — never with Bash — then pass the assigned port:

```bash
npm run verify:ui -- <label> --view exams --url http://localhost:<port>
```

| Flag | Default | Notes |
|------|---------|-------|
| `--widths` | `320,390,430` | Fixed set. Don't invent widths per run — results stop being comparable. |
| `--view` | current | Seeded into IndexedDB (`meta.reis_current_view`), then reloaded. |
| `--theme` | dark | `dark` \| `light`. Seeds `meta.reis_theme`. |
| `--click` | — | Text to click after load, e.g. opening a drawer. |
| `--onboarding` | off | Keep the welcome modal. Off by default: it blocks the whole page. |
| `--wait` | 600 | ms to settle after navigation. |

Output always lands in `.verify/` (gitignored), **wiped at the start of every
run**, with every path printed absolute. Exit code is 1 when there are errors.

## Reading the output

- **`overflow` / `overflow-element`** — errors. The page scrolls sideways, or a
  named element sticks out past the viewport.
- **`collision`** — error. Two text boxes overlap by more than 40%.
- **`contrast-surface`** — warn. A background differs from its backdrop but is
  invisible (< 1.05:1). This is the recurring reIS bug: **`bg-base-300` on a
  `base-200` surface is 1.006:1 in the dark theme** — a divider or card painted
  that way cannot be seen. Elements that reuse their backdrop's exact colour are
  not flagged; only a *different* colour that fails to read.
- **`contrast-text`** — warn. Below WCAG AA (4.5:1, or 3:1 for large text).

Occluded elements are skipped, so findings describe what is actually on screen.

## Rules

- **Never judge a change from a screenshot alone.** Read the findings. Pixels
  in a stale or hidden frame have produced false reports before.
- **Re-run after every visual change**, not once at the end.
- **Never report a finding you have not seen in the current run's output.**
  Check the printed absolute path matches the run you are talking about.
- Put geometry logic in a tested pure module (`scripts/lib/`, `src/utils/`) and
  keep components thin. Every real geometry bug in this project was caught by a
  unit test or by this script — none by reading code.
- Real exam data is seasonal and usually absent from the snapshot — a July
  scrape leaves the Exams screen permanently empty. Start the `reis-webapp-exams`
  preview config (`npm run dev:web:exams`) for a populated screen instead of
  hand-editing `public/dev-real-data.json`.

## Fixtures

`REIS_FIXTURE=<name>` makes the dev harness serve `dev/fixtures/<name>.json`
overlaid on the real snapshot, so synthetic exams sit alongside real subjects
and files. Fixtures are synthetic and committed; dates are authored as
`dayOffset` from today and materialised by `scripts/lib/fixtureRebase.ts`, so
they never rot. Supported offset keys on a term: `dayOffset`,
`regStartDayOffset`, `regEndDayOffset`, `deregDayOffset` (+ `deregTime`).

Add a fixture by dropping a JSON file in `dev/fixtures/` — no plumbing needed.

## Extending it

Thresholds and judgements live in `scripts/lib/uiFindings.ts` (pure, unit
tested). Colour maths lives in `scripts/lib/contrast.ts`. The browser side of
`scripts/shot.ts` only reads numbers — add a measurement there, add the rule and
its test in `uiFindings.ts`.
