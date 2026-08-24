# Demo mode — design

**Date:** 2026-08-23
**Status:** approved, not yet implemented
**Why now:** App Store Review cannot open reIS at all (Guideline 2.1). See
`docs/app-store-listing.md` §1.

---

## Problem

A clean install launches straight into MENDELU's UIS sign-in page in a native
InAppBrowser overlay. `ensureSession` (`src/mobile/ensureSession.ts:36`) finds
no stored token, and `boot()` awaits it before importing the React root. There
is no guest path.

So an Apple reviewer — who has no MENDELU account and never will — cannot see
the app. App Store Connect's **App Review Information → Sign-In Required** field
is mandatory for a login-gated app, and the same question arrives from Play
Console's **App content → App access** when we apply for production.

The alternatives to building this were handing Apple a real student's MENDELU
credentials (breaches university acceptable-use, and exposes real grades) or
asking MENDELU for a test account (clean, but out of our hands). Both are
recorded in `docs/app-store-listing.md` §1.1. This spec covers the third.

**Second problem, fixed in passing.** Backing out of the login WebView today
rejects out of `boot()` and writes a raw string into `#root`:

> `reIS failed to start: Error: Login cancelled: the sign-in window was dismissed`

That is the first thing a reviewer will do, and it is also what any student sees
if they tap the wrong thing. The demo entry point lives on the screen that
replaces it, so fixing the error state and adding the demo are the same change.

---

## Approach

**Demo mode is a store flag plus a pre-seeded IndexedDB, with sync never
started.**

The alternative considered and rejected was a **fake IS transport** — a mock
that answers IS requests from fixtures so the real sync pipeline runs unchanged.
It is the more faithful design and it would exercise code the flag-based version
skips, but it needs HTML fixtures for roughly 120 endpoints against parsers the
project treats as untouchable. That is a disproportionate amount of work for a
screen a reviewer looks at for five minutes.

A third option — a separate demo binary — is not an option at all: Apple reviews
the binary that ships.

---

## Design

### 1. Entry point

`capacitor/main.capacitor.ts` splits its catch by cause:

| Cause | Today | After |
|---|---|---|
| Login cancelled (`onDismissed`) | raw error string in `#root` | React `LoginGate` screen |
| Anything else | raw error string in `#root` | same path, unchanged |

`LoginGate` offers two actions and one line of text:

- **Přihlásit se** — re-runs `ensureSession(await buildInAppLoginDeps())`.
- **Prohlédnout ukázku** — enters demo mode.
- A disclaimer: *"Neoficiální studentská aplikace. Není provozována Mendelovou
  univerzitou."* / *"Unofficial student app. Not operated by Mendel
  University."*

The disclaimer is not decoration. It was decided on 2026-08-23 that **MENDELU
will not be asked for permission** (`docs/app-store-listing.md` §4), which makes
saying "unofficial" prominently one of only three remaining mitigations for
Guideline 5.2.2 — and today the word appears exactly once in the whole product,
as the last line of a 4000-character store description. This screen is the
natural place to fix that, because it is the first thing both a reviewer and a
first-run student see.

Distinguishing the two causes needs a typed error rather than a string match, so
`ensureSession` rejects with a `LoginCancelledError` instead of a bare `Error`.
Matching on the message text would break the first time the wording changes, and
the wording is user-facing.

`boot()` gains `startApp({ demo }: { demo: boolean })`, which both paths call.
It carries the existing sequence — action handler, external-link handler,
session-expiry handler, the dynamic import of `@/entrypoints/main/main`,
`SplashScreen.hide()` — and branches only on what demo must not do:

- `startSyncService()` is not called.
- The `resume` → `requestSync('resume')` listener is not registered.

Extracting it rather than duplicating matters because that sequence is
order-dependent and every line of it carries a comment explaining why it sits
where it does.

### 2. State — `createDemoSlice`

```ts
demoMode: boolean;         // default false
enterDemo(): Promise<void>;
exitDemo(): Promise<void>;
```

Its own slice, composed into `useAppStore` like the rest. Not folded into
`createMobileUiSlice`: demo is not a UI concern, and that slice is already the
place unrelated flags drift toward.

`demoMode` is set once at boot and does not change while the app runs, but it
has to be reactive because the banner and the guards read it.

**It defaults to `false` everywhere**, so the extension and ISKAM builds are
unaffected without needing a build flag.

### 3. Fixtures

`SocietyDataset` (`src/utils/mock/MockManager.ts`) covers `exams`, `schedule`,
`syllabuses` and `success_rates` today. That is enough for the calendar and
exams tabs; the map needs no session data at all. It is **not** enough for the
other two:

- `SubjectsScreen` reads `studyPlan`, `studyStats` and `studyComparison`.
- `StudentScreen` reads the student profile.

So `SocietyDataset` grows those four fields as **optional**, leaving the three
existing datasets (`esn`, `ldf`, `supef`) valid and unchanged, and a **fourth,
new dataset `demo`** is authored that fills all of them — with a fabricated
student (invented name, invented UIC, nothing derived from a real record).
`MockManager.validate` is extended to cover the new fields, so a malformed
fixture fails loudly rather than rendering a half-empty screen.

