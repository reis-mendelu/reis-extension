# ISIC balance and top-up on the menza sheet (mobile)

Date: 2026-10-13 · Status: design approved in chat, spec under review

## Goal

On the phone/iPad app, the jídelníček sheet shows the student's **Hlavní konto**
balance (the money ISIC spends in the canteen) and lets them top it up by card or
Google Pay, while WebISKAM itself stays almost invisible: one login popup the
first time, then nothing but a number and a payment page.

## Scope

**In:** the Hlavní konto balance, a top-up with one custom amount, card (both
platforms) and Google Pay (Android only), on `MenuSheet`, iOS + Android.

**Out, deliberately:** dorm, reservations, meal orders, transaction history,
bank-transfer QR, keep-alive timers, background refresh, any other entry point,
the browser extension, reIS for Claude.

**Why so narrow.** WebISKAM was removed in #247 (2026-08-30) because the earlier
integration was not implemented well enough and its scope was far too large
(Dominik, 2026-10-13). This feature is the narrow version: balance and top-up,
nothing else, mobile only.

## Decisions (2026-10-13, with Dominik)

| Question | Decision |
|---|---|
| When is the student asked to log in? | Only when they want the balance. No keep-alive pings, no resume hooks, no background work. |
| What happens on sheet open with a stored session? | One silent try (cookie chain, ~0.3 s). Alive → balance shown at once; dead → "Zobrazit zůstatek ISIC". |
| Where does the row live? | `MenuSheet` only, above the canteen tabs. Days without a menu (weekends, holidays, summer) have no MenuCard and therefore no row — accepted. |
| Amount limits | Whole crowns, 1 – 15 000 Kč. |
| Where does GoPay open? | `@capacitor/browser` (SFSafariViewController / Chrome Custom Tab), a new native plugin. |
| Google Pay on iOS | Hidden — ISKAM offers no Apple Pay and Google Pay is an Android method. |
| Stale balance | Never shown. Each sheet open re-verifies; the number exists only after a successful `/Konta`. |

## Measured facts this rests on

