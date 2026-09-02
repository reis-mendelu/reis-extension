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

## 5.2 The tablet frame (2026-09-02, after the #259 review)

The screen above was drawn for a phone and the app ships the phone tree on iPad, so at
834–1194pt it rendered as a 384pt column of text with two thirds of the screen empty. The
review verdict: "doesn't expand across the entire width and doesn't look modern."

**The first fix was wrong and is recorded here so it is not tried again.** It was a
full-bleed two-pane split — identity left under a field of concentric rings spreading from
the mark, action right on a raised pane. It measured clean and it still read as empty,
because the problem was never the container. Six strings do not fill 1024×1366 in any
arrangement, and the rings were decoration standing in for content. When a layout needs an
ambient graphic in order not to look bare, the graphic is the tell.

The direction taken instead: **the screen does not grow, the frame does.** At `md` and up
the same column becomes a centred dialog sized to what it holds, and the space around it
is margin rather than a gap to be filled.

```
 ┌──────────────────────────────────────────────────────┐
 │                                                      │
 │      ┌────────────────────────────────────────┐      │
 │      │ [logo]                       [ CZ|EN ] │      │
 │      │                                        │      │
 │      │ Vítej v reISu                          │      │
 │      │ Vylepšená verze IS MENDELU.            │      │
 │      │ Vytvořeno studenty pro studenty.       │      │
 │      │ ────────────────────────────────────── │      │
 │      │ ((•))  Školní Wi-Fi jedním klepnutím   │      │
 │      │        reIS nastaví eduroam…  [Nastavit]│     │
 │      │                              [ Teď ne ] │     │
 │      └────────────────────────────────────────┘      │
 └──────────────────────────────────────────────────────┘
```

- **One DOM tree, `md:` utilities only.** No `isTablet` branch. Below 768px this is the
  screen verified on the handset and the iPad, unchanged. `md:flex-none` on the column is
  what makes the dialog wrap its content instead of the viewport.
- **`max-w-2xl` (672pt), `p-10`.** The eduroam block turns on its side inside it — glyph,
  message, action across one row — which is what actually spends the width. Stacking the
  phone card in a 672pt box would leave the width unspent and the box taller.
- **The dialog's edge is a hairline.** `base-100` on `base-200` is 1.03:1 in the light
  theme, the mirror of the `base-300`-on-`base-200` bug `verify-ui` warns about, so
  `border-base-content/10` is what draws it there.
- **The glyph disc** moved from `bg-base-200` to a tint, for the same reason: a base-200
  disc on a base-100 surface is invisible in light.
- **Failure is coloured on the glyph, not the sentence.** `text-error` on the line measured
  3.90:1 against `base-100` — under AA, and unfixable by weight at that size. A 56pt glyph
  owes only the 3:1 that non-text graphics owe. The copy says "Nepovedlo se" regardless.
- **On failure the card's button drops to `btn-outline`**; the footer's "Pokračovat" is the
  way forward, and two tinted buttons of equal weight read as one decision asked twice.
  (`btn-outline btn-primary` would not do it — the project's soft-button rule fills
  `.btn-primary` regardless of the outline modifier.)

### 5.2.1 Reaching the card in a browser

`?eduroam=ios` / `?eduroam=android` on the dev webapp forces the native gate
(`src/mobile/eduroamNative.ts`, `import.meta.env.DEV`, stripped from every shipped build).
Only the gate is forced — tapping the button still runs the real hook and fails at the
plugin, which is the honest outcome on a web host. This exists because the tablet layout
was first reviewed on a screen that did not include the card, the gate being Capacitor-only
and the card therefore invisible without hand-patching this file.

**Verified:** no layout or contrast findings at 834/1024/1194 (`?mobile=1`, card forced on)
nor at 320/390/430. The failed state was driven by a real click-through, which is what
caught the 3.90:1 line. Every state read at 1024×768, the shortest iPad geometry, because
`#root` is `overflow: hidden` and a tall dialog would clip rather than scroll. **A pass on
the iPad is still the shipping gate** — a browser cannot run the plugin, so no screenshot
here proves the real card.

## 6. Out of scope

Re-offering eduroam near certificate expiry; the desktop modal; any change to
`useEduroamSetup` or the native plugins; a `profile-owned` outcome for iOS error 10
(tracked from the iOS verification checklist).
