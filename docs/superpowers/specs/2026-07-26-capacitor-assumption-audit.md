# reIS on Capacitor — assumption audit

**Date:** 2026-07-26
**Scope:** verify §B claims against source; run §C tests live via `../reis-scraper`.
**Not done (per brief):** no implementation, no migration.

---

## MAIN QUESTION — do the cookies survive restart?

**Server side: yes, decisively. Client side (iOS WKWebView): still untested.**

Live test, `is.mendelu.cz`, real credentials via the scraper's Playwright login. Method: log in, capture cookies, **tear down the entire browser process** (the closest available analogue to an app kill), launch a brand-new process, replay only the cookie.

| Test | Result |
|---|---|
| Cookies constituting auth state | **exactly one — `UISAuth`** |
| Attributes | `domain=is.mendelu.cz path=/ expires=-1 httpOnly=true secure=true sameSite=Lax`, value 46 chars |
| Session cookie (no `Expires`) | **yes** — confirms the Brave/Firefox inference |
| Restore into fresh process, same UA | **authed=true** |
| Restore with **iOS Safari UA** | **authed=true** |
| Restore with **name+value+domain+path only** | **authed=true** |
| Token rotation per request | **no** — value unchanged |
| Second concurrent login kills the first | **no** — both sessions stayed live |
| 40-day-old token (`reis-scraper/cookies.json`, 2026-06-16) | **403** |

### What this resolves

- **§C3 (UA binding) — RESOLVED, no binding.** A desktop-Chrome-issued `UISAuth` authenticates fine under an iOS Safari UA. WKWebView's different UA is a non-issue. This was flagged as "more important than it looks"; it's dead.
- **§A's "all cookie attributes lost" — NEUTRALISED.** It only bites if you must reconstruct unknown attributes. There is **one** cookie with **static, known** attributes. `getCookies()` returning `{UISAuth: "..."}` is sufficient — the rest is hardcodable, and the attribute-less restore test passes. **D4 gets weaker still:** no custom plugin, and even the proxy-rule workaround is more machinery than needed.
- **Concurrent sessions are allowed.** Logging in on the phone does not log the student out on their laptop. This was never asked but would have been a silent killer.
- **§C4 (2FA/SSO) — RESOLVED for IS.** Login is a plain form POST to `/system/login.pl` with `credential_0`/`credential_1`. No SAML, no redirect chain. (WebISKAM is different — it uses Shibboleth at `alibaba.mendelu.cz/idp`, per `src/api/iskam/client.ts:12-16`.)
- **§C1 (session lifetime) — narrowed to ≈7 days absolute.** A 40-day-old token is dead, and since IS is *not* single-session, that 403 is genuine expiry rather than login-invalidation. The user reports **not re-logging in on Brave for about 7 days** at a stretch. Per §A, Chromium resurrects session cookies under "Continue where you left off", so the client side keeps `UISAuth` indefinitely — meaning the ~7-day boundary is **server-side**.
  A sliding idle window is unlikely: reIS's 5-minute sync only runs while an IS tab is open, so overnight gaps are 8–12h of zero traffic. A sliding window would have to exceed 12h to survive those, and a >12h sliding window that still dies at a consistent ~7 days doesn't fit. **Absolute ~7-day lifetime is the best-supported reading.**
  Consequence: **cookie restore has a hard 7-day ceiling.** No amount of Keychain machinery avoids weekly re-login on any platform. This sharpens rather than weakens the §C5 question — the workstream's entire value is the delta between re-login *weekly* (the floor) and re-login *on every app kill*.
  A no-traffic idle probe at +20/40/60/90/120 min is running to confirm the absence of a short sliding window; result pending. To convert "about 7 days" into a number, probe a known-age token daily for a week.

### What remains genuinely open

- **§C5 — the actual blocker.** Whether iOS WKWebView *hands you back* `UISAuth` after an app kill (D5: `WKProcessPool` reset). The server will accept the cookie; the question is entirely whether the client still has it. Needs a device or the iOS Simulator. **Still the test that should run before any other work.**
- **§C2 (IP binding) — NOT RESOLVED.** I tried to get evidence via IPv4↔IPv6 source-address divergence. It failed for two independent reasons: `is.mendelu.cz` has **no AAAA record** (A only, `195.178.72.131`), and this host's v4 and v6 egress addresses are identical. `curl -6` connected to `::ffff:195.178.72.131` — IPv4-mapped, same path. **No evidence was obtained.** This still needs the wifi→hotspot test. Treat "UIS binds nothing" as untested belief.

