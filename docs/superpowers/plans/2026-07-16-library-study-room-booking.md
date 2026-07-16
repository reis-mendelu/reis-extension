# Library study-room booking (Path A) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the library's 7 study rooms on the existing reIS campus map with a live "next bookable slot" status and a per-room deep-link to Microsoft Bookings — read-only, no admin consent.

**Architecture:** A Supabase edge function calls the **anonymous** Microsoft Bookings "c2" API (services + staff + `GetStaffAvailability`), filters admin staff, caches ~60 s, and returns raw availability blocks per room. The extension fetches that, computes each room's next bookable slot client-side (fresh relative to `now`), and renders it on the map by reusing the event-pin, room-polygon, and detail-panel machinery. No in-app booking in v1 (booking happens on Microsoft's page via a per-room `webUrl`).

**Tech Stack:** WXT + React 19 + Zustand (no immer) + DaisyUI 5 + Leaflet 1.9; Vitest (happy-dom); Supabase Deno edge functions.

## Global Constraints

- No `localStorage`/`sessionStorage`; persistence via `IndexedDBService` only. (Availability is ephemeral → in-memory Zustand, no persistence.)
- No custom CSS — DaisyUI semantic classes only (`badge-success`, `bg-base-200`, `link link-primary`).
- No `useEffect` for data fetching — fetch in the store/services, not components.
- Max 200 lines per file — split proactively.
- Direct imports only — no re-export barrels.
- Test-first: write the failing test before implementation.
- Store uses **plain Zustand** `set()`/`get()` shallow merges — **no immer/draft mutation**.
- Room identity on the map is the **numeric** `placeId` (`RoomProperties.id` === `RoomIndexEntry.placeId`).
- Shared secret: client sends `import.meta.env.VITE_EXTENSION_SECRET`; edge fn reads `Deno.env.get("EXTENSION_SECRET")`. Client also sends `apikey: SUPABASE_PUBLISHABLE_KEY`. Edge fns run `verify_jwt = false`.
- Booking backend facts: anonymous c2 API base `https://bookings.cloud.microsoft/BookingsService/api/V1/bookingBusinessesc2/RezervacestudovenMENDELU@mendelu.onmicrosoft.com/`. `GetStaffAvailability` requires a **Windows** timezone name (`Central Europe Standard Time`), not IANA.
- Copy: Czech-first, sentence case, active voice, via `useTranslation()`. Status copy is always "next bookable slot," never real-time "free now."
- All 7 rooms are in building `54678`, floor `57574`, level −1.

---

## Reference data (captured, verified)

**The 7 rooms** (service ↔ staff resource GUID ↔ placeId ↔ capacity ↔ lead):

| Service | Staff GUID | placeId | Cap | Lead |
|---|---|---|---|---|
| Team Study Room 1 | `e9c87efa-0ea7-4d3e-9f9a-9e51c5775474` | 57632 | 10 | 1h |
| Team Study Room 2 | `ee81403d-0312-49e8-a9cd-bca3be101c32` | 57627 | 6 | 1h |
| Individual Study Room 1 | `38efbb39-7a31-4526-bb7e-c34504f1a539` | 57621 | 2 | 1h |
| Individual Study Room 2 | `cb31b250-257c-45f5-a79e-957300aea3a6` | 57625 | 2 | 1h |
| Study Room IC 1 | `2e10ced2-1057-46c5-a2df-ef90fc1ecdcc` | 57640 | 6 | 1h |
| Study Room IC 2 | `548315e4-e230-44ab-b23b-19a643c2d03c` | 57640 | 6 | 1h |
| Seminar Room | `ee8fec8f-ccf4-4e1c-871d-e0cd725ba90a` | 57631 | 10–18 | 2d |

Library A = all except the two IC rows; Library IC = the two IC rows. IC1/IC2 **share placeId 57640**.

**`GetStaffAvailability` request** `POST {base}GetStaffAvailability`:
```json
{ "staffIds": ["<guid>"],
  "startDateTime": { "dateTime": "2026-07-17T00:00:00", "timeZone": "Central Europe Standard Time" },
  "endDateTime":   { "dateTime": "2026-07-21T00:00:00", "timeZone": "Central Europe Standard Time" } }
```

**Response** (real sample, Individual Study Room 1, 2026-07-17):
```json
{ "staffAvailabilityResponse": [ { "staffId": "38efbb39-...", "availabilityItems": [
  { "status": "BOOKINGSAVAILABILITYSTATUS_OUT_OF_OFFICE", "startDateTime": { "dateTime": "2026-07-17T00:00:00", "timeZone": "(UTC+01:00) ..." }, "endDateTime": { "dateTime": "2026-07-17T08:00:00", ... } },
  { "status": "BOOKINGSAVAILABILITYSTATUS_AVAILABLE",     "startDateTime": { "dateTime": "2026-07-17T08:00:00", ... }, "endDateTime": { "dateTime": "2026-07-17T12:00:00", ... } },
  { "status": "BOOKINGSAVAILABILITYSTATUS_BUSY",          "startDateTime": { "dateTime": "2026-07-17T12:00:00", ... }, "endDateTime": { "dateTime": "2026-07-17T13:00:00", ... } },
  { "status": "BOOKINGSAVAILABILITYSTATUS_AVAILABLE",     "startDateTime": { "dateTime": "2026-07-17T14:00:00", ... }, "endDateTime": { "dateTime": "2026-07-17T16:00:00", ... } },
  { "status": "BOOKINGSAVAILABILITYSTATUS_OUT_OF_OFFICE", "startDateTime": { "dateTime": "2026-07-17T16:00:00", ... }, "endDateTime": { "dateTime": "2026-07-18T00:00:00", ... } }
] } ] }
```
Blocks are **contiguous ranges** with naive-local `dateTime` strings (Europe/Prague wall-clock). The response does **not** apply lead time — our logic must. **Assumption:** the extension client runs in CZ timezone, so `new Date("…T08:00:00")` parses to the correct local instant; documented as a known limitation.

## File structure

