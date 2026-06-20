# eduroam drawer redesign

**Date:** 2026-06-20
**Status:** Approved design → ready for implementation plan

## Context

The eduroam setup drawer currently uses a 2×2 device segment grid and four
separate panel components (`IosTransfer`, `AndroidTransfer`, `MacInstall`,
`WindowsInstall`), each rendering a DaisyUI `steps steps-vertical` list. A new
visual design was authored in Claude Design ("Install eduroam.dc.html", project
*RIS Extension Onboarding*) that reframes the flow as a **vertical device
accordion** (Step 1) that expands into a **richer numbered tutorial** (Step 2)
with a "do once" geteduroam block, per-step warnings, a password chip, and
screenshot placeholders.

This redesign adopts that template's structure and feel while keeping all real
functionality from `useEduroamSetup` (cert fetch, mobileconfig/eap-config
generation, one-time transfer + QR, local download, password handling). The goal
is a friendlier, walk-through-style setup that still does the exact same work.

## Decisions (locked)

- **Theme:** reproduce the design with DaisyUI semantic tokens (`base-100/200/300`,
  `primary`, `secondary`, `warning`, `success`), not hardcoded hex. Theme-aware
  (works in `mendelu` light + `mendelu-dark`); honors the no-custom-CSS iron rule.
  The design's palette already maps 1:1 onto `mendelu-dark`.
- **Screenshots:** keep the 16:9 dashed placeholder boxes with captions for now
  (real screenshots can replace them later).
- **Language:** drive all strings from `useTranslation()` / global language. No
  per-drawer CZ/EN toggle. The template's reIS-logo header is dropped (the drawer
  already has its own header + close).
- **Mac host gating:** dropped, matching the recent Windows simplification. No
  `isMac` disable and no host hint — the accordion is device-centric.
- **Buttons:** use the standard DaisyUI `btn btn-primary` / `btn-secondary`, which
  now inherit the project's soft/tonal default (see `src/index.css`).

## Architecture

Four new/changed units under `src/components/Eduroam/`, each ≤200 lines, direct
imports only:

| Unit | Responsibility |
|------|----------------|
| `EduroamDrawer.tsx` (rewrite) | Shell: `AdaptiveDrawer` + hero + footer; connects to `useAppStore` (`isEduroamOpen`) and `useEduroamSetup`; renders `DeviceAccordion`; shows the error alert + privacy note. |
| `DeviceAccordion.tsx` (new) | Step 1: four device cards with the collapse/expand animation; renders the selected device's `EduroamTutorial`; "pick another device" restart. |
| `EduroamTutorial.tsx` (new) | Step 2 renderer: "do once" block, numbered steps (text + optional warning + optional password chip + screenshot placeholder OR live action), "done" banner. Pure presentation — receives manual + live state via props. |
| `manual.ts` (new) | Typed descriptor of each device's tutorial, referencing i18n string keys + structural flags + geteduroam URLs. |
| `PasswordChip.tsx` (restyle) | Reused; restyled to the design's password-chip look. |

**Removed:** `IosTransfer.tsx`, `AndroidTransfer.tsx`, `MacInstall.tsx`,
`WindowsInstall.tsx` (their logic folds into the manual + tutorial renderer).

### Data model (`manual.ts`)

`t()` returns strings only (non-strings fall back to the key), so steps **cannot**
be stored as JSON arrays. The structure lives in TS; only leaf text is i18n.

```ts
type EduroamAction = 'qr' | 'download' | 'openSettings';

interface ManualStep {
  textKey: string;        // i18n key, resolved with t()
  shotKey: string;        // screenshot caption (placeholder text)
  warnKey?: string;       // optional amber warning banner
  action?: EduroamAction; // step renders a live control instead of a placeholder
  password?: boolean;     // step renders the real PasswordChip when available
}

interface DeviceManual {
  hintKey: string;                                   // one-line card hint
  doOnce?: { titleKey: string; ctaKey: string; url: string };
  steps: ManualStep[];
  doneKey: string;
  doneShotKey: string;
}

export const EDUROAM_MANUAL: Record<EduroamTarget, DeviceManual> = { ... };
```

- `ios` / `android`: step with `action: 'qr'`; password step `password: true`;
  android has `doOnce` (Play Store).
- `mac`: step with `action: 'download'`, a step with `action: 'openSettings'`,
  password step.
- `windows`: step with `action: 'download'`, password step, `doOnce`
  (geteduroam.app).
- iOS step carries the existing `warnKey` (the "~8 min / hidden in Settings" note).

### Live functionality ↔ static template reconciliation

The template treats actions as descriptive text. The renderer makes the **action
step** interactive instead of a dashed placeholder:

- `action: 'qr'` → before generation: a **Create QR code** button calling
  `run(target)` (spinner on `status === 'working'`). After: the real
  `qrDataUrl` `<img>` renders in that step's slot.
- `action: 'download'` → a **Download eduroam profile** button calling
  `run(target)`.
- `action: 'openSettings'` → an **Open settings** button calling
  `openProfilesSettings()` (Mac only).
- `password: true` → render `PasswordChip` with the real `password` from the hook,
  only once it is set.
- Non-action steps → dashed 16:9 placeholder with `t(shotKey)` caption.
- "Done" banner → dashed placeholder with `t(doneShotKey)`.
- Error → existing alert (`status === 'error'`, with `error`).

`useEduroamSetup` is unchanged. `selectTarget` already resets status/qr/password,
so switching devices in the accordion clears prior output.

### i18n

Add a nested `eduroam.manual.<device>.*` subtree to **both** `src/i18n/locales/cs.json`
and `en.json` (nested objects are fine — `t()` traverses dotted paths; only leaves
must be strings): card hints, hero title/subtitle, step texts, screenshot captions,
warnings, "do once" titles/CTAs, done text/caption, "pick another device", footer.
Reuse existing keys where identical (`download`, `preparing`, `error`,
`openSettings`, privacy notes). Remove now-unused flat keys
(`iosStep1…`, `androidStep0…`, `windowsStep0…`, `step1…`, `macHostHint`, etc.).

Update `src/i18n/__tests__/eduroamWindowsKeys.test.ts` to assert the new key set
exists in both locales (it is an i18n-key presence test, not a parser test).

## Testing

- **Unit (TDD):**
  - `manual.ts` — every referenced i18n key resolves to a non-key string in both
    `cs` and `en` (guards against typos / missing translations); structural
    invariants (exactly one `action` step per device, password step present, etc.).
  - `EduroamDrawer` / `DeviceAccordion` (existing `EduroamDrawer.test.tsx` rewritten,
    happy-dom): selecting a device reveals its tutorial and collapses others;
    clicking the action button calls `run`/`openProfilesSettings`; QR `<img>`
    appears when `qrDataUrl` is set; `PasswordChip` appears only with a password;
    "pick another device" resets selection; error alert renders on error.
  - Keep the i18n-key test green.
- **Build / typecheck / lint:** `npm run build` exit 0, `npm run typecheck`,
  `npm run lint`.
- **Manual end-to-end:** load the dev build on an IS Mendelu page, open the drawer,
  walk each of the four devices: accordion collapse animation, do-once links
  (Android/Windows), QR generation (iOS/Android), file download (Mac/Windows),
  Open-settings (Mac), real password chip + copy, theme toggle (light/dark),
  CZ/EN via global language switch.

## Out of scope

- Real screenshots (placeholders stay).
- Any change to `useEduroamSetup`, the cert/transfer APIs, or the Supabase iOS
  pipeline.
- Bidirectional anything; the drawer remains a one-way installer UI.