---

## §B — codebase claims

```
B1  FALSIFIED (in the direction that helps)
    evidence:  46 call sites of `new DOMParser().parseFromString(html, 'text/html')`
               across src/api/**, src/utils/parsers/**, src/injector/menuScraper.ts:135
               scripts/lib/nodeRuntime.ts:27-35
    actual:    Parsers do NOT read the live rendered DOM. They take an HTML
               *string* — fetched over the network — and build a detached
               Document via DOMParser. Nothing reads `document` of the host page.
               This is already proven portable: nodeRuntime.ts installs happy-dom
               + fake-indexeddb as globals and runs the REAL src/api/* modules in
               Node, which is how `npm run scrape:real` works.
    knock-on:  The stated basis for killing background refetch is wrong. Parsers
               need *a* DOM implementation, not *the page*. Background Runner
               having no DOM is solvable by bundling happy-dom/linkedom — the repo
               already does exactly this off-browser. Reopen background refetch on
               its merits (bundle size, Background Runner's JS engine limits,
               and the §D6 fetch-pattern objection), not on parser coupling.
               NB: §0 predicate 5 ("reformatting a DOM the student may already
               see") is not what the code does — see the predicate section below.
```

```
B2  FALSIFIED — decisively
    evidence:  src/injector/syncService.ts:47-260 (syncAllData)
               src/injector/syncService.ts:432-435 (startSyncService)
               src/injector/config.ts:1  SYNC_INTERVAL = 5 * 60 * 1000
               src/entrypoints/background.ts:4-5, 58-70 (POKE_ALARM, 15 min)
               src/injector/bgPokeListener.ts:13-20
    actual:    The extension crawls. `startInjection()` on any of three IS
               dashboard URLs starts `syncAllData()` IMMEDIATELY, then re-runs it
               on a **5-minute setInterval**. Independently, the MV3 service
               worker holds a **15-minute chrome.alarms** timer that messages
               every open is.mendelu.cz tab to re-sync.
               One pass fans out to: subjects, study plan, past subjects, study
               stats, study comparison, cvičné testy, odevzdávárny, full-semester
               schedule, exams — then per-subject (pLimit 3) file listings +
               syllabus, plus záznamník (pLimit 2) and classmates, plus a
               fire-and-forget `syncPastSemesters()` across every historical
               period. Most fetchers are dual-language, so ×2.
               That is hundreds of IS pages the student never opened, on a timer.
    knock-on:  Kills predicate 3 as written and removes the premise of the whole
               question. "Fetch once and cache" is not new behaviour — it is a
               *reduction* in fetch aggressiveness versus today. The mobile port
               does not introduce a fetch-pattern shift; if anything it should be
               presented as tightening one. §D6's "the problematic thing is
               automated background fetching" already describes shipped behaviour.
```

```
B3  FALSIFIED
    evidence:  wxt.config.ts:31-45 (host_permissions, 11 entries)
               src/entrypoints/content.ts:9-13 (matches, runAt: document_start)
               src/api/client.ts:44-52 (credentials: 'include', mode: 'cors')
               src/entrypoints/background.ts:8-27 (REIS_BG_FETCH — SW fetches
               an arbitrary caller-supplied URL)
    actual:    Content-script *matches* are narrow (three /auth/ dashboard URLs).
               But `host_permissions` includes `https://is.mendelu.cz/*` and the
               sync layer uses it to fetch arbitrary IS paths with credentials.
               Full host list also covers googleapis, webiskam, raw.githubusercontent,
               jsdelivr, skm.mendelu, mendelu.cz, a HuggingFace Space, Supabase,
               hei.api.uni-foundation.eu, and photon.komoot.io.
               Far broader than "DOM reading".
    knock-on:  Capacitor's native CORS bypass is *parity*, not new capability.
               The §230 TZ / §92 argument cannot rest on "only pages the student
               visited" — that is not what ships.
