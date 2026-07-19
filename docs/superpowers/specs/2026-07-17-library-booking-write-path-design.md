# Library Study-Room Booking — In-App Booking (Path B) Design

**Status:** Design approved by user 2026-07-17. Feasibility proven by a real capture (booked + cancelled Team Study Room 1).

**Goal:** Let a student book a library study room from inside reIS in one confirmed tap — no Microsoft login — by proxying the anonymous MS Bookings create API and pre-filling their IS identity.

## Background & feasibility (proven)

The MS Bookings anonymous "c2" API creates and cancels appointments with no Microsoft auth, no admin consent, and no CSRF/verification token. The exact payload and headers are captured in the `library-booking-write-api` memory. Path A (availability read) already ships; this adds the write path.

- **Create:** `POST /BookingsService/api/V1/bookingBusinessesc2/<biz>/appointments`, body `{ appointment: {…} }`. Response returns the appointment id.
- **Cancel:** `DELETE /…/appointments/{id}`, body `{}`.
- **Required headers:** `content-type: application/json; charset=utf-8`, `x-anchormailbox: <biz>`, `x-req-source: BookingsC2`, `prefer: exchange.behavior="IncludeThirdPartyOnlineMeetingProviders"`.
- **CORS:** `bookings.cloud.microsoft` blocks arbitrary origins, so the extension must proxy through the Supabase edge function (same as availability).

## Identity mapping (all from `getUserParams()` — already in IS)

| Booking field | IS source | Notes |
|---|---|---|
| `customers[].name` | `fullName` | from "Přihlášen: …" |
| `customers[].emailAddress` | `email` (`<username>@mendelu.cz`) | netid from certifikat.pl |
| custom question "student / employee ID" answer | `studentId` | = "Identifikační číslo uživatele" (UIC/personal number) — matches what the library asks |

The custom-question `id` and `questionText` are **per service**; fetch them from the existing `services` API response rather than hardcoding.

## Architecture

### Edge function: new `bookings-create` route
A second edge function (or a routed handler) mirroring `bookings-availability`:
- Secret-gated (`x-reis-extension-secret`), fail-closed if the server secret is unset.
- **Rate limited** — the upstream is unauthenticated, so the proxy is the only abuse gate. Per-IP and per-student-ID sliding window (e.g. ≤ N creates / hour). Reject over-limit with 429.
- Accepts a *minimal, validated* payload from the client: `{ serviceId, staffMemberId, startDateTime, endDateTime, customer: { name, email, studentId } }`. The edge function builds the full MS `{ appointment: {…} }` envelope server-side (client never sends the raw MS shape) and fetches the service's custom-question id.
- Validates `serviceId`/`staffMemberId` against the known library set (reject anything not a library room) so the proxy can't be used to book arbitrary businesses.
- Returns `{ ok, appointmentId }` or a typed error (`conflict`, `rate_limited`, `invalid`, `upstream`).
- Cancel route (`bookings-cancel`) is **Phase 2** (needs the stored appointment id).

### Extension
- **API layer** `src/api/libraryBooking.ts` — `createBooking(room, slot, identity)` → POSTs to the edge route; typed result.
- **Store** — a booking action on the map slice (or a dedicated `createBookingSlice`): tracks in-flight/success/error per room+slot; on success, refetch availability so the panel updates.
- **UI** — in `LibraryOverviewPanel`, when an hour is picked and a room is free, its row's action becomes **Book**. Tapping opens a confirm dialog:
  - Shows room, day, time, and the pre-filled name / email / student ID (editable).
  - Explicit "Confirm booking" (irreversible, real reservation + emails the library) and Cancel.
  - On success: toast + row flips to booked; on error: typed message (slot taken, rate-limited, offline).
- Identity comes from `getUserParams()`; if any field is missing, the dialog asks the student to fill it (never silently sends blanks).

## Data flow

pick slot → **Book** → confirm dialog (prefilled) → `createBooking()` → edge `bookings-create` (validate + rate-limit + build envelope + POST MS) → success → store records appointmentId → refetch availability → panel reflects the new booking.

## Security & privacy

- Proxy is the abuse boundary: secret gate + rate limit + room-allowlist validation.
- Booking is always an explicit, confirmed user action — never auto-booked; the dialog states it creates a real reservation and emails the library.
- Only the student's own identity is sent, for their own booking; shown before sending (consent). No third-party data. Not logged in telemetry (respect the existing sanitizer rules).

## Error handling

- Slot taken between load and confirm → upstream conflict → "That time was just taken — pick another."
- Missing identity field → dialog surfaces an editable field, blocks send until filled.
- Rate limited → "You've booked several rooms recently — try again later."
- Network/upstream failure → retry affordance; never a silent success.
- If MS ever enables email-code verification (`verificationCode`), creation will fail — surface a clear message and fall back to the deep-link-out booking (Path A CTA stays as the fallback).

## Testing

- Pure: payload-envelope builder (client-minimal → MS `{appointment}`), custom-question resolver, room-allowlist validator, rate-limit window. Unit-tested.
- Edge function: validation, rate-limit, allowlist, error mapping (mocked upstream).
- UI: confirm dialog prefill, missing-identity path, success/error states.
- No test places a real booking; the upstream is mocked.

## Out of scope (later phases)

- Cancel/reschedule from the app (Phase 2 — store appointmentId, add `bookings-cancel`).
- Fixing the availability over-report (public page enforces business hours/policy that `GetStaffAvailability` omits) — tracked separately; the booking `conflict` error is the safety net meanwhile.

## Open item to verify during build

- Confirm the exact per-service custom-question `id`s come through the `services` response for every room (we captured only Team Study Room 1's). If a room lacks the question, the answer array is simply omitted for it.
