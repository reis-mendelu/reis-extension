# Capacitor transport — POST and raw bytes

**Goal:** the Capacitor transport can POST and can return raw bytes, with eduroam
as its first real consumer.
**Scope:** Task 3 of `docs/superpowers/plans/2026-08-02-capacitor-remaining-work.md`,
plus the eduroam call sites from Task 4 (not the rest of Task 4, not Task 5).

Traced against `1ad5d030`.

---

## What is missing

`fetchWithAuth`'s Capacitor branch (`src/api/client.ts:37-46`) calls only
`CapacitorHttp.get` and **silently drops `options.method` and `options.body`**.
A POST therefore executes as a GET rather than failing — the worst shape of bug,
because the caller sees a 200 and an HTML page.

Two capabilities are absent:

- **POST** — needed by `generateCert` (`src/api/eduroam.ts:54`) and any future
  IS write. Nothing exercises it today, which is why it never surfaced.
- **Raw bytes** — `fetchIsBinary` (`src/api/capacitorBinary.ts:57`) returns a
  `Blob`; eduroam needs a `Uint8Array`.

### The trap

`fetchViaCapacitor` (`src/api/capacitorTransport.ts:88`) requires `logout.pl` in
the response body as its authentication signal (`isAuthenticatedHtml`, `:46`).
A `.p12` is binary and contains no such marker, so routing eduroam bytes through
it unchanged does not merely fail — it fails **harder**, reporting a fake expired
session. Bytes support must make that check conditional, not optional-by-accident.

### The live bug this fixes

Opening the eduroam sheet auto-fires `fetchEduroamPassword()`
(`src/hooks/data/useEduroamSetup.ts:90`), which on Capacitor is a CORS-blocked
bare `fetch`. Its error is swallowed into `logError`, so **a telemetry report
fires every time a student opens the sheet**, before they touch anything.

---

## Design

### 1. POST axis

`CapacitorTransportDeps` gains `httpPost`. `fetchViaCapacitor` accepts the
request options it currently drops and dispatches to `httpPost` when the method
is POST, passing the body as `data`.

Everything else is unchanged and applies to POST equally: `assertIsOrigin`, the
per-platform cookie delivery, 401/403 vs 5xx separation, and the `logout.pl`
check — IS answers a POST with an HTML page, so the check is still the right
signal there.

**Header precedence is explicit:** `client.ts` forwards only the **caller's own**
headers to the Capacitor transport — deliberately *not* the `DEFAULT_HEADERS`-merged
map it builds for the other platforms. Today the Capacitor branch sends no caller
headers at all, and sync's ~236 GETs are device-verified with exactly that shape;
adding `DEFAULT_HEADERS` there would change every sync request on the wire for no
benefit to this work. Only an explicit caller (eduroam's POST, which sets its own
content-type) adds anything.

Within the transport, the cookie-delivery headers from `buildCookieDelivery` are
applied **last**, so a caller can never overwrite `Cookie` and detach the session
on iOS. On Android that map is empty and the native jar is seeded instead — the
asymmetry documented at `capacitorTransport.ts:20-30`, which must not be collapsed.

This gives `fetchWithAuth` POST on all three platforms, not just for eduroam.

### 2. Bytes axis — a sibling function, not an option flag

An earlier sketch put this on `fetchWithAuth(url, { responseType: 'bytes' })`.
Rejected: `fetchWithAuth` imposes `DEFAULT_HEADERS` (`client.ts:8-23`), including
`accept: text/html…` and a form-urlencoded content-type. Those are wrong to send
when asking for a `.p12`, and adding them would change what the **extension**
puts on the wire today. One function would have meant two different contracts.

Instead: **`fetchAuthedBytes(url): Promise<Uint8Array>`** in `client.ts`.

| Platform | Path |
|---|---|
| Capacitor | `fetchIsBinary` (device-verified for documents) → `blob.arrayBuffer()` → `Uint8Array` |
| Extension / iframe / web | the same bare credentialed `fetch` eduroam does today — **byte-identical behaviour** |

The caller still declares intent and the transport still dispatches; call sites
stay platform-agnostic, which is the whole point of Task 4.

### 3. eduroam migration

All four bare `fetch` calls in `src/api/eduroam.ts` go away:

| Site | Becomes |
|---|---|
| `getText` (`:30`) | `fetchWithAuth` |
| `generateCert` (`:54`) | `fetchWithAuth` with `method: 'POST'` |
| `getBytes` (`:36`), both call sites | `fetchAuthedBytes` |

**Two accepted behaviour changes on the extension**, approved explicitly rather
than slipped in:

1. `getText`/`generateCert` now send `DEFAULT_HEADERS`. These mimic a browser
   navigation, and the content-type already matches what `generateCert` set by
   hand.
2. A 401/403 now redirects to the IS login page instead of throwing. That is
   `fetchWithAuth`'s existing contract and is correct for a lapsed session.

The bytes path carries neither change, by construction (§2).

### 4. Error semantics

The bytes path **skips** the `logout.pl` check, because binary has no such
marker. Expiry is detected exactly as `fetchIsBinary` already detects it: 401/403,
or an HTML content-type where a file was expected. This is not a loosening — it
is the same signal read from the right place. A `.p12` served as HTML means the
session lapsed and must never be written to disk as a certificate.

---

## Testing

Unit tests, dependency-injected, no `@capacitor/*` imports (the existing pattern
in `src/api/__tests__/capacitorTransport.test.ts`):

- a POST reaches `httpPost` with body and headers intact
- a GET still reaches `httpGet`, and `httpPost` is never called for it
- the `logout.pl` check runs for HTML and is not applied to bytes
- `fetchAuthedBytes` dispatches per platform
- an HTML body on the bytes path throws rather than returning bytes
- `assertIsOrigin` still rejects a non-IS URL on both axes

## Device verification (Android)

Nothing has ever exercised POST, so unit tests alone do not close this out.

- opening the eduroam sheet fires **no** telemetry report
- the extraction password renders
- `generateCert`'s POST reaches IS and returns an authenticated page
- both downloads return real bytes: a `.p12` and a DER cert each start
  `0x30 0x82` (DER SEQUENCE). Assert the magic bytes, **not** just a non-zero
  length — an HTML error page is also non-empty, and that is precisely the
  failure this must catch.

## Out of scope

- **Task 5 / #159** — native Wi-Fi configuration. This gets the cert material
  downloading; it does not join a network.
- **The rest of Task 4** — `cvicneTests`, `odevzdavarny`, `kontrola`,
  `serverTime`. Independent of each other, and each needs its own judgement about
  the `DEFAULT_HEADERS` + redirect change. Follow-up, not bundled here.
- Secure token storage (#172), iOS build (#174).