```

```
B4  FALSIFIED
    evidence:  src/injector/config.ts:1 — SYNC_INTERVAL = 5 min
               src/injector/syncService.ts:434 — setInterval(syncAllData, ...)
               src/entrypoints/background.ts:5 — POKE_PERIOD_MINUTES = 15
               src/entrypoints/background.ts:62-70 — alarm → tabs.query → sendMessage
    actual:    Two independent periodic tasks. The 5-min interval re-crawls; the
               15-min alarm exists specifically to keep an open tab syncing.
               No dedicated keepalive ping, but a 5-minute authenticated crawl is
               a keepalive in every respect that matters to the server.
    knock-on:  If IS has a sliding idle timeout, the current extension is already
               resetting it every 5 minutes for any student with an IS tab open.
```

```
B5  FALSIFIED — the most consequential falsification in this audit
    evidence:  src/api/exams.ts:144-172   registerExam()   → prihlasit_ihned=1
               src/api/exams.ts:200-217   unregisterExam() → odhlasit_ihned=1
               src/api/exams.ts:188       exam watchdog toggle
               src/api/outlookSync.ts:71-75  POST konfigurace_prenosu_udalosti.pl
                                             body: prenos_o365=1|0 ... ulozit=Uložit
               src/api/eduroam.ts:55-60   POST certifikat.pl  gen=Vygenerovat certifikát
               src/api/iskam/client.ts:40-51 postIskam() → /VolneKapacity
    actual:    reIS is NOT read-only. It performs real state mutations on the
               student's IS account:
                 1. **Registers and unregisters the student for exam terms.**
                    Academic consequences; deadline-sensitive; irreversible in
                    the sense that a released seat may be taken.
                 2. **Flips a persistent account setting** (O365 calendar
                    transfer, sources 1 and 4).
                 3. **Generates an X.509 client certificate** on the student's
                    account — i.e. it creates a credential, not just reads one.
               Separately, `schedule.ts:59` and `search/searchService.ts:23,58,81,103`
               use POST, but those are read-shaped query forms — a different class,
               worth distinguishing rather than lumping in.
    knock-on:  "A read-only client is a materially different legal object from one
               that acts on the student's behalf" — correct, and reIS is the
               second kind. Predicate 5 does not describe this codebase. Any
               framing built on read-only needs rewriting, not patching.
               Apple 5.2.2 exposure is also higher for an app that transacts.
```

```
B6  FALSIFIED (narrow version is true)
    evidence:  src/api/googleAuth.ts:30 TOKEN_KEY = 'reis_google_tokens'
               src/api/googleAuth.ts:114-115 writeTokens → chrome.storage.local
                 (stores access_token, refresh_token, expiry, email)
               src/services/admin/authClient.ts:10-18 storageKey 'reis_admin_auth',
                 persistSession: true, backed by chrome.storage.local
               src/services/drive/driveManifest.ts:13,45,72 'reis_drive_lock',
                 drive manifest
    actual:    No IS password and no IS session cookie is persisted — that part
               holds. But the extension DOES persist credentials: a Google OAuth
               **refresh token** (long-lived) and a Supabase **admin/society JWT
               session**, both in chrome.storage.local.
    knock-on:  "No credentials stored anywhere" is not defensible as stated.
               The defensible claim is narrower: *no MENDELU credential is
               persisted*. Worth stating precisely, since it is still a real and
               useful distinction. Also note §D6's Keychain point applies to
               tokens already being stored on disk today.
```

```
B7  FALSIFIED — and this is the one that hits predicate 2 hardest
    evidence:  see the "what leaves the device" table below
    actual:    Eleven distinct outbound paths. Cached IS data does live in
               IndexedDB and is not bulk-uploaded — but "nothing is sent to
               Supabase or any server" is false.
    knock-on:  Predicate 2 ("data never leaves the device"), described in the
               brief as "the strongest asset in the MENDELU negotiation", cannot
               be asserted as-is. It can be *made* true for most paths, but that
               is a product decision, not a description of current state.