Full write-up: `reis-scraper/docs/webiskam.md` (reis-mendelu/reis-scraper#22).

- Login is Shibboleth SAML via `alibaba.mendelu.cz`. Popup entry:
  `GET https://webiskam.mendelu.cz/Prihlaseni/AuthShibb`. Done when
  `.ISKAMASPXAUTH` exists on webiskam.
- **The silent IdP leg works over plain HTTP** (probe, 2026-10-13): with only the
  alibaba cookies, `AuthShibb → alibaba SSO (200, SAMLResponse form) → POST
  /Shibboleth.sso/SAML2/POST → AuthShibb` minted a fresh session in ~330 ms with
  no JavaScript page in between. So iOS does not need a hidden WebView.
- alibaba rewrites `shib_idp_session_ss` on **every** SSO, so re-issued cookies
  must be written back after each refresh.
- First login shows an attribute-release **consent page** (12 attributes). It is
  remembered client-side by `shib_idp_persistent_ss` (1 year), which is why the
  popup must not clear cookies on open.
- Expiry is a **302 to `/Home/Index`**, not a 401. With an expired session
  `InitGopayPayment` answers 200 with an empty body.
- `/Konta` (real page, 2026-10-13): four `.vyskaRiadkuKonto` rows; cell 0 name,
  cell 1 `"N,NN Kč"`; Hlavní konto carries `href="/Platby/NabitiKonta/0"`.
- Capacitor 8.5.2 passes `Set-Cookie` to JS on both platforms (Android
  `buildResponseHeaders` and iOS `allHeaderFields`, multiple values joined with
  ", "), and supports `disableRedirects`.
- **Device gate, Android (Pixel 9a, Android 16, release build, 2026-10-13):**
  the popup login captured all 8 cookies (4 webiskam, 4 alibaba `/idp`); after
  a force-stop and relaunch the stored jar reached `/Konta` through the seeded
  native jar and returned the page — balance shown with no popup. **iOS not
  yet checked on a device.**
- **WebISKAM answers in the phone's language.** On that Pixel (English) the
  page was `<html lang="en">`, "Main account", amount `N,NNN.NN Kč`; the
  Czech-only parser returned null and the row said "unavailable" after a good
  login. The parser now reads the page's `lang`, and the row formats the
  amount itself in the app's language.

### Session lifetimes

Measured by a probe started 2026-10-13 13:38 (growing idle gaps
10/20/40/80/160/320/640 min per layer, plus a 5-minute keep-alive session).
The design does not depend on them; they decide only how often the silent chain
saves the student a password.

| Layer | Cookie(s) | Idle timeout | Notes |
|---|---|---|---|
| ASP.NET ticket | `.ISKAMASPXAUTH` | alive at 10 min, dead at 328 min | re-issued by a request at 10 min but not at 5 → sliding, probably ~20 min |
| Shibboleth SP | `_shibsession_<hex>` | alive at 10 min, dead at 328 min | the server deletes the cookie when it has expired |
| IdP | `shib_idp_session` (+`_ss`) | alive at 10 min, dead at 328 min | dead = the password form |
| Keep-alive (5 min pings) | all webiskam | not measured | not used by the design |

The first run was cut short at 13:49 (lid closed → clamshell sleep → a DNS
failure crashed the probe); the 328-minute point is a single check of the
untouched sessions afterwards. Practical reading until a full run narrows it:
**a student who opens the sheet within minutes of the last use sees the balance
at once; after a few hours away, the popup.**

## Architecture

Mobile-only code under `src/mobile/iskam/`, one component under
`src/components/mobile/sheets/`. Nothing in `src/api/`, `src/utils/parsers/`,
`src/store/slices/`, `utils/trustedOrigin.ts` or the extension entrypoints —
those are shared with the extension and reIS for Claude, and #247's spec that
the webiskam origin is **rejected** by `trustedOrigin.ts` stays as it is.

| Unit | Job | Depends on |
|---|---|---|
| `iskamJar.ts` (pure) | Cookie records `{name, value, host, path, expires}`; `Set-Cookie` parsing (handles the ", " join, including commas inside `Expires`); `Cookie` header for a URL. Webiskam cookies only to `webiskam.mendelu.cz`, alibaba cookies only to `alibaba.mendelu.cz` under `/idp`; any other host throws. | nothing |
| `iskamCookieStore.ts` | The ONLY writer of the jar to `platform.secureStorage` (one JSON entry). Copies `tokenStore`'s ordering guarantees: generation counter, one serialized write lane, a clear wins over a write that lands after it, read de-duplication. | `platform`, `iskamJar` |
| `iskamHttp.ts` | One request, `disableRedirects: true`, returns `{status, location, setCookies, body}`. Cookie delivery mirrors the measured split in `api/capacitorTransport.ts`: explicit `Cookie` header on iOS; seeded native jar on Android. `Set-Cookie` is folded back into the JS jar on both. The native stores also keep the cookies they see (Android's Capacitor CookieHandler writes every response cookie into the WebView jar, iOS URLSession into HTTPCookieStorage); sign-out clears them (final review, I2). | `@capacitor/core`, `iskamJar` |
| `iskamSession.ts` | The silent chain (below). Returns `live` / `dead` / `unreachable`. | `iskamHttp`, `iskamCookieStore` |
| `iskamLogin.ts` | The popup: `InAppBrowser.openWebView` on `AuthShibb`; a copy of `ensureSession`'s contract (poll cookies on each page load, reject on dismiss, first-load deadline). Reads `getCookies` for `https://webiskam.mendelu.cz/` and `https://alibaba.mendelu.cz/idp/` (path-scoped). No `clearCookiesOnOpen`. | InAppBrowser (lazy import), `iskamCookieStore` |
| `iskamTopUp.ts` | `initTopUp(http, amount, method)` (`InitGopayPayment` → validated gateway URL, or `expired` / `rejected`) and `openGateway(url)`. The balance itself comes from `iskamSession` (`/Konta`) and `kontaParser`. | `iskamHttp`, `iskamCookieStore`, `@capacitor/browser` |
| `kontaParser.ts` (pure) | Picks the Hlavní konto row by its `/Platby/NabitiKonta/0` link, falling back to the name; parses `"1 234,56 Kč"` (spaces and NBSP). Validated against the real 2026-10-13 page. | DOMParser |
| `topUp.ts` (pure) | `validateAmount(text)` → whole Kč 1–15 000 or a reason; `parseGatewayUrl(html)` → `https:` + `gate.gopay.com` + `/gw-ui/` path, else null; empty body → expired. | nothing |
| `iskamStore.ts` | A small Zustand store, separate from `useAppStore` so the shared store never holds ISKAM state: `{status, balance}` + actions `check()`, `signIn()`, `topUp(amount, method)`, `reset()`. | the units above |
| `IskamBalanceRow.tsx` | The row and its inline top-up form. | `iskamStore`, i18n |

### Silent chain (`iskamSession`)

Run on sheet open and after a top-up. Cheapest step first:

1. No stored jar → `dead`.
2. `GET /Konta` with the stored cookies. 200 containing `.vyskaRiadkuKonto` → `live` (the page is kept for parsing).
3. 302 to `/Home/Index` (or alibaba) → `GET /Prihlaseni/AuthShibb` with `_shibsession_`. A `.ISKAMASPXAUTH` in the response → back to 2, once.
4. Still none → follow the IdP leg by hand: redirects; on alibaba a `SAMLResponse` form is POSTed to its action — which must be `https://webiskam.mendelu.cz/Shibboleth.sso/…`, anything else is `dead`. A password form → `dead`. Max 10 hops.
5. Every response's `Set-Cookie` is written back through `iskamCookieStore`.

`dead` (an authentication answer) clears the stored jar. A network error, a timeout
or a 5xx is `unreachable` and **keeps** the jar — the same rule as
`verifySession`, so bad wi-fi never costs the student their session.

## UI

`IskamBalanceRow` sits at the top of `MenuSheet`, above the canteen tabs. It is
hidden in demo mode and when `getPlatform().kind !== 'capacitor'` (the dev webapp
renders the phone tree too).

| State | Left | Right |
|---|---|---|
| `checking` | "ISIC · Hlavní konto" | skeleton in place of the amount; Dobít disabled |
| `signed-out` | **"Zobrazit zůstatek ISIC"** — tap opens the popup | Dobít disabled |
| `balance` | "ISIC · Hlavní konto" | the amount + **Dobít** enabled |
| `unavailable` | "Zůstatek teď nejde načíst" — tap retries | Dobít disabled |

Every sheet open starts at `checking`; the store drops the balance when the sheet
closes. Popup dismissed → `signed-out`.

### Top-up

Dobít expands the row in place:

- one amount field (numeric keyboard, whole Kč), inline validation message;
- **Google Pay** (Android only) and **Zaplatit kartou**, both disabled until the amount is valid.

On a pay button:

1. `InitGopayPayment?CastkaZadana=<n>&VybranaMetoda=<GPAY|PAYMENT_CARD>&TypKonta=0&…`
   with `X-Requested-With: XMLHttpRequest`, straight away: Dobít is only enabled
   beside a balance WebISKAM just confirmed, so the session is almost always live.
2. Answer expired (empty 200 or a 302 to `/Home/Index`) → the silent chain;
   `dead` → the popup; then init once more. Still not a gateway → a message.
3. Gateway URL fails validation (origin `https://gate.gopay.com`, path `/gw-ui/`)
   → error message, nothing opened.
4. `Browser.open({ url })` (`@capacitor/browser`). The form stays disabled from
   here until step 5 has finished.
5. `browserFinished` → `checking` → `/Konta`. Unchanged balance → one re-check
   after ~3 s, then show whatever WebISKAM says. The app never claims the payment
   succeeded — closing the tab without paying looks the same.

### Copy

| Key | cz | en |
|---|---|---|
| show | Zobrazit zůstatek ISIC | Show ISIC balance |
| label | ISIC · Hlavní konto | ISIC · Main account |
| unavailable | Zůstatek teď nejde načíst | Balance unavailable right now |
| topUp | Dobít | Top up |
| amount | Částka (Kč) | Amount (CZK) |
| card | Zaplatit kartou | Pay by card |
| gpay | Google Pay | Google Pay |
| invalid | Zadej celé číslo od 1 do 15 000 Kč | Enter a whole amount from 1 to 15,000 CZK |
| failed | Platbu se nepodařilo zahájit | Could not start the payment |

## Privacy and isolation

- reIS keeps the cookies in `secureStorage` (Keychain / Keystore AES-GCM), never in
  Preferences, IndexedDB or logs; the system web-cookie stores also hold the
  session while the student is signed in, and sign-out clears them. `logError` contexts carry no cookie or balance.
- The balance is memory-only and never persisted.
- Card / Google Pay data is entered on GoPay's page in the system browser view;
  reIS sees only the gateway URL.
- `privacy/disclosures.ts` describes Supabase flows only (FLOWS/EXEMPT), so
  WebISKAM and GoPay add no entry there; `PLATFORM_PERMISSIONS` changes only if
  a plugin adds an Android permission (`privacyDisclosures.test.ts` checks it).
  `PRIVACY.md` and `docs/privacy-policy-app.md` say what the app sends where
  (balance and cookies stay on the device). The gist is published at release.
- `noStudentDataLeaves`: `webiskam.mendelu.cz` listed explicitly under "carrying
  student data" (it already passes via the `mendelu.cz` suffix); `gate.gopay.com`
  under "links the student opens".
- **Sign-out:** `signOutMobile` gains `clearIskam` in its best-effort block, after
  the UISAuth clear: the secure-store entry via `iskamCookieStore` (clear wins over
  any in-flight write), the native jars for both hosts (CapacitorCookies +
  InAppBrowser, best-effort), and `iskamStore.reset()`.

## Testing

Vitest, written before each implementation step:

- **jar:** host isolation (no webiskam cookie reaches alibaba, nothing reaches a
  third host); `Set-Cookie` splitting with `Expires` commas; `/idp` path scoping;
  deletion by `Max-Age=0` / past `Expires`.
- **cookie store:** a write landing after a clear does not resurrect cookies;
  writes keep their order; concurrent reads share one native read.
- **chain:** live → no refresh; 302 `/Home/Index` → AuthShibb → IdP in that order;
  stop at a password form; SAML action off-host → dead; cookies written back;
  network error keeps the jar, auth failure clears it.
- **popup:** completes on the cookie poll, rejects on dismiss, first-load
  deadline, reads both cookie URLs.
- **top-up:** gateway URL extraction and rejection of non-GoPay hosts; empty body
  = expired; `validateAmount` for 1, 15000, 0, -5, "12,5", 15001, "", " 50 ";
  re-check after `browserFinished` with the single retry.
- **parser:** `/Konta` fixture built from the real 2026-10-13 page's structure
  with invented names and amounts (no personal data committed).
- **UI:** the four row states; Google Pay hidden on iOS; Dobít disabled without a
  balance; hidden in demo mode.
- **guards:** new `desktopHasNoIskam.test.ts` naming the mobile-only files and the
  reason; `nativePluginsAreReachable` entry for `@capacitor/browser`.
- **device** (plan Task 1, before building on it): on the cabled iPad and an
  Android phone, confirm `Set-Cookie` reaches JS and that the per-platform cookie
  delivery reaches webiskam and alibaba correctly. At the end: one real login on
  both, and one 10 Kč init that Dominik pays himself or leaves unpaid. Claude
  never enters card details.
- `verify-ui` at 320/390/430 and tablet width for the row's four states.

## Risks

- **Device cookie behaviour** may differ from the IS measurement on the alibaba
  hop (path-scoped cookies, a cross-host redirect). Task 1 exists to find this
  before anything depends on it.
- **The app login may store IdP session state in WebView localStorage** instead
  of cookies (the probe ran without JavaScript, so the IdP fell back to cookie
  storage). If the popup's cookies alone do not make the silent chain work, the
  fallback is the popup every time the ticket and SP session are gone — the
  feature still works, it just asks for the password more often.
- **Parser brittleness:** one selector and one link. Changes in WebISKAM fail as
  `unavailable`, never as a wrong number, because a row without a parseable
  amount is not returned.
