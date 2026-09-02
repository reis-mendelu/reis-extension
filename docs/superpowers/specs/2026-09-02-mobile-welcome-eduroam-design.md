# Design — first-run welcome in the mobile app: language + one-tap eduroam

**Date:** 2026-09-02
**Status:** Approved design, not yet built.
**Closes:** #191. **Depends on:** the native eduroam paths (Android PR #189, iOS PR #258).

## 1. Goal

The first thing a student sees after signing in to the reIS app is one screen: pick a
language, tap once, and eduroam is set up before they have seen the calendar. Campus Wi-Fi
is the feature most new students need on day one, and today it is buried in the profile
sheet where most never find it.

## 2. Decisions (with the user, 2026-09-02)

- **Mobile app only.** The desktop extension keeps its existing `WelcomeModal`; a desktop
  cannot join Wi-Fi natively, and its eduroam flow is the QR/download drawer.
- **One screen, two choices.** Language toggle plus one primary eduroam button that runs
  the setup right there. No multi-step wizard; no auto-firing the OS dialog without a
  button, because a system alert with no explanation is jarring and a Cancel reads as a
  failure.
- **Minimal copy.** The user rejected the first draft as too much text. The screen carries
  a title, one card line, one button, one exit — five strings at most at any moment.

## 3. Mechanics

### 3.1 A first-run gate, not a modal or a sheet

`MobileApp` renders `WelcomeScreen` instead of the tab tree while the mobile UI slice's
`welcomeSeen` is `false`, the same ownership model `LoginGate` has before login.

- **State:** `welcomeSeen: boolean | null` on `MobileUiSlice`. `null` = not yet hydrated
  (render the tabs; never flash the welcome on top of a returning student), `false` =
  show, `true` = done.
- **Hydration:** `hydrateWelcome()` reads IndexedDB `meta.welcome_dismissed` — the key the
  desktop modal and `SyncMigration` already use — and sets `welcomeSeen` to its boolean.
  A fresh install and every existing 5.0.6 install (which never wrote the key on mobile)
  see the screen once; that is desired, they get eduroam too.
