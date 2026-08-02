# Capacitor data transport — decision

Task 1 of `docs/superpowers/plans/2026-08-02-capacitor-shell.md`. Resolves the question
#158 left open: **where does reIS run, and how does it reach IS data?**

## Decision

**Model C — reIS runs in the Capacitor host WebView; data goes over `CapacitorHttp`.**

`openWebView` is retained, but only for **login and cookie capture**, not as the place
reIS lives.

## Why the question existed

IS's response headers rule out the two obvious designs. Measured on `/auth/`,
`/auth/student/moje_studium.pl`, `/auth/dok_server/index.pl` and `/system/login.pl` —
consistent everywhere:

```
Access-Control-Allow-Origin: https://localhost.that.never.exists/
X-Frame-Options: SAMEORIGIN
(no Content-Security-Policy)
```

- **CORS is denied to everyone**, deliberately, via a sentinel origin that matches
  nothing and does not vary with the request's `Origin`. A *browser* fetch from the host
  WebView's origin cannot reach IS.
- **`X-Frame-Options: SAMEORIGIN`** means the reIS app cannot embed IS in an iframe.

That left two candidates: inject reIS into the IS page (Model A), or fetch natively and
bypass the browser's CORS enforcement entirely (Model C).

## Measurement

`CapacitorHttp` performs requests in the **native** layer, where CORS does not apply. The
open question was whether the session cookie rides along. Two variants were tried on both
platforms with a real `UISAuth`, against `https://is.mendelu.cz/auth/`, checking for
`logout.pl` in the response body as the authentication signal.

| Cookie supplied via | Android 15 / API 35 | iOS 26.5 / iPhone 17 |
|---|---|---|
| `CapacitorCookies.setCookie()` (native jar) | **200, AUTHED, 39,626 B** | 403, not authed, 18,049 B |
| Explicit `headers: { Cookie }` | 403, not authed, 17,967 B | **200, AUTHED, 39,698 B** |

**Both platforms work — with opposite mechanisms.** Same token, same device, minutes
apart, and the result reproduces in both directions, so this is a platform behaviour
difference and not flakiness.

- On **Android**, the native HTTP layer manages cookies itself and a hand-set `Cookie`
  header does not reach the server. `CapacitorCookies.setCookie()` is the only route.
- On **iOS**, the reverse: the explicit header is what works, and seeding the native jar
  alone is not enough.

> ⚠️ **Implementation consequence:** supplying the cookie needs a `Capacitor.getPlatform()`
> branch. This is not cosmetic — getting it wrong produces a **403 with a 200-shaped code
> path**, i.e. a silent auth failure that looks like an IS error. Whatever wraps this must
> treat "no `logout.pl` in the body" as an auth failure, exactly as the probe does.

Combining both mechanisms at once was **not** tested and should not be assumed to work —
on Android the explicit header actively produced a 403, so "set both and let the platform
pick" is not obviously safe.

## Why Model C over Model A

Model A (inject reIS into the IS page) is also viable — spike tests 0, 0b and 1b proved
injection runs at `documentStart`, re-runs across navigation, and can carry a restored
session. It was rejected on balance, not on feasibility.

| | Model A — injected | **Model C — CapacitorHttp** |
|---|---|---|
| Where the #162 phone UI runs | over a foreign page | **as a normal app** |
| Styling isolation from IS's CSS | must be solved | **not an issue** |
| Bundle delivery | into the IS page, every navigation | **normal Capacitor asset** |
| CORS | not applicable (first-party) | **bypassed natively** |
| Reuses `fetchViaProxy` seam | yes, unchanged | no — a third transport in `fetchWithAuth` |
| Cookie handling | one mechanism | **per-platform branch** |
| Verified | tests 0 / 0b / 1b | **this task** |

> **Project principle, confirmed by the maintainer (2026-08-02):** *"live injected over
> real IS — that's not something we do in reIS since it's dangerous and we try to avoid
> that."*
>
> This is the decisive argument, and it outranks the technical trade-offs below. Note the
> distinction it draws, because it is easy to get wrong: the extension's content script
> injects an **iframe on the extension's own origin** — reIS code has never run *inside*
> IS's page context. Model A would have been the first time it did. Model C keeps that
> boundary intact.

The supporting technical argument is that **#158 already predicted this shape**: *"`fetchWithAuth()`
branches between a direct credentialed fetch and `fetchViaProxy()` over postMessage. A
Capacitor shell slots in as a third transport behind the same function — no call-site
changes."* Model C is that third transport. Model A would instead require the whole reIS
bundle to be delivered into, and styled against, a page whose HTML changes about four
times a week.

Model A's one real advantage — a single cookie mechanism — is outweighed by not having to
defend an injected UI against IS's own stylesheet on every IS change.

## What this changes in the plan

- **Task 7** renders `MobileApp` in the host WebView. `openWebView` is used for login and
  cookie capture only.
- **A new task is required** before Task 7: teach `fetchWithAuth` a Capacitor branch that
  calls `CapacitorHttp` with the per-platform cookie mechanism above. This did not exist
  in the plan, which assumed the transport question was still open.
- **Task 6 (downloads) gets simpler and needs one check.** `CapacitorHttp` can fetch the
  PDF natively, so the `blob:` failure is sidestepped entirely — but **verify how it
  returns binary** (`responseType`, base64 vs string) before relying on it. Do not assume
  the 1.6 MB PDF survives as a string.
- The measured **silent-403 failure mode** must be covered by a test.

## Residual risk

The `Access-Control-Allow-Origin` sentinel is a deliberate deny. Nothing here defeats a
server-side policy — `CapacitorHttp` simply is not a browser and is not subject to it.
If MENDELU later adds server-side origin or user-agent checks, Model C is the surface
that would break first. Model A is **not** a free fallback in that case — it conflicts
with the project principle above — so the real fallback would need designing rather than
reaching for. The injection probes stay in the spike repo as evidence of what is
technically possible, not as an approved design.