```

```
B8  PARTIALLY FALSIFIED
    evidence:  src/services/admin/authClient.ts (whole file — compiled into the
                 extension bundle)
               src/store/slices/createAdminSlice.ts:66 signInWithPassword
               src/services/admin/chromeStorageAdapter.ts
    actual:    The admin/society surface is not a separate app — it ships inside
               the extension, with `signInWithPassword` and a persisted session.
               The isolation that DOES exist is narrower and deliberate: a
               separate Supabase client from the anon one, "so student reads never
               carry an admin JWT" (authClient.ts:5-8). I found no path carrying
               student-session-derived data into the admin client.
    knock-on:  The claim survives in substance (no student data reaches the admin
               path) but not in form (same bundle, same Supabase project). Say
               "separate client, no data path" rather than "separate surface".
```

```
B9  VERIFIED
    evidence:  package.json — single package, `"private": true`, no `workspaces`
               parsing lives in src/api/*.ts and src/utils/parsers/**
               scripts/lib/__tests__/no-parser-reimpl.test.ts (anti-drift guard)
    actual:    Single package, no monorepo. Parsers are not extracted.
    estimate:  **Cleaner than expected.** The parse functions are already pure
               (HTML string → typed object) and touch no chrome.* API. What
               entangles them is co-location: most src/api/*.ts files interleave
               `fetchWithAuth(...)` with the DOMParser block in the same function.
               The seam is already proven — nodeRuntime.ts runs these exact
               modules headless. Extraction is a split-by-function refactor, not
               a rewrite. The anti-drift test means the scraper would follow for free.
```

```
B10 VERIFIED — portable
    evidence:  src/services/storage/IndexedDBService.ts:121-122 (DB_NAME 'reis_db',
                 DB_VERSION 21)
               :142-173 upgrade handler
               :22-118 ReisDB schema, 21 object stores
    actual:    21 stores, all plain key→value with string keys, no indexes, no
               compound keys. The upgrade handler is **version-agnostic**: it
               iterates a `requiredStores` list and creates whatever is missing.
               There are no per-version migrations and no data transforms — bumping
               DB_VERSION only ever adds stores. Nothing Chrome-specific in the
               schema itself.
               `blocking`/`terminated` handlers self-heal a dropped connection.
    knock-on:  A Capacitor WebView cache under the is.mendelu.cz origin can reuse
               this schema verbatim. Caveat: because there are no migrations, any
               *shape* change to a stored value is handled by overwrite-on-next-sync,
               not by transform — fine for a cache, but it means a mobile build
               sharing `reis_db` with a differently-versioned desktop build would
               silently read stale shapes.
```

```
B11 VERIFIED — N/A, no Nuxt anywhere
    evidence:  no nuxt.config.* in repo; package.json has no nuxt dependency
               wxt.config.ts (WXT + @wxt-dev/module-react)
               vite.web.config.ts + dev/ (standalone web harness)
    actual:    WXT + React 19 + Vite + Tailwind 4. No SSR, no server/api routes,
               nothing to lose in a Capacitor build.
    knock-on:  Better than neutral. `npm run dev:web` already builds the exact
               same React app as a **plain webapp** served over HTTP, with a
               minimal `chrome.*` shim in dev/chromeShim.ts. That harness is a
               Capacitor-shaped seam that already exists and is exercised daily.
```

```
B12 ANSWERED — live, not from code
    evidence:  code: no cookie name appears anywhere in src/
               login-state detection: src/injector/sniper.ts:39
                 (`document.body?.innerHTML.includes("/system/login.pl")`)
                 and src/api/client.ts:55-58 (HTTP 401/403 → redirect to login.pl)
               live: reis-scraper/cookies.json + this audit's Playwright run
    actual:    The extension never inspects cookies. It infers login state from
               (a) the presence of a login link in the host page's DOM, and
               (b) 401/403 on a fetch. Cookies ride implicitly via
               `credentials: 'include'` on a same-origin content-script fetch.
               The cookie itself is `UISAuth` — one cookie, attributes above.
    knock-on:  Both detection mechanisms port to a Capacitor WebView unchanged.
               The flat-map limitation of getCookies() is not a problem here
               (see MAIN QUESTION).
```

---

## What actually leaves the device (B7 detail)

| # | Path | Payload | Destination | Disclosed in PRIVACY.md |
|---|---|---|---|---|
| 1 | `api/studyJams.ts:33,72,81,91` | **raw, unhashed `studentId`** + course codes + tutor/tutee role | Supabase | §2 discloses the feature; not the raw ID |
| 2 | `api/feedback.ts:31` `trackDailyUsage` | SHA-256(studentId), daily | Supabase | §3 yes |
| 3 | `api/feedback.ts:18` `submitFeedback` | SHA-256(studentId), NPS/one-change value, free text, semester | Supabase | §3 yes |
| 4 | `api/claude.ts:24-31` | syllabus text, **base64 PDF**, foreign text | Supabase Edge Fn → Anthropic | not explicitly |
| 5 | `api/syllabusTransfer.ts:28-33` | syllabus text pairs | `darksoothingshadow-reis-syllabus-similarity.hf.space` | no |
| 6 | `components/Feedback/FeedbackModal.tsx:27-47` | free text, contact, **`window.location.href`**, full UA, screen size | **Discord webhook** | §4/§5 partially |
| 7 | `services/errorReporter/telemetry.ts:76-87` | sanitized message + stack, session UUID, versions | Supabase `report_error_v2` | §6 yes, accurately |
| 8 | `SubjectFileDrawer/Header/TeacherGradingPill.tsx:69-92` | teacher ratings, session id | Supabase | not explicitly |
| 9 | `services/drive/driveBackup.ts` | **IS course files, in full** | student's own Google Drive | §5 area |
| 10 | `api/libraryBooking.ts`, `libraryAvailability.ts` | booking details incl. student/employee ID | Supabase Edge Fn → MS Bookings | no |
| 11 | `api/eduroamTransfer.ts` | cert transfer payload | Supabase Edge Fn | no |

Three of these deserve singling out:

**#1 is the sharpest.** `createStudyJamsSlice.ts:47,48,93,165,186,194,211` passes `userParams.studentId` straight through. That value is the IS **"Identifikační číslo uživatele"**, scraped at `src/utils/userParams/fetchers.ts:7,25`. It goes to Supabase **unhashed**, paired with the courses the student is struggling in. Every neighbouring feature hashes; this one does not. It is opt-in, which mitigates the ethics but not the factual contradiction with predicate 2.

**#6 ships an IS URL to Discord.** `window.location.href` on an IS page carries `studium=`/`obdobi=`/`termin=` parameters. Discord is a third-party chat platform, not a data processor under any agreement with MENDELU.

**#5 is a personal-account HuggingFace Space.** Syllabus text is university content, and the host is a hobby-tier endpoint under a personal handle. Worth flagging on its own terms, independent of the mobile question.

Also worth noting for accuracy's sake: telemetry (#7) is genuinely well built — sanitization at `services/errorReporter/sanitize.ts`, a 3-per-session cap, memory-only session UUID, `navigator.webdriver` and dev-mode suppression, and expected-error filtering. PRIVACY.md §6's description of it is honest. CLAUDE.md's blanket claim that the UIC is *never* sent "raw or hashed" is true **of telemetry** but false of the codebase as a whole (#1, #2, #3).

---

## Contradictions with §0's five legal predicates

The brief asked for this section to be surfaced above everything else. Taking the predicates in order:

**(1) Authenticated authorized user — HOLDS.** Every IS fetch is `credentials: 'include'` on the student's own live session. No credential replay, no shared account, no scraping of other students beyond what IS itself renders (classmates lists are IS features).

**(2) Data never leaves the device — DOES NOT HOLD.** Eleven outbound paths, at least one carrying a raw university identifier. Reachable with work; false today.

**(3) One student's own slice for personal need — STRAINED.** The slice is the student's own, but "for personal need" sits awkwardly against a 5-minute automated crawl of hundreds of pages plus a full historical-semester backfill, running whether or not the student is looking. The volume is a systematic extract, not incidental reading.

**(4) No contractual privity with IS4U/MENDELU — not assessable from code.** Nothing in the repo bears on it. Flagged as out of scope rather than verified.

**(5) Reformatting a DOM the student may already see — DOES NOT HOLD, twice over.** First, reIS does not reformat a rendered DOM; it independently fetches HTML the student never requested and parses it detached (B1/B2). Second, it is not a reformatter at all — it registers and unregisters exam terms, changes account settings, and generates certificates (B5).

**Bottom line for the legal analysis:** predicate 1 survives, 4 is out of scope, and 2/3/5 are contradicted by shipped code. As the brief anticipated, this needs redoing rather than patching — and note that the contradictions are with **the extension as it exists today**, not with the proposed Capacitor architecture. The Capacitor design in §0 is in several respects *more* conservative than what currently ships. That is the reframing worth carrying forward: the mobile port is not the thing that introduces these problems.

---

## §E — open questions

**Chrome-specific dependencies with no WKWebView equivalent.** Full inventory of `chrome.*` usage in `src/` (excluding tests):

| API | Sites | Capacitor path |
|---|---|---|
| `chrome.storage.local` | 26 | `@capacitor/preferences` — direct swap |
| `chrome.runtime.getURL` | 11 | bundled asset paths — trivial |
| `chrome.storage.sync` | 4 | **no equivalent.** Cross-device settings sync would need a backend or be dropped |
| `chrome.storage.onChanged` | 4 | needs a small event shim |
| `chrome.runtime.sendMessage` / `onMessage` | 7 | replaced by the InAppBrowser bridge |
| `chrome.tabs.query` / `sendMessage` | 2 | gone — no tabs; the 15-min poke disappears |
| `chrome.alarms` | 2 | the §A Background Runner problem |
| `chrome.identity.launchWebAuthFlow` | 2 | `@capacitor/browser` + custom URL scheme; Drive backup depends on this |
| `chrome.runtime.id` | 1 | context-alive check in telemetry; becomes a no-op |

Nothing here is a hard blocker. `chrome.storage.sync` is the only genuine capability loss. No `declarativeNetRequest` usage at all.

**Parser fragility against IS HTML changes.** 210 commits in the last 12 months touched `src/api/` or `src/utils/parsers/` — roughly **4 per week**. Highest churn: `api/exams.ts` (17), `utils/parsers/exams/availableTermsParser.ts` (16), `api/documents/service.ts` (16), `api/subjects.ts` (15), `api/syllabus.ts` (14), `api/studyPlan.ts` (14). Not all are IS-breakage fixes — features and refactors are mixed in — but the layer is unmistakably hot.

Against Apple's 1–3 day review SLA, **OTA updates are mandatory, not optional.** A parser break with a 3-day fix latency is a 3-day outage of a core screen. Note this also constrains the architecture: parsers must be OTA-updatable JS, which rules out moving any of them into native code.

**Existing data-source abstraction — yes, and it is a good one.** `src/api/client.ts:32-64` `fetchWithAuth()` already branches on transport: direct credentialed fetch in the content script, or `fetchViaProxy()` (postMessage to the parent) when running in the iframe. `src/api/proxyClient.ts:11-19` implements the proxy side. The data source is **not** assumed to be the current page anywhere. A Capacitor shell slots in as a third transport behind the same function. Combined with `nodeRuntime.ts` (a fourth, already working, in Node) that is two independent proofs the seam holds.

---

## §D — corrections log check

No reasoning in the repo depends on any of D1–D7; the codebase predates the discussion and makes no claims about Capacitor. Two updates from this audit:

- **D3 / D5 stand unresolved and are now the critical path.** Everything server-side is cleared. The only remaining question is client-side cookie retention on iOS.
- **D3 gets weak supporting evidence.** The user's Brave session surviving ~7 days is Chromium retaining a session cookie across browser restarts. Android WebView is also Chromium. Not proof — Brave's tab-restore machinery is not WebView's cookie store — but directionally consistent with "iOS is the only platform needing cookie restore". Still resolve by test C5, not by inference.
- **D4 weakens further.** With one cookie of known static attributes, neither a custom plugin nor the proxy-rule rewrite is needed — `getCookies()` plus hardcoded attributes is provably sufficient (tested).

---

## Recommended next step

Run §C5 on the iOS Simulator: empty Capacitor app → `openWebView()` on `https://is.mendelu.cz/auth/` → log in → kill → relaunch → check whether `UISAuth` is still there. One afternoon. It is the only thing standing between "cookie restore is viable" and "cookie restore is unnecessary" — and the server side has already been shown to cooperate with either answer.

Independently of the mobile question, two items surfaced here are worth their own tickets: the **raw `studentId` in Study Jams**, and the **IS URL in the Discord feedback payload**.
