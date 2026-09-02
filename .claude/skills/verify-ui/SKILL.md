---
name: verify-ui
description: Use when building, reshaping, or reviewing any reIS screen or component — before proposing a design, after any visual change, and before claiming UI work is done. Covers screenshotting at phone and tablet widths, measuring geometry, and catching invisible surfaces/text in either theme.
---

# Verifying reIS UI

Screenshots lie. A hidden preview pane returns stale frames, an animation that
never got a frame leaves the element at its `initial` value, and dark-theme
tokens that differ in the source can be identical on screen. Measure instead.

**What this skill is not.** It measures a rendered screen. It cannot tell you
whether the screen is worth rendering. A layout can pass every check here and
still be six strings adrift in an empty iPad — that judgement is yours and the
user's, and it is made before you reach for this.

## Before you design anything

1. **Ask whether a mockup already exists.** Claude Design screenshots, a
   vendored prototype under `_figma_desing/`, or an earlier spec. Two full
   design rounds have been thrown away for want of this one question.
2. **Show a cheap mock before building.** Describe or sketch the direction and
   get a yes. Do not write utils, tests, and components for a layout nobody has
   seen — a rejected spine cost 7 tests and 2 components.
3. **Ask what fills the space before you decide how to divide it.** When a
   screen looks empty at a width, reach for content first and layout second. A
   full-bleed split, an ambient graphic or a bigger container will not fix a
   screen that has six strings in it; it only redistributes the emptiness.
4. **One todo per correction.** When a batch of pinned-element fixes arrives,
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
| `--widths` | `320,390,430` | The phone set. Add the tablet set for anything the iPad renders — see below. |
| `--view` | current | Seeded into IndexedDB (`meta.reis_current_view`), then reloaded. |
| `--theme` | dark | `dark` \| `light`. Seeds `meta.reis_theme`, mapped to the theme names the store accepts. |
| `--click` | — | Text to click after load, e.g. opening a drawer or driving a flow into its error state. |
| `--onboarding` | off | Keep the desktop welcome modal. Off by default: it blocks the whole page. |
| `--wait` | 600 | ms to settle after navigation. |

### Widths

The default `320,390,430` are all below the 767px phone breakpoint, so the dev
webapp renders the **phone** shell and that is what gets measured. Keep that set
fixed so phone runs stay comparable across changes.

**The app also ships the phone tree on iPad** (`resolvePhoneViewport` — being
the Capacitor app is the whole test, width is not consulted), so any screen with
`md:` classes has a second life at tablet size that the phone set cannot see. For
those, run the tablet set **in addition to**, never instead of, the phone one:

```bash
npm run verify:ui -- <label>-tablet --widths 834,1024,1194 --url http://localhost:<port>/?mobile=1
```

- `834` iPad portrait, `1194` iPad landscape, `1024` the shortest common iPad
  geometry (1024×768). Check `1024` in every state a card can reach: `#root` is
  `overflow: hidden !important`, so content taller than the viewport is silently
  clipped, not scrolled.
- `?mobile=1` pins the phone tree; without it, a ≥768px viewport in a browser
  renders the desktop tree, which is not what an iPad shows.

To measure the narrow *desktop* tree instead, append `?mobile=0` to `--url`.

## Reading the output

Output always lands in `.verify/` (gitignored), **wiped at the start of every
run**, with every path printed absolute. Exit code is 1 when there are errors.
Copy anything you want to keep out of `.verify/` before the next run.

- **`overflow` / `overflow-element`** — errors. The page scrolls sideways, or a
  named element sticks out past the viewport.
- **`collision`** — error. Two text boxes overlap by more than 40%.
- **`contrast-surface`** — warn. A background differs from its backdrop but is
  invisible (< 1.05:1). This is the recurring reIS bug, and it runs both ways:
  **`bg-base-300` on a `base-200` surface is 1.006:1 in the dark theme**, and
  **`base-100` on `base-200` is 1.03:1 in the light theme**. A divider or card
  painted that way cannot be seen. When a surface has to read in both themes,
  give it a `border-base-content/10` hairline rather than trusting the tone.
  Elements that reuse their backdrop's exact colour are not flagged; only a
  *different* colour that fails to read.
- **`contrast-text`** — warn. Below WCAG AA (4.5:1, or 3:1 for large text).
  `text-error` (#ef4444) on `base-100` is 3.90:1 — it fails, and no weight
  available at body size rescues it. Colour the glyph, not the sentence.

Occluded elements are skipped, so findings describe what is actually on screen.

## Known gaps — read before trusting a clean run

- **Capacitor-gated UI does not render here.** Anything behind
  `getPlatform().kind === 'capacitor'` is absent from every browser run, so a
  clean report says nothing about it. The eduroam card on the welcome screen is
  the standing example; it has a dev override (`?eduroam=ios` / `?eduroam=android`,
  DEV-only, in `src/mobile/eduroamNative.ts`) so the real screen is reachable.
  Where no such override exists, **say the screen was not measured** rather than
  reporting the run clean, and treat the device build as the gate.
- **`--theme light` used to be a silent no-op** — it seeded the literal string
  `light`, and `createThemeSlice` accepts only `mendelu` / `mendelu-dark` and
  falls back to dark for anything else, so the "light" run measured the dark
  theme. Fixed in `scripts/shot.ts`; a light run is now real. Sanity-check the
  first one by eye anyway.
- **The first run after an edit can capture the pre-edit module.** Three
  consecutive runs once photographed a button style that had already been
  replaced, and the finding was chased as a real one. Confirm the change is
  live — read the element's `className` through `javascript_tool` in the
  Browser pane — before believing a frame that contradicts the source.
- **A hidden Browser pane pauses `requestAnimationFrame`**, so `motion` elements
  stay at their `initial` values and screenshots show a half-built page. Front
  the tab (`tabs_select`) before judging anything animated — and treat that as a
  design finding too: an element whose visible state depends on an animation
  completing will also be missing on a device that boots the tab in the
  background. Animate toward the resting state, not away from nothing.

## Rules

- **Never judge a change from a screenshot alone.** Read the findings. Pixels
  in a stale or hidden frame have produced false reports before.
- **Re-run after every visual change**, not once at the end.
- **Never report a finding you have not seen in the current run's output.**
  Check the printed absolute path matches the run you are talking about. The
  converse holds too: never let a clean run imply coverage it did not have.
- Put geometry logic in a tested pure module (`scripts/lib/`, `src/utils/`) and
  keep components thin. Every real geometry bug in this project was caught by a
  unit test or by this script — none by reading code.
- Real exam data is seasonal and usually absent from the snapshot — a July
  scrape leaves the Exams screen permanently empty. Serve the exam fixture for a
  populated screen instead of hand-editing `public/dev-real-data.json`.
  `REIS_FIXTURE` is read from the process env at server start, so this one needs
  a background Bash server — there is no launch config for it:

  ```bash
  npm run dev:web:exams
  ```

  This is the documented exception to "never start the dev webapp with Bash";
  every other run uses the `reis-webapp` preview config.

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