The stores `enterDemo` touches, and therefore the stores it clears, are exactly
those the dataset writes: `exams`, `schedule`, `syllabuses`, `success_rates`,
plus whichever stores back `studyPlan`, `studyStats`, `studyComparison` and the
profile. No other store is cleared — a student's theme, language or crash-report
preference must survive a look at the demo.

**All five tabs must render.** A visibly dead tab reads to a reviewer as an
incomplete app, which is the same Guideline 2.1 this is meant to clear.

### 4. `enterDemo()`

1. Clear the stores it is about to seed (see §7 on why this runs on entry too,
   and §3 for exactly which stores those are).
2. Seed them from the `demo` dataset via `MockManager`.
3. Set `syncStatus.handshakeDone`.
4. Set `demoMode: true`.

Step 3 is load-bearing and easy to miss. `SubjectsScreen` and others gate their
content on `handshakeDone` / `handshakeTimedOut`; with no sync running, an
unseeded handshake leaves every screen in its loading state forever.

### 5. Network guard — one place

`fetchWithAuth` (`src/api/client.ts:31`) is the single chokepoint for all IS
traffic on every platform. In demo it throws a typed `DemoModeError` before it
reaches the transport, and one handler turns that into a `sonner` toast — the
same toast layer the app already uses — reading *"Toto je jen ukázka."*

One guard rather than one per call site. The precedent is in the codebase
already — `installExternalLinkHandler` exists as a single document-level
interceptor precisely because "a list of these has already gone stale three
times in the plan" (`capacitor/main.capacitor.ts`).

Consequence to accept deliberately: anything reachable only through the network
— opening a subject's files, exam sign-up, Drive backup, eduroam setup — shows
the toast rather than working. That is the correct behaviour for a demo, and it
is honest about what the reviewer is looking at.

### 6. Telemetry and analytics off in demo

`trackDailyUsage` (`src/api/feedback.ts:31`) hashes a student ID that does not
exist in demo mode, so it would transmit a hash of a fabrication. Gate it on
`!demoMode`.

This is not cosmetic. The Play Data safety and Apple App Privacy filings both
say the User IDs row is a hash of a real student identifier; letting demo
sessions into that table makes the filed answer inaccurate.

### 7. Leaving demo

A **Přihlásit se** affordance in the demo banner calls `exitDemo()`, which wipes
the seeded stores and re-runs the login flow.

`enterDemo()` wipes on the way in as well, so fabricated data cannot bleed into
a real session in either direction — neither a student who tries the demo and
then signs in, nor one who signs out and pokes at the demo.

### 8. Demo banner

A persistent pill in the header while `demoMode` is true, so nobody mistakes
fabricated data for their own and so a reviewer knows immediately what they are
looking at. Czech and English, through `useTranslation()` like everything else.

---

## Out of scope

- **The Chrome extension and ISKAM.** Capacitor only. `demoMode` defaults false
  and nothing in those entry points sets it.
- **Fixtures for documents and the person sheet.** Both are reachable only by
  tapping into a subject; they get the demo toast.
- **A welcome screen before login.** Considered and rejected: it costs every
  student an extra tap on every fresh install, and a reviewer reaches the
  cancelled-login screen anyway.

---

## Testing

Test first, per the project's Iron Rules.

| Test | Asserts |
|---|---|
| `enterDemo` seeds and flags | stores populated, `demoMode` true, `handshakeDone` true |
| `enterDemo` wipes first | pre-existing rows in the seeded stores are gone |
| `exitDemo` wipes | seeded stores empty, `demoMode` false |
| `fetchWithAuth` in demo | throws `DemoModeError`, transport never invoked |
| `startApp({ demo: true })` | `startSyncService` not called, no `resume` listener |
| `ensureSession` dismissal | rejects with `LoginCancelledError`, not a bare `Error` |
| boot cancel path | renders `LoginGate`, not the error string |
| `trackDailyUsage` in demo | not called |

The parser rules do not apply here — nothing in this change touches a parser.

---

## Verification beyond unit tests

Unit tests cannot prove the reviewer's path works, because the thing being fixed
is a boot sequence in a native shell. Before this is called done:

1. Build for the iOS simulator, launch, **dismiss the login WebView**, and
   confirm the gate screen appears instead of the error string.
2. Enter the demo and visit all five tabs; confirm none is empty and none is
   stuck loading.
3. Tap something network-bound and confirm the toast, not a silent failure.
4. **Repeat on the iPad simulator.** iPad support is a requirement as of
   2026-08-23, and the gate screen is new UI that has never been seen at tablet
   width — the phone tree at 1024pt is exactly where a centred two-button layout
   goes wrong.
5. Repeat on Android, since Play's App access answer depends on the same path.
6. Re-shoot the store screenshots at both iOS sizes if the banner changes what
   they look like (`npm run store:shots -- --preset ios-6.9` and `--preset
   ios-13`).
