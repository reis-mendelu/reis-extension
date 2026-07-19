# Library In-App Booking (Path B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a student book a library study room from inside reIS in one confirmed tap, via an anonymous MS Bookings create proxy with IS-prefilled identity.

**Architecture:** Client sends a *minimal* validated request to a new secret-gated, rate-limited edge function (`bookings-create`); the edge builds the MS `{appointment}` envelope (so the client can never inject `additionalRecipients`/arbitrary fields), validates the room against a hardcoded allowlist, POSTs to `bookings.cloud.microsoft`, and returns `{ ok, appointmentId }` or a typed error. A confirm dialog in the overview panel prefills name/email/studentId from `getUserParams()`.

**Tech Stack:** Deno edge function (Supabase), React 19, Zustand, DaisyUI, Vitest.

## Global Constraints

- Exact create API, headers, and payload: see the `library-booking-write-api` memory. Body is `{ appointment: {…} }`; required headers `content-type`, `x-anchormailbox`, `x-req-source: BookingsC2`, `prefer`.
- Booking is ALWAYS an explicit confirmed user action; never auto-book. Fallback deep-link-out CTA stays.
- Weekends are closed (`isOpenDay`); a slot on a weekend must never be bookable.
- Identity from `getUserParams()`: `fullName` → name, `email` → emailAddress, `studentId` → "student / employee ID" custom question.
- The edge is the abuse boundary: secret gate + durable per-student rate limit + room allowlist. The extension secret is not truly secret (ships in bundle), so rate limiting is mandatory, not optional.
- No custom CSS (DaisyUI only). Map overlays use fixed light literals. Files ≤ 200 lines.

---

### Task 1: Booking request types + builder (pure)

**Files:**
- Modify: `src/types/library.ts`
- Create: `src/services/library/bookingRequest.ts`
- Test: `src/services/library/__tests__/bookingRequest.test.ts`

**Interfaces:**
- Produces: `BookingIdentity { name: string; email: string; studentId: string }`, `BookingRequest { serviceId; staffMemberId; startDateTime; endDateTime; customer: BookingIdentity }`, `BookingResult = { ok: true; appointmentId: string } | { ok: false; error: BookingError }`, `BookingError = 'conflict'|'rate_limited'|'invalid'|'upstream'|'offline'`.
- `buildBookingRequest(room: LibraryRoom, slotStartIso: string, identity: BookingIdentity): BookingRequest` — end = start + 1h, timeZone `Central Europe Standard Time`.
- `missingIdentityFields(identity: Partial<BookingIdentity>): (keyof BookingIdentity)[]` — which required fields are blank.

Steps: write failing tests (end computed as +1h; missing-field detection for blank name/email/studentId) → implement → green → commit.

### Task 2: Edge function `bookings-create` (Deno)

**Files:**
- Create: `supabase/functions/bookings-create/index.ts`
- Create: `supabase/migrations/<ts>_library_bookings_log.sql` (durable rate limit)

Behavior (mirror `bookings-availability` for CORS/secret/timeout):
- Secret gate (`x-reis-extension-secret`), fail-closed if server secret unset.
- Parse `{ serviceId, staffMemberId, startDateTime, endDateTime, customer }`; validate shape; reject if `serviceId`/`staffMemberId` not in the hardcoded library allowlist (copy the 7 pairs from `LIBRARY_ROOMS`).
- **Durable rate limit:** `library_bookings_log(student_hash text, created_at timestamptz)` with RLS deny-all; the function inserts via service role and counts rows for this `student_hash` (sha-256 of studentId) in the last hour; reject `429` over the cap (default 5/h). Also a global per-hour ceiling.
- Resolve the service's required custom-question id from the `services` API (POST `{}` to `${BASE}services`, find the service, read its custom questions). Cache like availability.
- Build the MS envelope from minimal fields (name/email/studentId → `customers[0]` + `answeredCustomQuestions`), POST to `${BASE}appointments` with the required headers.
- Map: 2xx → `{ ok:true, appointmentId }` (read id from response); slot-taken/validation upstream → `{ ok:false, error:'conflict'|'invalid' }`; else `{ ok:false, error:'upstream' }`.

Not vitest-tested (consistent with the availability edge fn — no edge tests in repo); verified by a controlled live book+cancel. Deploy via Supabase MCP. Commit.

### Task 3: Client booking API

**Files:**
- Create: `src/api/libraryBooking.ts`
- Test: `src/api/__tests__/libraryBooking.test.ts`

**Interfaces:**
- Consumes: `BookingRequest`, `BookingResult` (Task 1).
- `createLibraryBooking(req: BookingRequest): Promise<BookingResult>` — POST to `${SUPABASE_URL}/functions/v1/bookings-create` with secret + apikey headers; map HTTP/JSON → `BookingResult`; network failure → `{ok:false,error:'offline'}`; 429 → `rate_limited`.

Steps: failing tests with mocked `fetch` (success returns appointmentId; 409/conflict; 429→rate_limited; thrown→offline) → implement → green → commit.

### Task 4: Booking store action

**Files:**
- Modify: `src/store/types.ts`, `src/store/slices/createMapSlice.ts`
- Test: `src/store/slices/__tests__/libraryBooking.test.ts`

**Interfaces:**
- State: `bookingStatus: Record<string, 'idle'|'submitting'|'success'|'error'>` keyed by `staffGuid|slotIso`; `bookingError: Record<string,BookingError>`.
- `bookRoom(room, slotIso, identity): Promise<void>` — set submitting → `createLibraryBooking` → on success set success + `loadLibraryAvailability` force-refetch so the panel reflects the booking; on failure set error.

Steps: test the state transitions with a mocked `createLibraryBooking` (success path sets success + triggers refetch; error path records the typed error) → implement → green → commit.

### Task 5: Confirm dialog + panel wiring

**Files:**
- Create: `src/components/CampusMap/LibraryBookingDialog.tsx`
- Modify: `src/components/CampusMap/LibraryOverviewPanel.tsx`
- Modify: `src/i18n/locales/{cs,en}.json`

Behavior:
- When `activeHour` is set and a room `isRoomFreeAt` that slot, its row action becomes a **Book** button (DaisyUI `btn btn-xs btn-primary`).
- Clicking opens `LibraryBookingDialog` (DaisyUI modal) showing room name, day, time, and editable prefilled name/email/studentId (defaults from `getUserParams()` via a small hook/state; `missingIdentityFields` blocks confirm until filled).
- "Confirm booking" → `bookRoom(...)`; shows submitting spinner; on success a success state + closes; on error a typed inline message (conflict/rate_limited/offline). Copy states the reservation is real and emails the library.
- New i18n keys: `libraryBookConfirm`, `libraryBookConfirmCta`, `libraryBookName`, `libraryBookEmail`, `libraryBookStudentId`, `libraryBookSuccess`, `libraryBookConflict`, `libraryBookRateLimited`, `libraryBookOffline`, `libraryBookMissingFields`, `libraryBookRealNote`.

Steps: write the dialog + wiring; verify live (open dialog, prefill shows, missing-field guard); a controlled real booking + cancel to confirm end-to-end; commit.

### Task 6: Live verification + docs

- Deploy `bookings-create` (Supabase MCP); one authorized real booking through the UI, then cancel; confirm the panel refetches and the slot flips.
- Update the `library-booking-write-api` memory (built + deployed) and the spec's status.

## Out of scope (Phase 2)

- Cancel/reschedule from the app (store the appointmentId now; add `bookings-cancel` later).
- Holiday-closure filtering.