| File | Responsibility | New/Mod |
|---|---|---|
| `src/types/library.ts` | `AvailabilityBlock`, `RoomAvailability`, `LibraryRoom` types | New |
| `src/data/map/libraryRooms.ts` | The 7-room static mapping | New |
| `src/services/library/nextSlot.ts` | Pure: parse blocks + compute next bookable slot | New |
| `supabase/functions/bookings-availability/index.ts` | Edge proxy → anon c2 API, cache, filter | New |
| `src/api/libraryAvailability.ts` | Client fetch fn → edge fn | New |
| `src/store/types.ts` | `MapSlice` additions | Mod |
| `src/store/slices/createMapSlice.ts` | `libraryAvailability` state + `loadLibraryAvailability()` | Mod |
| `src/components/CampusMap/LibraryRoomSection.tsx` | Detail-panel section (status + Rezervovat) | New |
| `src/components/CampusMap/DetailPanel.tsx` | Render the section for library rooms | Mod |
| `src/components/CampusMap/mapHelpers.ts` | Status polygon styles | Mod |
| `src/components/CampusMap/MapCanvas.tsx` | Tint library rooms by status | Mod |
| `src/components/CampusMap/LibraryLayer.tsx` | Aggregate overview pin | New |
| `src/components/CampusMap/CampusMapView.tsx` | Mount `LibraryLayer` | Mod |
| `src/i18n/locales/{cs,en}.json` | ~9 `map.library*` strings | Mod |

---

### Task 1: Types + `libraryRooms.ts` data file

**Files:**
- Create: `src/types/library.ts`
- Create: `src/data/map/libraryRooms.ts`
- Test: `src/data/map/__tests__/libraryRooms.test.ts`

**Interfaces:**
- Produces: `LibraryRoom`, `RoomAvailability`, `AvailabilityBlock` types; `LIBRARY_ROOMS: LibraryRoom[]`; `LIBRARY_PLACE_IDS: Set<number>`; `libraryRoomsByPlaceId(placeId: number): LibraryRoom[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import roomsIndex from '@/data/map/rooms-index.json';
import { LIBRARY_ROOMS, LIBRARY_PLACE_IDS, libraryRoomsByPlaceId } from '@/data/map/libraryRooms';

const INDEX = roomsIndex as Array<{ placeId: number; buildingId: number; floorId: number }>;

describe('libraryRooms', () => {
  it('has 7 rooms, all in building 54678 / floor 57574', () => {
    expect(LIBRARY_ROOMS).toHaveLength(7);
    for (const r of LIBRARY_ROOMS) {
      expect(r.buildingId).toBe(54678);
      expect(r.floorId).toBe(57574);
    }
  });

  it('every placeId exists in the bundled room index', () => {
    for (const r of LIBRARY_ROOMS) {
      expect(INDEX.some((e) => e.placeId === r.placeId)).toBe(true);
    }
  });

  it('has unique staff GUIDs', () => {
    const guids = LIBRARY_ROOMS.map((r) => r.staffGuid);
    expect(new Set(guids).size).toBe(7);
  });

  it('groups the two IC rooms under the shared placeId 57640', () => {
    expect(libraryRoomsByPlaceId(57640)).toHaveLength(2);
    expect(LIBRARY_PLACE_IDS.has(57640)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/map/__tests__/libraryRooms.test.ts`
Expected: FAIL — cannot resolve `@/data/map/libraryRooms`.

- [ ] **Step 3: Write the types**

`src/types/library.ts`:
```ts
export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OUT_OF_OFFICE';

export interface AvailabilityBlock {
  status: AvailabilityStatus;
  start: string; // naive local ISO, e.g. "2026-07-17T08:00:00"
  end: string;
}

export interface RoomAvailability {
  staffGuid: string;
  serviceId: string;
  webUrl: string;      // per-room Bookings deep-link
  leadMinutes: number; // 60 for study rooms, 2880 for the seminar room
  blocks: AvailabilityBlock[];
}

export interface LibraryRoom {
  staffGuid: string;
  serviceId: string;
  service: string;          // English service title (stable id-ish label)
  nameCs: string;           // Czech room-resource name for display
  library: 'A' | 'IC';
  buildingId: 54678;
  floorId: 57574;
  placeId: number;
  capacity: number | [number, number];
  leadMinutes: number;
}
```

- [ ] **Step 4: Write the data file**

`src/data/map/libraryRooms.ts`:
```ts
import type { LibraryRoom } from '@/types/library';

export const LIBRARY_ROOMS: LibraryRoom[] = [
  { staffGuid: 'e9c87efa-0ea7-4d3e-9f9a-9e51c5775474', serviceId: '5c7477a7-4afd-4c5b-bc9f-c157c14b2972', service: 'Team Study Room 1', nameCs: 'Týmová studovna 1', library: 'A', buildingId: 54678, floorId: 57574, placeId: 57632, capacity: 10, leadMinutes: 60 },
  { staffGuid: 'ee81403d-0312-49e8-a9cd-bca3be101c32', serviceId: 'ff081e72-01eb-4778-a6dc-d5139596cb93', service: 'Team Study Room 2', nameCs: 'Týmová studovna 2', library: 'A', buildingId: 54678, floorId: 57574, placeId: 57627, capacity: 6, leadMinutes: 60 },
  { staffGuid: '38efbb39-7a31-4526-bb7e-c34504f1a539', serviceId: '05921bc4-327d-4cc2-b499-3b3ee4603e32', service: 'Individual Study Room 1', nameCs: 'Individuální studovna 1', library: 'A', buildingId: 54678, floorId: 57574, placeId: 57621, capacity: 2, leadMinutes: 60 },
  { staffGuid: 'cb31b250-257c-45f5-a79e-957300aea3a6', serviceId: 'e2b362f0-0294-45ff-97e0-1e80ef1e9f51', service: 'Individual Study Room 2', nameCs: 'Individuální studovna 2', library: 'A', buildingId: 54678, floorId: 57574, placeId: 57625, capacity: 2, leadMinutes: 60 },
  { staffGuid: '2e10ced2-1057-46c5-a2df-ef90fc1ecdcc', serviceId: '7d0f31df-8b21-42d0-994c-f42d1de78093', service: 'Study Room IC 1', nameCs: 'Studovna IC 1', library: 'IC', buildingId: 54678, floorId: 57574, placeId: 57640, capacity: 6, leadMinutes: 60 },
  { staffGuid: '548315e4-e230-44ab-b23b-19a643c2d03c', serviceId: 'c83c7c2c-c1e5-404c-8927-7254015b6930', service: 'Study Room IC 2', nameCs: 'Studovna IC 2', library: 'IC', buildingId: 54678, floorId: 57574, placeId: 57640, capacity: 6, leadMinutes: 60 },
  { staffGuid: 'ee8fec8f-ccf4-4e1c-871d-e0cd725ba90a', serviceId: '31148510-2832-478b-9655-b1a5fd68eb87', service: 'Seminar Room', nameCs: 'Seminární místnost', library: 'A', buildingId: 54678, floorId: 57574, placeId: 57631, capacity: [10, 18], leadMinutes: 2880 },
];

export const LIBRARY_PLACE_IDS: Set<number> = new Set(LIBRARY_ROOMS.map((r) => r.placeId));

export function libraryRoomsByPlaceId(placeId: number): LibraryRoom[] {
  return LIBRARY_ROOMS.filter((r) => r.placeId === placeId);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/data/map/__tests__/libraryRooms.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/library.ts src/data/map/libraryRooms.ts src/data/map/__tests__/libraryRooms.test.ts
git commit -m "feat(library): study-room types + static room→map mapping"
```