- **Dismissal:** `dismissWelcome()` sets `welcomeSeen = true` and writes the key. Called by
  "Not now" and by "Let's go". No re-offer later; the eduroam row in the profile sheet
  remains the path for a student who skipped. No separate "configured via reIS" flag —
  nothing reads it yet (YAGNI; #191 mentioned one only for a re-offer).
- **Demo mode:** treated as seen. There is no IS certificate to fetch, and the App Store
  reviewer's path should not start with a Wi-Fi dialog that cannot succeed.
- **Where hydration runs:** alongside the other slice hydrations the mobile tree performs
  at boot (the same place `mobileTab` and friends come up), before the first render of the
  tab tree.

Rejected: pushing a `welcome` sheet (the back gesture would pop it); mounting the desktop
`WelcomeModal` in `MobileApp` (a centred spring card is not a first-run screen and cannot
host an OS dialog flow well).

### 3.2 eduroam reuses the verified hook

`WelcomeScreen` calls `useEduroamSetup(target)` with `target = nativeEduroamTarget()`, and
shows the eduroam card only when `canConfigureEduroamNatively(target)` is true. So the
plugin path, the outcome mapping and the iOS lifetime disclosure are the ones verified on
the Android handset and on the iPad. Nothing new touches native code.

| Situation | Screen |
|---|---|
| Capacitor, Android 11+ or iOS 15.2+ | Card with the eduroam button |
| Capacitor, Android 7–10 (plugin rejects) or iOS 15.0/15.1 | Card shown; tap → `failed` line (see below) |
| Web dev host / anything not Capacitor | No card. Title, language, one primary "Let's go" |
| Demo mode | Screen not shown at all |

Outcomes, mapped onto the card:

| Outcome | Card | Footer |
|---|---|---|
| idle | outlined glyph, "Školní Wi-Fi jedním klepnutím", button | "Teď ne" (ghost) |
| working | glyph pulses, button spinner with `eduroam.native.working` | unchanged |
| saved / already-configured | glyph fills green with a check, line becomes "Hotovo, na fakultě se připojíš sám", button gone; on iOS one small line `eduroam.native.iosLifetime` | "Jdeme na to" (primary) |
| cancelled | back to idle, no banner | unchanged |
| failed / rejection | one line "Nepovedlo se, nastavíš to později v profilu", button stays | "Pokračovat" (primary) |

The `failed` line is the only new explanatory copy, and it appears only after a failure.

## 4. The screen

The headline is small and the network card is the hero: the promise of the screen is Wi-Fi
handled before the calendar. DaisyUI semantic classes only (iron rule), `font-display` for
the title as `LoginGate` does, MENDELU green as the only accent, `bg-base-100` card on the
`bg-base-200` page (the verified-contrast pairing; never `bg-base-300`).

```
 [safe-top]
 [logo]                          [ CZ | EN ]
 Vítej v reISu

 ┌────────────────────────────────────┐
 │               ((•))                │
 │   Školní Wi-Fi jedním klepnutím    │
 │   [       Nastavit eduroam      ]  │
 └────────────────────────────────────┘

                 Teď ne
```

- **Language toggle** is the same CZ/EN `join` control the profile sheet and desktop modal
  use, calling `setLanguage`; the whole screen re-renders in the chosen language at once.
- **Motion**, one moment: the Wi-Fi glyph is outlined while idle, pulses while the OS
  dialog is up, fills solid `text-primary` with a check on success. `motion/react` is
  already in the bundle; `useReducedMotion` drops the pulse and keeps the state change.
- **Safe areas:** top padding `calc(1.5rem + var(--safe-top,0px))` like `LoginGate`;
  bottom `env(safe-area-inset-bottom)` under the footer.
- **Widths:** centred column, `max-w-sm`, so it reads at 320 and on the iPad's 1024pt
  phone tree alike.

### 4.1 Copy (new keys under `mobile.welcome`, cs + en)

| Key | cs | en |
|---|---|---|
| `title` | Vítej v reISu | Welcome to reIS |
| `wifiLine` | Školní Wi-Fi jedním klepnutím | Campus Wi-Fi in one tap |
| `wifiDone` | Hotovo, na fakultě se připojíš sám | Done, you'll connect on campus automatically |
| `wifiFailed` | Nepovedlo se, nastavíš to později v profilu | Didn't work, you can set it up later in your profile |
| `notNow` | Teď ne | Not now |
| `continue` | Pokračovat | Continue |

Reused: `eduroam.native.button`, `eduroam.native.working`, `eduroam.native.iosLifetime`,
`onboarding.getStarted` ("Jdeme na to" / "Let's go").

## 5. Testing

- `createMobileUiSlice.test.ts`: `welcomeSeen` starts `null`; `hydrateWelcome` maps a
  missing key to `false` and `true` to `true`; `dismissWelcome` sets `true` and writes the
  key; demo mode reads as seen.
- `MobileApp.test.tsx`: renders `WelcomeScreen` and no `BottomNav` when `welcomeSeen` is
  `false`; renders the tabs when `null` or `true`.
- `WelcomeScreen.test.tsx` (hook mocked like `EduroamSheet.test.tsx`): no card off
  Capacitor and "Let's go" primary; card on Capacitor; language toggle calls
  `setLanguage`; `saved` → done line, no button, iOS line on iOS only; `cancelled` → button
  back, no banner; `failed` → failed line, continue primary; "Not now" and "Let's go" both
  call `dismissWelcome`.
- `verify-ui` at 320/390/430 on the dev webapp (web host → no card) for overflow and
  contrast; the card state is checked in the unit tests, since the web host cannot run the
  plugin. A pass on the iPad after the build is the final gate: fresh install → welcome →
  tap → Join → done state → Let's go → calendar; relaunch → no welcome.

## 5.1 Verified on the iPad (2026-09-02)

Debug build on the iPad (8th gen, iPadOS 26.6), screenshots via `pymobiledevice3`:

- **Upgrade in place** (5.0.6 with data → this build): the welcome appeared once on the next
  launch; the developer tapped Nastavit eduroam → Join; the app console recorded the cert
  fetch, `To Native -> Eduroam configure`, `{"outcome":"already-configured"}` (the iPad was
  already on eduroam). Then Jdeme na to → calendar. A later launch went straight to the
  calendar.
- **Copy revision**: the trimmed screen read as too sparse at 1024pt; a subtitle
  (`onboarding.description`, reused) and one sentence in the card (`wifiBody`) were added.
- **Fresh install** (app deleted, reinstalled): iOS's "Unable to Verify App" trust gate came
  first (a dev-signed build, not a reIS issue); after trusting, the welcome rendered as
  designed — logo, CZ | EN, title, subtitle, card line + sentence, green button, "Teď ne".
  Tap → Join → done state: green glyph with check, "Hotovo, na fakultě se připojíš sám", the
  iOS lifetime note, footer "Jdeme na to" as primary.
- Not exercised on device: the Cancel path (`cancelled`) and the failure line; both are
  unit-tested. The dev-webapp `verify-ui` run (no card on the web host) reported no layout
  or contrast findings at 320/390/430 in dark; the light run seeded a theme value the store
  ignores and was dropped at the user's request.

## 5.2 The tablet composition (2026-09-02, after the #259 review)

The screen above was drawn for a phone and the app ships the phone tree on iPad, so at
834–1194pt it rendered as a 384pt column of text with two thirds of the screen empty. The
review verdict was blunt: "doesn't expand across the entire width and doesn't look modern."

At `md` and up the same DOM becomes a full-bleed split. One tree, `md:` utilities only —
no `isTablet` branch — so the phone screen that was verified on device is untouched below
768px.

```
 ┌───────────────────────────────┬─────────────────────────────┐
 │  ((( logo )))  rings   [CZ|EN]│                             │
 │      (((                      │         ((•))               │
 │        (((                    │   Školní Wi-Fi jedním       │
 │                               │   klepnutím                 │
 │                               │   reIS nastaví eduroam…     │
 │  Vítej                        │   [   Nastavit eduroam   ]  │
 │  v reISu                      │                             │
 │  Vylepšená verze IS MENDELU.  │   [        Teď ne        ]  │
 └───────────────────────────────┴─────────────────────────────┘
   bg-base-200, overflow-hidden      bg-base-100 + hairline seam
```

- **The split is gated on the card, not on width** (`native && target`). With no card the
  right pane would be a full-height empty surface holding one button — worse at 1024pt
  than the centred column. The two conditions coincide in production: the phone tree only
  reaches `md` widths inside the Capacitor app, which is where the native card exists.
- **The seam is a hairline, not a tone.** `base-100` on `base-200` is 1.03:1 in the light
  theme — the same invisible-surface bug `verify-ui` warns about, mirrored — so
  `border-base-content/10` is what actually draws the divide. The raised pane still reads
  as raised in dark, where the pairing is the verified one.
- **`WelcomeSignal`** — rings spreading from the green dot in the mark, `primary` hairlines
  at 6–28%, `md` and up only. The one ornament: it fills the width with the thing the
  screen is about (reaching the network) instead of with nothing. Radius and opacity are
  attributes and only `scale` animates, so a tab that boots with its frame loop paused
  gets rings at 82% rather than an empty pane. Entrance only — the card owns every state
  after it.
- **The glyph disc** moved from `bg-base-200` to `bg-primary/10`: on the light theme a
  base-200 disc on a base-100 surface is 1.03:1 and simply is not there. The solid fill on
  success is still the state change.
- **On failure the card's button drops to `btn-outline`.** The footer's "Pokračovat" is the
  way forward; two tinted primaries stacked in the pane read as one decision asked twice.
  (`btn-outline btn-primary` would not do it — the project's soft-button rule fills
  `.btn-primary` regardless of the outline modifier.)
- Type scale at `md`: title `text-6xl`, card line `text-2xl`, body `text-lg`/`text-base`,
  language toggle `btn-sm` (the `btn-xs` pills are under the 44pt target on a tablet).

**Verified:** `verify-ui` at 834/1024/1194 with the split forced on (the web host has no
Capacitor, so `nativeEduroamTarget` was patched locally for the run and reverted) — no
layout or contrast findings; and at 320/390/430 in the shipping web-host state — no
findings, phone unchanged. Idle, working, done and failed were each read at 1024×768, the
shortest iPad geometry, because `#root` is `overflow: hidden` and a tall card would be
clipped rather than scrolled. **A pass on the iPad is still the shipping gate** — the web
host cannot run the plugin, so no browser screenshot proves the real card.

## 6. Out of scope

Re-offering eduroam near certificate expiry; the desktop modal; any change to
`useEduroamSetup` or the native plugins; a `profile-owned` outcome for iOS error 10
(tracked from the iOS verification checklist).