---

### Task 2: Pure next-slot logic

**Files:**
- Create: `src/services/library/nextSlot.ts`
- Test: `src/services/library/__tests__/nextSlot.test.ts`

**Interfaces:**
- Consumes: `AvailabilityBlock` (Task 1).
- Produces: `parseAvailabilityItems(items): AvailabilityBlock[]`; `computeNextSlot(blocks: AvailabilityBlock[], leadMinutes: number, now: Date): string | null` (returns naive-local ISO of the first bookable hour-aligned slot start, or `null`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { computeNextSlot, parseAvailabilityItems } from '@/services/library/nextSlot';
import type { AvailabilityBlock } from '@/types/library';

const day: AvailabilityBlock[] = [
  { status: 'OUT_OF_OFFICE', start: '2026-07-17T00:00:00', end: '2026-07-17T08:00:00' },
  { status: 'AVAILABLE', start: '2026-07-17T08:00:00', end: '2026-07-17T12:00:00' },
  { status: 'BUSY', start: '2026-07-17T12:00:00', end: '2026-07-17T13:00:00' },
  { status: 'AVAILABLE', start: '2026-07-17T14:00:00', end: '2026-07-17T16:00:00' },
  { status: 'OUT_OF_OFFICE', start: '2026-07-17T16:00:00', end: '2026-07-18T00:00:00' },
];

describe('parseAvailabilityItems', () => {
  it('strips the status prefix and keeps local dateTime', () => {
    const blocks = parseAvailabilityItems([
      { status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE', startDateTime: { dateTime: '2026-07-17T08:00:00', timeZone: 'x' }, endDateTime: { dateTime: '2026-07-17T12:00:00', timeZone: 'x' } },
    ]);
    expect(blocks).toEqual([{ status: 'AVAILABLE', start: '2026-07-17T08:00:00', end: '2026-07-17T12:00:00' }]);
  });
});

describe('computeNextSlot (1h lead)', () => {
  it('picks the next hour-aligned slot ≥ now+1h', () => {
    const now = new Date('2026-07-17T09:10:00');
    expect(computeNextSlot(day, 60, now)).toBe('2026-07-17T11:00:00');
  });
  it('skips a busy hour to the next available block', () => {
    const now = new Date('2026-07-17T11:30:00');
    expect(computeNextSlot(day, 60, now)).toBe('2026-07-17T14:00:00');
  });
  it('returns null when nothing bookable remains in the window', () => {
    const now = new Date('2026-07-17T15:30:00');
    expect(computeNextSlot(day, 60, now)).toBeNull();
  });
});

describe('computeNextSlot (2-day lead, seminar)', () => {
  it('returns null within a single day window', () => {
    const now = new Date('2026-07-17T09:00:00');
    expect(computeNextSlot(day, 2880, now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/library/__tests__/nextSlot.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the implementation**

`src/services/library/nextSlot.ts`:
```ts
import type { AvailabilityBlock, AvailabilityStatus } from '@/types/library';

const HOUR_MS = 3_600_000;

interface RawItem {
  status: string;
  startDateTime: { dateTime: string; timeZone: string };
  endDateTime: { dateTime: string; timeZone: string };
}

export function parseAvailabilityItems(items: RawItem[]): AvailabilityBlock[] {
  return items.map((it) => ({
    status: it.status.replace('BOOKINGSAVAILABILITYSTATUS_', '') as AvailabilityStatus,
    start: it.startDateTime.dateTime,
    end: it.endDateTime.dateTime,
  }));
}

function ceilToHour(d: Date): Date {
  const r = new Date(d);
  if (r.getMinutes() || r.getSeconds() || r.getMilliseconds()) {
    r.setHours(r.getHours() + 1, 0, 0, 0);
  } else {
    r.setMinutes(0, 0, 0);
  }
  return r;
}

function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

export function computeNextSlot(
  blocks: AvailabilityBlock[],
  leadMinutes: number,
  now: Date,
): string | null {
  const earliest = ceilToHour(new Date(now.getTime() + leadMinutes * 60_000));
  let best: Date | null = null;
  for (const b of blocks) {
    if (b.status !== 'AVAILABLE') continue;
    const bStart = new Date(b.start);
    const bEnd = new Date(b.end);
    let start = ceilToHour(new Date(Math.max(bStart.getTime(), earliest.getTime())));
    if (start.getTime() + HOUR_MS <= bEnd.getTime()) {
      if (!best || start < best) best = start;
    }
  }
  return best ? toLocalIso(best) : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/library/__tests__/nextSlot.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/library/nextSlot.ts src/services/library/__tests__/nextSlot.test.ts
git commit -m "feat(library): pure next-bookable-slot computation"
```

---

### Task 3: Edge function `bookings-availability`

**Files:**
- Create: `supabase/functions/bookings-availability/index.ts`

**Interfaces:**
- Produces (HTTP JSON response): `{ rooms: Array<{ staffGuid: string; serviceId: string; webUrl: string; leadMinutes: number; items: RawItem[] }> }` where `RawItem` matches the `GetStaffAvailability` `availabilityItems` shape. Consumed by Task 4.

> Not unit-tested (Deno + live upstream). Verified by a manual curl step. Mirrors `supabase/functions/google-oauth/index.ts`.

- [ ] **Step 1: Write the edge function**

`supabase/functions/bookings-availability/index.ts`:
```ts
// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// @ts-ignore
const EXTENSION_SECRET = Deno.env.get("EXTENSION_SECRET");

const BASE =
  "https://bookings.cloud.microsoft/BookingsService/api/V1/bookingBusinessesc2/RezervacestudovenMENDELU@mendelu.onmicrosoft.com/";
const TZ = "Central Europe Standard Time";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-reis-extension-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

let cache: { at: number; payload: unknown } | null = null;
const TTL_MS = 60_000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dateOnly(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const secretHeader = req.headers.get("x-reis-extension-secret");
    if (EXTENSION_SECRET && secretHeader !== EXTENSION_SECRET) {
      return json({ error: "Unauthorized: invalid extension secret" }, 401);
    }

    if (cache && Date.now() - cache.at < TTL_MS) return json(cache.payload);

    const svcRes = await fetch(`${BASE}services`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!svcRes.ok) throw new Error(`services HTTP ${svcRes.status}`);
    const svc = await svcRes.json();
    const services = (svc.service || []).filter((s: any) => (s.staffMemberIds || []).length);

    const now = new Date();
    const start = new Date(now.getTime() - 24 * 3600_000);
    const end = new Date(now.getTime() + 5 * 24 * 3600_000);

    const rooms = await Promise.all(
      services.map(async (s: any) => {
        const guid = s.staffMemberIds[0];
        const lead = s.bookingsSchedulingPolicy?.minimumLeadTime === "P2D" ? 2880 : 60;
        const availRes = await fetch(`${BASE}GetStaffAvailability`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            staffIds: [guid],
            startDateTime: { dateTime: dateOnly(start), timeZone: TZ },
            endDateTime: { dateTime: dateOnly(end), timeZone: TZ },
          }),
        });
        const availJson = availRes.ok ? await availRes.json() : { staffAvailabilityResponse: [] };
        const items = availJson.staffAvailabilityResponse?.[0]?.availabilityItems || [];
        return { staffGuid: guid, serviceId: s.serviceId, webUrl: s.webUrl, leadMinutes: lead, items };
      }),
    );

    const payload = { rooms };
    cache = { at: Date.now(), payload };
    return json(payload);
  } catch (error: any) {
    return json({ error: error.message, rooms: [] }, 200);
  }
});
```

Note: on upstream failure the function returns `{ rooms: [] }` with status 200 so the client degrades to Path C (book button only) rather than surfacing an error.

- [ ] **Step 2: Deploy the function**

Run: `npx supabase functions deploy bookings-availability --no-verify-jwt`
Expected: "Deployed Function bookings-availability".

- [ ] **Step 3: Manual smoke test**

Run (replace `<SECRET>` with the project's `EXTENSION_SECRET`):
```bash
curl -s -X POST "https://zvbpgkmnrqyprtkyxkwn.supabase.co/functions/v1/bookings-availability" \
  -H "content-type: application/json" -H "x-reis-extension-secret: <SECRET>" | head -c 600
```
Expected: JSON with `"rooms": [` and 7 entries, each having `staffGuid`, `webUrl`, and an `items` array whose statuses include `BOOKINGSAVAILABILITYSTATUS_AVAILABLE`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/bookings-availability/index.ts
git commit -m "feat(library): edge fn proxying anonymous Bookings availability (60s cache)"
```

---

### Task 4: Client API fetch fn

**Files:**
- Create: `src/api/libraryAvailability.ts`
- Test: `src/api/__tests__/libraryAvailability.test.ts`

**Interfaces:**
- Consumes: Task 3 HTTP payload; `RoomAvailability` (Task 1).
- Produces: `fetchLibraryAvailability(): Promise<RoomAvailability[]>` (empty array on failure — never throws).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchLibraryAvailability } from '@/api/libraryAvailability';

afterEach(() => vi.restoreAllMocks());

describe('fetchLibraryAvailability', () => {
  it('maps the edge payload to RoomAvailability with parsed blocks', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      rooms: [{
        staffGuid: 'g1', serviceId: 's1', webUrl: 'https://book/s1', leadMinutes: 60,
        items: [{ status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE', startDateTime: { dateTime: '2026-07-17T08:00:00', timeZone: 'x' }, endDateTime: { dateTime: '2026-07-17T12:00:00', timeZone: 'x' } }],
      }],
    }), { status: 200 })));
    const out = await fetchLibraryAvailability();
    expect(out).toHaveLength(1);
    expect(out[0].staffGuid).toBe('g1');
    expect(out[0].blocks[0]).toEqual({ status: 'AVAILABLE', start: '2026-07-17T08:00:00', end: '2026-07-17T12:00:00' });
  });

  it('returns [] on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await fetchLibraryAvailability()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/__tests__/libraryAvailability.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the implementation**

`src/api/libraryAvailability.ts`:
```ts
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { parseAvailabilityItems } from '@/services/library/nextSlot';
import { logError } from '@/utils/reportError';
import type { RoomAvailability } from '@/types/library';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/bookings-availability`;

export async function fetchLibraryAvailability(): Promise<RoomAvailability[]> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'x-reis-extension-secret': import.meta.env.VITE_EXTENSION_SECRET || 'reis-secret',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { rooms?: Array<{ staffGuid: string; serviceId: string; webUrl: string; leadMinutes: number; items: unknown[] }> };
    return (data.rooms || []).map((r) => ({
      staffGuid: r.staffGuid,
      serviceId: r.serviceId,
      webUrl: r.webUrl,
      leadMinutes: r.leadMinutes,
      blocks: parseAvailabilityItems(r.items as never),
    }));
  } catch (err) {
    logError('Api.fetchLibraryAvailability', err);
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/api/__tests__/libraryAvailability.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/libraryAvailability.ts src/api/__tests__/libraryAvailability.test.ts
git commit -m "feat(library): client fetch fn for study-room availability"
```

---

### Task 5: Store wiring — `libraryAvailability` state + `loadLibraryAvailability()`

**Files:**
- Modify: `src/store/types.ts` (interface `MapSlice`, ~line 490 near `loadMapEvents`)
- Modify: `src/store/slices/createMapSlice.ts`
- Test: `src/store/slices/__tests__/libraryAvailability.test.ts`

**Interfaces:**
- Consumes: `fetchLibraryAvailability` (Task 4).
- Produces: store state `libraryAvailability: Record<string, RoomAvailability>` (keyed by staffGuid), `libraryAvailabilityLoaded: boolean`; action `loadLibraryAvailability(): Promise<void>` (load-once guard).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/libraryAvailability', () => ({
  fetchLibraryAvailability: vi.fn(async () => [
    { staffGuid: 'g1', serviceId: 's1', webUrl: 'u', leadMinutes: 60, blocks: [] },
  ]),
}));

import { useAppStore } from '@/store/useAppStore';
import { fetchLibraryAvailability } from '@/api/libraryAvailability';

describe('loadLibraryAvailability', () => {
  beforeEach(() => {
    useAppStore.setState({ libraryAvailability: {}, libraryAvailabilityLoaded: false });
    vi.clearAllMocks();
  });

  it('populates libraryAvailability keyed by staffGuid', async () => {
    await useAppStore.getState().loadLibraryAvailability();
    expect(useAppStore.getState().libraryAvailability.g1.webUrl).toBe('u');
    expect(useAppStore.getState().libraryAvailabilityLoaded).toBe(true);
  });

  it('does not refetch once loaded', async () => {
    await useAppStore.getState().loadLibraryAvailability();
    await useAppStore.getState().loadLibraryAvailability();
    expect(fetchLibraryAvailability).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/libraryAvailability.test.ts`
Expected: FAIL — `loadLibraryAvailability` is not a function.

- [ ] **Step 3: Add types to `MapSlice`**

In `src/store/types.ts`, inside interface `MapSlice`, add near the `mapEvents` members:
```ts
  libraryAvailability: Record<string, RoomAvailability>;
  libraryAvailabilityLoaded: boolean;
  loadLibraryAvailability: () => Promise<void>;
```
And add the import at the top of `types.ts`:
```ts
import type { RoomAvailability } from '@/types/library';
```

- [ ] **Step 4: Implement in `createMapSlice.ts`**

Add the imports at the top:
```ts
import { fetchLibraryAvailability } from '@/api/libraryAvailability';
```
Add initial state near the other defaults (e.g. after `mapEventsLoaded: false,`):
```ts
  libraryAvailability: {},
  libraryAvailabilityLoaded: false,
```
Add the action (mirror `loadMapEvents`'s load-once guard):
```ts
  loadLibraryAvailability: async () => {
    if (get().libraryAvailabilityLoaded) return;
    try {
      const rooms = await fetchLibraryAvailability();
      const byGuid: Record<string, (typeof rooms)[number]> = {};
      for (const r of rooms) byGuid[r.staffGuid] = r;
      set({ libraryAvailability: byGuid, libraryAvailabilityLoaded: true });
    } catch (err) {
      logError('MapSlice.loadLibraryAvailability', err);
      set({ libraryAvailabilityLoaded: true });
    }
  },
```
(`logError` is already imported in this file.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/store/slices/__tests__/libraryAvailability.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.
```bash
git add src/store/types.ts src/store/slices/createMapSlice.ts src/store/slices/__tests__/libraryAvailability.test.ts
git commit -m "feat(library): store state + load-once action for availability"
```

---

### Task 6: i18n strings

**Files:**
- Modify: `src/i18n/locales/cs.json` (the `map` group)
- Modify: `src/i18n/locales/en.json` (the `map` group)

- [ ] **Step 1: Add Czech keys**

In `cs.json`, inside `"map": { … }`, add:
```json
    "libraryCapacity": "Kapacita",
    "libraryPeople": "osob",
    "libraryAmenities": "PC · zásuvka · Wi-Fi",
    "libraryRulesShort": "Rezervace na 1 h, klíč u výpůjčního pultu proti kartě.",
    "libraryNextSlotToday": "Volno od {{time}}",
    "libraryNextSlotDay": "Volno {{date}} {{time}}",
    "libraryFull": "Momentálně plno",
    "libraryReserve": "Rezervovat",
    "libraryFreeToday": "{{count}} volné dnes"
```

- [ ] **Step 2: Add English keys**

In `en.json`, inside `"map": { … }`, add:
```json
    "libraryCapacity": "Capacity",
    "libraryPeople": "people",
    "libraryAmenities": "PC · power · Wi-Fi",
    "libraryRulesShort": "1-hour bookings, key at the loans desk against your card.",
    "libraryNextSlotToday": "Free from {{time}}",
    "libraryNextSlotDay": "Free {{date}} {{time}}",
    "libraryFull": "Fully booked",
    "libraryReserve": "Reserve",
    "libraryFreeToday": "{{count}} free today"
```

- [ ] **Step 3: Verify JSON parses**

Run: `node -e "require('./src/i18n/locales/cs.json'); require('./src/i18n/locales/en.json'); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(library): i18n strings for study-room status"
```

---

### Task 7: Detail-panel library section

**Files:**
- Create: `src/components/CampusMap/LibraryRoomSection.tsx`
- Modify: `src/components/CampusMap/DetailPanel.tsx`
- Test: `src/components/CampusMap/__tests__/libraryStatus.test.ts`

**Interfaces:**
- Consumes: `LIBRARY_ROOMS`, `libraryRoomsByPlaceId`, `LIBRARY_PLACE_IDS` (Task 1); `computeNextSlot` (Task 2); store `libraryAvailability` (Task 5).
- Produces: `<LibraryRoomSection placeId={number} />`; helper `statusLabel(room, availability, now, t, locale): { text: string; free: boolean }` in a testable module `src/components/CampusMap/libraryStatus.ts`.

- [ ] **Step 1: Write the failing test for the status label helper**

```ts
import { describe, it, expect } from 'vitest';
import { statusLabel } from '@/components/CampusMap/libraryStatus';
import type { RoomAvailability } from '@/types/library';

const room = { leadMinutes: 60 } as { leadMinutes: number };
const avail: RoomAvailability = {
  staffGuid: 'g', serviceId: 's', webUrl: 'u', leadMinutes: 60,
  blocks: [{ status: 'AVAILABLE', start: '2026-07-17T14:00:00', end: '2026-07-17T16:00:00' }],
};
const t = (k: string, o?: any) => (o?.time ? `${k}:${o.time}` : k);

describe('statusLabel', () => {
  it('reports the next same-day slot as free', () => {
    const r = statusLabel(room, avail, new Date('2026-07-17T11:00:00'), t as never, 'cs');
    expect(r.free).toBe(true);
    expect(r.text).toBe('map.libraryNextSlotToday:14:00');
  });
  it('reports fully booked when no slot fits', () => {
    const r = statusLabel(room, avail, new Date('2026-07-17T15:30:00'), t as never, 'cs');
    expect(r.free).toBe(false);
    expect(r.text).toBe('map.libraryFull');
  });
  it('degrades to fully-booked label when availability is missing', () => {
    const r = statusLabel(room, undefined, new Date('2026-07-17T11:00:00'), t as never, 'cs');
    expect(r.free).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/libraryStatus.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the status helper**

`src/components/CampusMap/libraryStatus.ts`:
```ts
import { computeNextSlot } from '@/services/library/nextSlot';
import type { RoomAvailability } from '@/types/library';

type T = (key: string, opts?: Record<string, unknown>) => string;

export function statusLabel(
  room: { leadMinutes: number },
  availability: RoomAvailability | undefined,
  now: Date,
  t: T,
  locale: string,
): { text: string; free: boolean } {
  if (!availability) return { text: t('map.libraryFull'), free: false };
  const iso = computeNextSlot(availability.blocks, room.leadMinutes, now);
  if (!iso) return { text: t('map.libraryFull'), free: false };
  const d = new Date(iso);
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return { text: t('map.libraryNextSlotToday', { time }), free: true };
  const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });
  return { text: t('map.libraryNextSlotDay', { date, time }), free: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CampusMap/__tests__/libraryStatus.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the section component**

`src/components/CampusMap/LibraryRoomSection.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { libraryRoomsByPlaceId } from '@/data/map/libraryRooms';
import { statusLabel } from './libraryStatus';

export function LibraryRoomSection({ placeId }: { placeId: number }) {
  const { t, i18n } = useTranslation();
  const availability = useAppStore((s) => s.libraryAvailability);
  const rooms = libraryRoomsByPlaceId(placeId);
  if (!rooms.length) return null;
  const now = new Date();

  return (
    <div className="space-y-2 border-t border-base-300 pt-2">
      {rooms.map((room) => {
        const avail = availability[room.staffGuid];
        const status = statusLabel(room, avail, now, t, i18n.language);
        const cap = Array.isArray(room.capacity) ? `${room.capacity[0]}–${room.capacity[1]}` : room.capacity;
        return (
          <div key={room.staffGuid} className="space-y-1">
            <p className="text-sm font-semibold text-base-content">{room.nameCs}</p>
            <p className="text-xs text-base-content/60">
              {t('map.libraryCapacity')}: {cap} {t('map.libraryPeople')} · {t('map.libraryAmenities')}
            </p>
            <span className={`badge badge-sm ${status.free ? 'badge-success' : 'badge-ghost'}`}>{status.text}</span>
            <a
              href={avail?.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary block text-sm"
              aria-disabled={!avail?.webUrl}
            >
              {t('map.libraryReserve')}
            </a>
          </div>
        );
      })}
      <p className="text-[11px] text-base-content/50">{t('map.libraryRulesShort')}</p>
    </div>
  );
}
```

- [ ] **Step 6: Wire into `DetailPanel.tsx`**

In `src/components/CampusMap/DetailPanel.tsx`, add the import:
```tsx
import { LIBRARY_PLACE_IDS, LIBRARY_ROOMS } from '@/data/map/libraryRooms';
import { LibraryRoomSection } from './LibraryRoomSection';
```
In the room-return block, the current room's placeId is `r.id` (kind `'room'`) or `sel.entry.placeId` (kind `'roomRef'`). Compute it and render the section. Replace the room `return (...)` so it includes:
```tsx
  const placeId = sel.kind === 'room' ? r?.id : sel.kind === 'roomRef' ? sel.entry.placeId : undefined;
  const isLibrary = placeId != null && LIBRARY_PLACE_IDS.has(placeId);
```
and inside the returned `<div>…</div>`, after the existing room fields, add:
```tsx
      {isLibrary && placeId != null && <LibraryRoomSection placeId={placeId} />}
```

- [ ] **Step 7: Trigger the availability load when the map opens**

In `src/components/CampusMap/CampusMapView.tsx`, the top-level map component, call the loader once on mount via the store (not a data-fetching `useEffect` of our own — reuse the existing mount hook pattern in that file; if it already calls `loadMapEvents()` on mount, add the sibling call). Find where `loadMapEvents` is invoked and add:
```tsx
  const loadLibraryAvailability = useAppStore((s) => s.loadLibraryAvailability);
  // in the same mount effect that calls loadMapEvents():
  void loadLibraryAvailability();
```
If `CampusMapView` has no such mount effect, add a minimal one dedicated to kicking off store loads (this is store-load orchestration, permitted; it does not fetch in the component):
```tsx
  useEffect(() => { void loadLibraryAvailability(); }, [loadLibraryAvailability]);
```

- [ ] **Step 8: Typecheck + run the affected tests**

Run: `npm run typecheck && npx vitest run src/components/CampusMap/__tests__/libraryStatus.test.ts`
Expected: no type errors; tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/CampusMap/LibraryRoomSection.tsx src/components/CampusMap/libraryStatus.ts src/components/CampusMap/DetailPanel.tsx src/components/CampusMap/CampusMapView.tsx src/components/CampusMap/__tests__/libraryStatus.test.ts
git commit -m "feat(library): detail-panel section with live status + reserve link"
```

---

### Task 8: Tint library room polygons by status on floor −1

**Files:**
- Modify: `src/components/CampusMap/mapHelpers.ts`
- Modify: `src/components/CampusMap/MapCanvas.tsx`

**Interfaces:**
- Consumes: `LIBRARY_PLACE_IDS`, `libraryRoomsByPlaceId` (Task 1); `computeNextSlot` (Task 2); store `libraryAvailability` (Task 5).
- Produces: exported `LIBRARY_FREE_STYLE`, `LIBRARY_BUSY_STYLE: PathOptions`.

- [ ] **Step 1: Add status styles to `mapHelpers.ts`**

After `SELECTED_STYLE` in `src/components/CampusMap/mapHelpers.ts`:
```ts
export const LIBRARY_FREE_STYLE: PathOptions = {
  color: '#15803d', weight: 2, fillColor: '#22c55e', fillOpacity: 0.55,
  bubblingMouseEvents: false,
};
export const LIBRARY_BUSY_STYLE: PathOptions = {
  color: '#57534e', weight: 1, fillColor: '#a8a29e', fillOpacity: 0.35,
  bubblingMouseEvents: false,
};
```

- [ ] **Step 2: Apply the tint in the `MapCanvas.tsx` redraw loop**

In the room-draw loop of `src/components/CampusMap/MapCanvas.tsx` (the `for (const f of feats …)` block), add imports at top:
```ts
import { LIBRARY_PLACE_IDS, libraryRoomsByPlaceId } from '@/data/map/libraryRooms';
import { computeNextSlot } from '@/services/library/nextSlot';
import { LIBRARY_FREE_STYLE, LIBRARY_BUSY_STYLE } from './mapHelpers';
```
Read availability from the store where the component already selects store state:
```ts
  const libraryAvailability = useAppStore((s) => s.libraryAvailability);
```
Inside the loop, after computing `base` and before constructing the polygon, override `base` for library rooms so the tint is stored as the room's `base` (this survives the re-highlight effect, per the store's restyle behaviour):
```ts
      let effectiveBase = base;
      if (LIBRARY_PLACE_IDS.has(p.id)) {
        const now = new Date();
        const free = libraryRoomsByPlaceId(p.id).some((room) => {
          const a = libraryAvailability[room.staffGuid];
          return a ? computeNextSlot(a.blocks, room.leadMinutes, now) !== null : false;
        });
        effectiveBase = free ? LIBRARY_FREE_STYLE : LIBRARY_BUSY_STYLE;
      }
      const poly = L.polygon(
        ringToLatLng(f.geometry.coordinates[0]),
        isSel ? SELECTED_STYLE : effectiveBase,
      );
```
And where the code stores the polygon for re-highlighting (`roomPolysRef.current.set(p.id, { poly, base })`), store `effectiveBase` instead:
```ts
        roomPolysRef.current.set(p.id, { poly, base: effectiveBase });
```
Add `libraryAvailability` to the redraw effect's dependency array so the tint updates when availability arrives.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Verify in the dev webapp**

Run the dev webapp and confirm the tint renders. Start `npm run dev:web`, open the map, navigate to building A / floor −1, and confirm the 6 library polygons render green (free) or muted (busy) and that clicking one opens the detail panel with a status badge and a "Rezervovat" link. (Use the browser preview tools; check the console for errors.)

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap/mapHelpers.ts src/components/CampusMap/MapCanvas.tsx
git commit -m "feat(library): tint study-room polygons by live availability"
```

---

### Task 9: Aggregate overview pin (`LibraryLayer`)

**Files:**
- Create: `src/components/CampusMap/LibraryLayer.tsx`
- Modify: `src/components/CampusMap/CampusMapView.tsx`

**Interfaces:**
- Consumes: `LIBRARY_ROOMS` (Task 1); `computeNextSlot` (Task 2); store `libraryAvailability` (Task 5), `activeBuildingId`, `focusRoomByCode`/room focus; `subscribeMapInstance` from `./mapInstance`.
- Produces: `<LibraryLayer />` — one HTML pin portalled into the `reisEvents` pane at the library coordinate, hidden in floor view.

Library pin coordinate (centroid of the Knihovna A cluster): `[16.6152, 49.20996]` as `[lng, lat]`.

- [ ] **Step 1: Write the component**

`src/components/CampusMap/LibraryLayer.tsx` (mirror `EventLayer.tsx`'s projection; single fixed point):
```tsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type * as LNS from 'leaflet';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { LIBRARY_ROOMS } from '@/data/map/libraryRooms';
import { computeNextSlot } from '@/services/library/nextSlot';
import { subscribeMapInstance } from './mapInstance';

const LIBRARY_COORD: [number, number] = [16.6152, 49.20996]; // [lng, lat]
const LIBRARY_BUILDING = 54678;

export function LibraryLayer() {
  const { t } = useTranslation();
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const availability = useAppStore((s) => s.libraryAvailability);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let map: LNS.Map | null = null;
    const recompute = () => {
      if (!map) return setPt(null);
      const p = map.latLngToLayerPoint([LIBRARY_COORD[1], LIBRARY_COORD[0]]);
      setPt({ x: p.x, y: p.y });
    };
    const unsub = subscribeMapInstance((m) => {
      map = m;
      if (!m) return;
      const p = m.getPane('reisEvents') ?? m.createPane('reisEvents');
      p.style.zIndex = '640';
      p.style.pointerEvents = 'none';
      setPane(p);
      m.on('move zoomend viewreset', recompute);
      recompute();
    });
    return () => {
      if (map) map.off('move zoomend viewreset', recompute);
      unsub();
    };
  }, []);

  if (activeBuildingId !== null || !pane || !pt) return null;

  const now = new Date();
  const freeCount = LIBRARY_ROOMS.filter((room) => {
    const a = availability[room.staffGuid];
    return a ? computeNextSlot(a.blocks, room.leadMinutes, now) !== null : false;
  }).length;

  return createPortal(
    <button
      type="button"
      className="pointer-events-auto absolute left-0 top-0 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-content leaflet-zoom-animated"
      style={{ transform: `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%)` }}
      onClick={() => focusRoomByCode('BA01P1049')}
    >
      {t('map.title')} · {t('map.libraryFreeToday', { count: freeCount })}
    </button>,
    pane,
  );
}
```
(`focusRoomByCode('BA01P1049')` flies to building A / floor −1 and selects Team Study Room 1; the student then sees the tinted zone and can pick any room.)

- [ ] **Step 2: Mount it in `CampusMapView.tsx`**

Add the import and render `<LibraryLayer />` as a sibling of `<EventLayer />`:
```tsx
import { LibraryLayer } from './LibraryLayer';
```
```tsx
      <EventLayer />
      <LibraryLayer />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Verify in the dev webapp**

With `npm run dev:web`, open the map in campus overview: confirm a "Mapa · N volné dnes" pill sits over building A, stays glued during pan/zoom, disappears when you drill into a building, and that clicking it flies to floor −1 with the library zone selected. Screenshot for the record.

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap/LibraryLayer.tsx src/components/CampusMap/CampusMapView.tsx
git commit -m "feat(library): aggregate overview pin with free-today count"
```

---

### Task 10: Reserve click analytics + full-suite gate

**Files:**
- Modify: `src/components/CampusMap/LibraryRoomSection.tsx`

**Interfaces:**
- Consumes: the existing usage/analytics helper. **Read `src/services/errorReporter/telemetry.ts` and search the codebase for `increment_post_click` / `daily_active_usage` first** to find the established fire-and-forget analytics call; reuse it. Do not invent a new table.

- [ ] **Step 1: Add a fire-and-forget counter to the Rezervovat link**

In `LibraryRoomSection.tsx`, add an `onClick` to the reserve `<a>` that records the click via the existing analytics helper (exact call name determined from the codebase in the interface note). Example shape if the helper is `recordUsage(event: string)`:
```tsx
            <a
              href={avail?.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary block text-sm"
              onClick={() => { void recordUsage?.('library_reserve_click'); }}
            >
              {t('map.libraryReserve')}
            </a>
```
If no generic client-side usage counter exists, skip the counter and instead add a `// TODO(analytics)` only if truly nothing fits — but first confirm by grepping `rg "daily_active_usage|increment_post" src`.

- [ ] **Step 2: Run the full unit suite**

Run: `npm run test:run`
Expected: all tests PASS (including the four new library test files).

- [ ] **Step 3: Lint the changed files**

Run: `npx eslint src/components/CampusMap/LibraryRoomSection.tsx src/components/CampusMap/MapCanvas.tsx src/api/libraryAvailability.ts src/store/slices/createMapSlice.ts src/services/library/nextSlot.ts --max-warnings=0`
Expected: no errors/warnings.

- [ ] **Step 4: Commit**

```bash
git add src/components/CampusMap/LibraryRoomSection.tsx
git commit -m "feat(library): record reserve click-throughs for the library"
```

---

## Self-review

**Spec coverage:**
- Anonymous availability read → Tasks 3–4. ✅
- Next-bookable-slot (never "free now"), 1h/2d lead → Task 2 + Task 7. ✅
- 7-room join table + libraryRooms.ts → Task 1. ✅
- Edge-fn proxy + 60s cache + admin-staff filter + graceful degradation → Task 3. ✅
- Store state + lazy load → Task 5. ✅
- Overview pin ("N volné dnes") → Task 9. ✅
- Room detail card (capacity/amenities/rules/status/Rezervovat) → Task 7. ✅
- Polygon tint by status → Task 8. ✅
- Per-room webUrl deep-link → Task 7. ✅
- i18n → Task 6. ✅
- Analytics giveback → Task 10. ✅
- Guardrails (no calendar, no polling, no new tab, DaisyUI only, no librarian names) → enforced by design; admin-staff filter in Task 3; no calendar/tab anywhere. ✅

**Deliberate scope cut vs spec:** the spec floated a special "Rezervace 2 dny předem" seminar treatment and a side-panel study-room list. Both dropped for simplicity — the seminar room's real next slot (≥2 days out) is computed and shown uniformly via `computeNextSlot`, and discovery is the overview pin, not a new tab. This honours "simplicity is best" and removes special cases.

**Type consistency:** `RoomAvailability`/`LibraryRoom`/`AvailabilityBlock` defined in Task 1 and used identically in Tasks 2/4/5/7/8/9. Store keys availability by `staffGuid` (string); map lookups go placeId → `libraryRoomsByPlaceId` → staffGuid, so the numeric-placeId map convention and the string-guid availability map coexist without collision (handles the shared IC placeId). `computeNextSlot(blocks, leadMinutes, now)` signature identical across all call sites.

**Placeholder scan:** no TBD/TODO except the single guarded analytics fallback in Task 10, which is explicitly conditioned on a codebase check.

## Known follow-ups (out of scope for this plan)
- **Timezone assumption:** slot math parses naive-local dateTimes as the client's local time (correct in CZ). If reIS ever serves users in other zones, compute in a fixed CET/CEST offset instead.
- **Path B (write / in-app booking):** deferred. Two routes investigated:
  - **Power Automate — ruled out.** The Power Automate Microsoft Bookings connector exposes no "Create appointment" action (only appointment *triggers* + a list-businesses action), so it cannot create bookings. Dead end.
  - **Graph delegated (`BookingsAppointment.ReadWrite.All`) — the live lead.** This *least-privileged delegated* scope supports `POST /appointments` and does **not** require tenant-admin — but it does require the tenant's **user-consent policy** to allow a user to self-consent an app. If allowed, the page owner grants a one-time delegated consent and a server-side flow creates bookings with the owner's refresh token. Preconditions to verify before pursuing: (1) tenant allows user consent for this scope; (2) accept the single-owner refresh-token fragility (breaks on password/MFA/CA changes). A separate spec if it proves viable.
