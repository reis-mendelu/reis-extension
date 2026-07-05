# Society Map-Mode Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the approved Society map-mode redesign into the reIS extension — "Moje akce" as a society-only panel tab, Akce-style rows, an in-panel composer with an in-app calendar and a Ve městě / Kampus venue picker (room search) — and delete the legacy modal, routing society login straight onto the map.

**Architecture:** The floating Student/Society toggle is removed; the panel tab bar (`MapSidePanel`) gains a society-only third tab whose selection *is* the mode (`setMapMode`). The composer moves inside `MyEventsPanel`. A new pure calendar util + `MiniCalendar` and a `ComposerRoomSearch` (over `rooms-index.json` + `roomCodeToCoord`) replace the native date input and add campus room selection. Society login (`enterSocietyMode`) flips the app to the map in society mode via the existing `mapFocusRequest` bridge.

**Tech Stack:** React 19, Zustand (sliced), Tailwind 4 + DaisyUI 5, TypeScript strict, Vitest + happy-dom + @testing-library/react, Leaflet.

## Global Constraints

- DaisyUI semantic classes only — NO custom CSS, NO raw hex (use `base-100/200/300`, `primary`, `error`, etc.). Society-color accents use `societyById(id).color` via inline `style`, matching existing convention.
- NO `useEffect` for data fetching. NO `localStorage`/`sessionStorage`. Max ~200 lines/file.
- Writes go through `adminAuthClient`-backed `createPost`/`updatePost`/`deletePost` (already so). Publishable-key only; no service_role.
- Coordinates are `[lng, lat]` everywhere. `buildings.json` `center` is `[lat, lng]`; `roomCodeToCoord` returns `[lng, lat]`.
- Date strings are local `YYYY-MM-DD` built from calendar parts — NEVER `.toISOString().slice(0,10)` (Europe/Prague is UTC+2; that shifts local-midnight dates back a day).
- i18n via `useTranslation()`; add every new string to BOTH `src/i18n/locales/en.json` and `cs.json` under the existing `map`/`admin` objects.
- Venue kinds in this UI are only `'offcampus'` and `'campus'` — NO `'online'`.
- Test-first: failing test → run it red → implement → run it green → commit.

### CodeRabbit findings this plan resolves (do not drop)
- **Critical** — `EventComposer.publish()` hardcodes `venueKind:'offcampus'`; editing a campus event rewrites its venue, and coord-gating blocks saves → **Task 4** (venue picker + preserve `venue_kind`/`room_code`/`category` on edit).
- **Major** — `EventDetailCard` delete ignores `{error}`, no in-flight guard, keeps stale selection, no confirm → **Task 9a**.
- **Major** — `MapCanvas` floor-view click can escape placement → **Task 9c** (root-cause fix: `beginPlacing` returns to overview).
- **Nitpick** — `EventLayer` scheduled flag from lead event only → **Task 9b** (`events.some`).
- **Nitpick** — `EventComposer` stale state on `editEventId` change → **Task 5** (`key={editEventId ?? 'new'}` forces remount).
- **Nitpick** — `MapModeToggle` ARIA → **moot**: the toggle is deleted (**Task 8**); the panel tab reuses `MapSidePanel`'s existing `role="tab"`/`aria-selected` pattern.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `src/components/CampusMap/EventRow.tsx` (new) | Shared rich event row (thumbnail + title + subline) used by EventsList and MyEventsPanel | 1 |
| `src/components/CampusMap/calendar.ts` (new) | Pure date-grid helpers (`monthMatrix`, `toISO`, `parseISO`, `addMonths`) | 2 |
| `src/components/CampusMap/MiniCalendar.tsx` (new) | DaisyUI dropdown month-grid date picker | 2 |
| `src/components/CampusMap/ComposerRoomSearch.tsx` (new) | Campus room typeahead → `{code,name,coord}` | 3 |
| `src/components/CampusMap/EventComposer.tsx` (modify) | Venue picker + calendar + room; preserve venue/room/category on edit; inline styling | 4 |
| `src/components/CampusMap/MyEventsPanel.tsx` (modify) | EventRow rows + in-panel composer + logout + action bar | 5 |
| `src/components/CampusMap/MapSidePanel.tsx` (modify) | Society-only "Moje akce" third tab drives `mapMode` | 6 |
| `src/store/slices/createAdminSlice.ts` + `src/store/types.ts` (modify) | `enterSocietyMode`, `openSocietyAdmin` | 7 |
| `src/components/SocietyAdmin/SocietyLoginForm.tsx` (modify) | On association login → `enterSocietyMode` | 7 |
| `src/components/SocietyAdmin/SocietyAdminOverlay.tsx` (modify) | Login-only (+ reis_admin note); drop SocietyPostManager | 8 |
| `src/components/SocietyAdmin/SocietyPostManager.tsx` (delete) + `MapModeToggle.tsx` (delete) | Remove legacy surfaces | 8 |
| `SpolkySection.tsx`, `ProfilePopup.tsx`, `MobileProfileSheet.tsx`, `CampusMapView.tsx` (modify) | Repoint triggers to `openSocietyAdmin`; drop toggle + floating composer | 8 |
| `src/components/CampusMap/EventDetailCard.tsx`, `EventLayer.tsx`, `createMapSlice.ts` (modify) | Delete safety, scheduled `.some`, placement overview guard | 9 |

---

### Task 1: Shared EventRow component

**Files:**
- Create: `src/components/CampusMap/EventRow.tsx`
- Modify: `src/components/CampusMap/EventsList.tsx` (replace internal `EventRow`, import the shared one)
- Test: `src/components/CampusMap/__tests__/EventRow.test.tsx`

**Interfaces:**
- Produces: `EventRow({ event, locale, t, selected, onClick, subline? }): JSX` — `subline?: string` overrides the default `day · time` line (used by MyEventsPanel for "goes live" text). When absent, falls back to `relativeDayLabel(event.date, locale, t)` + optional time. The location line always renders when `event.location` is set.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CampusMap/__tests__/EventRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventRow } from '../EventRow';
import type { MapEvent } from '../../../types/events';

const ev: MapEvent = {
  id: 'e1', title: 'Spring Party', url: '', date: '2026-07-10', endDate: null, time: '20:00',
  location: 'Klub Mandarin', imageUrl: null, organizerKey: 'pef', societyId: 'supef',
  coord: [16.6, 49.2], roomCode: null, venueKind: 'offcampus', category: 'party',
};
const t = (k: string) => k;

describe('EventRow', () => {
  it('renders the category emoji, title, and default day subline + location', () => {
    render(<EventRow event={ev} locale="cs-CZ" t={t} selected={false} onClick={() => {}} />);
    expect(screen.getByText('Spring Party')).toBeInTheDocument();
    expect(screen.getByText('Klub Mandarin')).toBeInTheDocument();
    const img = document.querySelector('img[src="/emoji/1f389.svg"]'); // 🎉 party
    expect(img).toBeTruthy();
  });

  it('uses the subline override when provided', () => {
    render(<EventRow event={ev} locale="cs-CZ" t={t} selected={false} onClick={() => {}} subline="zveřejní se 1. čvc" />);
    expect(screen.getByText('zveřejní se 1. čvc')).toBeInTheDocument();
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    render(<EventRow event={ev} locale="cs-CZ" t={t} selected onClick={onClick} />);
    screen.getByRole('button').click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (`Cannot find module '../EventRow'`)

Run: `npx vitest run src/components/CampusMap/__tests__/EventRow.test.tsx`

- [ ] **Step 3: Create `EventRow.tsx`** (lifted verbatim from EventsList's internal row, plus `subline` override)

```tsx
// src/components/CampusMap/EventRow.tsx
import { MapPin } from 'lucide-react';
import { CATEGORY_EMOJI_SRC } from '../../data/eventCategories';
import { relativeDayLabel } from './eventHelpers';
import type { MapEvent } from '../../types/events';

export function EventRow({ event, locale, t, selected, onClick, subline }: {
  event: MapEvent;
  locale: string;
  t: (k: string) => string;
  selected: boolean;
  onClick: () => void;
  subline?: string;
}) {
  const day = subline ?? `${relativeDayLabel(event.date, locale, t)}${event.time ? ` · ${event.time}` : ''}`;
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left transition-colors ${
        selected ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-base-200'
      }`}
    >
      <span className="h-[52px] w-[52px] flex-shrink-0 overflow-hidden rounded-lg">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-base-200">
            <img src={CATEGORY_EMOJI_SRC[event.category]} alt="" className="h-7 w-7" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-base-content">{event.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-base-content/60">{day}</span>
        {event.location && (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-base-content/60">
            <MapPin size={11} className="flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </span>
        )}
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Refactor EventsList to use it.** In `src/components/CampusMap/EventsList.tsx`: delete the local `function EventRow(...)` block (lines ~11–49) and its now-unused imports (`CATEGORY_EMOJI_SRC`, `MapPin`, `relativeDayLabel` stays used elsewhere? it was only used in the row — remove from this file). Add `import { EventRow } from './EventRow';`. The render site already calls `<EventRow event={e} locale={locale} t={t} selected={...} onClick={...} />` — keep it; ensure the props match (`t` is `useTranslation().t`).

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx vitest run src/components/CampusMap/__tests__/EventRow.test.tsx src/components/CampusMap/__tests__/EventsList.test.tsx`
Expected: PASS (EventsList test unchanged behavior).

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/EventRow.tsx src/components/CampusMap/EventsList.tsx src/components/CampusMap/__tests__/EventRow.test.tsx
git commit -m "refactor(map): extract shared EventRow from EventsList"
```

---

### Task 2: MiniCalendar (pure helpers + component)

**Files:**
- Create: `src/components/CampusMap/calendar.ts`, `src/components/CampusMap/MiniCalendar.tsx`
- Test: `src/components/CampusMap/__tests__/calendar.test.ts`, `src/components/CampusMap/__tests__/MiniCalendar.test.tsx`

**Interfaces:**
- Produces (`calendar.ts`): `toISO(y:number, m0:number, d:number): string` (`m0` is 0-based month, returns `YYYY-MM-DD`); `parseISO(iso:string): {y:number;m0:number;d:number} | null`; `monthMatrix(y:number, m0:number): (number|null)[][]` (weeks of 7, Monday-first, `null` pads); `addMonths(y:number, m0:number, delta:number): {y:number;m0:number}`.
- Produces (`MiniCalendar.tsx`): `MiniCalendar({ value, onChange, placeholder, t, locale }): JSX` — `value: string|null` ISO, `onChange:(iso:string)=>void`, `placeholder:string`, `t:(k:string)=>string`, `locale:string`.

- [ ] **Step 1: Write failing tests for the pure helpers**

```ts
// src/components/CampusMap/__tests__/calendar.test.ts
import { describe, it, expect } from 'vitest';
import { toISO, parseISO, monthMatrix, addMonths } from '../calendar';

describe('calendar helpers', () => {
  it('toISO builds a local YYYY-MM-DD (no UTC shift)', () => {
    expect(toISO(2026, 7, 2)).toBe('2026-08-02'); // m0=7 → August
    expect(toISO(2026, 0, 5)).toBe('2026-01-05');
  });
  it('parseISO round-trips', () => {
    expect(parseISO('2026-08-02')).toEqual({ y: 2026, m0: 7, d: 2 });
    expect(parseISO('nonsense')).toBeNull();
  });
  it('addMonths wraps the year', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ y: 2027, m0: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ y: 2025, m0: 11 });
  });
  it('monthMatrix is Monday-first and pads with null', () => {
    // July 2026: 1st is a Wednesday (Mon-first index 2) → first row starts null,null,1
    const wk = monthMatrix(2026, 6);
    expect(wk[0].slice(0, 3)).toEqual([null, null, 1]);
    expect(wk.flat().filter((d) => d !== null)).toHaveLength(31);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/components/CampusMap/__tests__/calendar.test.ts`

- [ ] **Step 3: Implement `calendar.ts`**

```ts
// src/components/CampusMap/calendar.ts
const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(y: number, m0: number, d: number): string {
  return `${y}-${pad(m0 + 1)}-${pad(d)}`;
}

export function parseISO(iso: string): { y: number; m0: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m0: Number(m[2]) - 1, d: Number(m[3]) };
}

export function addMonths(y: number, m0: number, delta: number): { y: number; m0: number } {
  const total = y * 12 + m0 + delta;
  return { y: Math.floor(total / 12), m0: ((total % 12) + 12) % 12 };
}

export function monthMatrix(y: number, m0: number): (number | null)[][] {
  const firstDow = (new Date(y, m0, 1).getDay() + 6) % 7; // Monday-first
  const days = new Date(y, m0 + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: firstDow }, () => null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
```

- [ ] **Step 4: Run helpers test — expect PASS**

Run: `npx vitest run src/components/CampusMap/__tests__/calendar.test.ts`

- [ ] **Step 5: Write failing MiniCalendar component test**

```tsx
// src/components/CampusMap/__tests__/MiniCalendar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MiniCalendar } from '../MiniCalendar';

const t = (k: string) => k;

describe('MiniCalendar', () => {
  it('shows the placeholder when empty and opens a grid', () => {
    render(<MiniCalendar value={null} onChange={() => {}} placeholder="Pick a date" t={t} locale="cs-CZ" />);
    fireEvent.click(screen.getByText('Pick a date'));
    // a day button from some month is present
    expect(screen.getAllByRole('button').length).toBeGreaterThan(10);
  });

  it('emits YYYY-MM-DD when a day is clicked', () => {
    const onChange = vi.fn();
    render(<MiniCalendar value="2026-07-01" onChange={onChange} placeholder="Pick a date" t={t} locale="cs-CZ" />);
    fireEvent.click(screen.getByRole('button', { name: /2026-07-01|1\. .*2026|Datum|Pick/i }).closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    expect(onChange).toHaveBeenCalledWith('2026-07-15');
  });
});
```

- [ ] **Step 6: Run — expect FAIL**

Run: `npx vitest run src/components/CampusMap/__tests__/MiniCalendar.test.tsx`

- [ ] **Step 7: Implement `MiniCalendar.tsx`** (DaisyUI `dropdown`, no native input; month state via `useState`, which is UI state not data — allowed)

```tsx
// src/components/CampusMap/MiniCalendar.tsx
import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { toISO, parseISO, monthMatrix, addMonths } from './calendar';

const DOW = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export function MiniCalendar({ value, onChange, placeholder, t, locale }: {
  value: string | null;
  onChange: (iso: string) => void;
  placeholder: string;
  t: (k: string) => string;
  locale: string;
}) {
  const parsed = value ? parseISO(value) : null;
  const [view, setView] = useState(() => parsed ?? { y: new Date().getFullYear(), m0: new Date().getMonth() });
  const [open, setOpen] = useState(false);
  const label = value ? new Date(`${value}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : placeholder;
  const monthLabel = new Date(view.y, view.m0, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <div className="dropdown w-full">
      <button
        type="button" tabIndex={0}
        className={`input input-bordered flex w-full items-center gap-2 ${value ? '' : 'text-base-content/50'}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Calendar size={16} className="opacity-70" />
        <span className="truncate">{label}</span>
      </button>
      {open && (
        <div tabIndex={0} className="dropdown-content z-[70] mt-1 w-64 rounded-box border border-base-300 bg-base-100 p-3 shadow-popover-heavy">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="btn btn-ghost btn-xs" aria-label="prev" onClick={() => setView((v) => addMonths(v.y, v.m0, -1))}><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold capitalize">{monthLabel}</span>
            <button type="button" className="btn btn-ghost btn-xs" aria-label="next" onClick={() => setView((v) => addMonths(v.y, v.m0, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-base-content/50">
            {DOW.map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthMatrix(view.y, view.m0).flat().map((d, i) => {
              if (d === null) return <span key={i} />;
              const iso = toISO(view.y, view.m0, d);
              const sel = iso === value;
              return (
                <button
                  key={i} type="button"
                  className={`btn btn-ghost btn-xs h-8 w-8 p-0 tabular-nums ${sel ? 'btn-primary' : ''}`}
                  onClick={() => { onChange(iso); setOpen(false); }}
                >{d}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run MiniCalendar test — expect PASS**

Run: `npx vitest run src/components/CampusMap/__tests__/MiniCalendar.test.tsx`

- [ ] **Step 9: Commit**

```bash
git add src/components/CampusMap/calendar.ts src/components/CampusMap/MiniCalendar.tsx src/components/CampusMap/__tests__/calendar.test.ts src/components/CampusMap/__tests__/MiniCalendar.test.tsx
git commit -m "feat(map): in-app MiniCalendar date picker (no native input)"
```

---

### Task 3: ComposerRoomSearch (campus room typeahead)

**Files:**
- Create: `src/components/CampusMap/ComposerRoomSearch.tsx`
- Test: `src/components/CampusMap/__tests__/ComposerRoomSearch.test.tsx`

**Interfaces:**
- Consumes: `roomCodeToCoord(code, index, buildings): [number,number] | null` from `./mapHelpers`; `rooms-index.json` (`RoomIndexEntry[] = {code,name,buildingId,...}`), `buildings.json` (`BuildingsMeta`).
- Produces: `ComposerRoomSearch({ selected, onSelect, onClear, t }): JSX` — `selected: {code:string;name:string}|null`; `onSelect:(sel:{code:string;name:string;coord:[number,number]})=>void`; `onClear:()=>void`; `t:(k:string)=>string`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CampusMap/__tests__/ComposerRoomSearch.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposerRoomSearch } from '../ComposerRoomSearch';

const t = (k: string) => k;

describe('ComposerRoomSearch', () => {
  it('filters rooms by name and resolves a coord on select', () => {
    const onSelect = vi.fn();
    render(<ComposerRoomSearch selected={null} onSelect={onSelect} onClear={() => {}} t={t} />);
    fireEvent.change(screen.getByPlaceholderText('map.searchRoom'), { target: { value: 'Q6.06' } });
    const hit = screen.getByText('Q6.06');
    fireEvent.click(hit);
    expect(onSelect).toHaveBeenCalledTimes(1);
    const arg = onSelect.mock.calls[0][0];
    expect(arg.name).toBe('Q6.06');
    expect(Array.isArray(arg.coord)).toBe(true);
    expect(arg.coord).toHaveLength(2); // [lng, lat]
  });

  it('shows the selected room with a change button', () => {
    const onClear = vi.fn();
    render(<ComposerRoomSearch selected={{ code: 'X', name: 'Q6.06' }} onSelect={() => {}} onClear={onClear} t={t} />);
    expect(screen.getByText(/Q6\.06/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'map.changePlace' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/components/CampusMap/__tests__/ComposerRoomSearch.test.tsx`

- [ ] **Step 3: Implement `ComposerRoomSearch.tsx`** (`useState` query is UI state — allowed; no data fetching)

```tsx
// src/components/CampusMap/ComposerRoomSearch.tsx
import { useState } from 'react';
import { Check, MapPin, Search } from 'lucide-react';
import roomsIndexJson from '../../data/map/rooms-index.json';
import buildingsJson from '../../data/map/buildings.json';
import { roomCodeToCoord, type RoomIndexEntry } from './mapHelpers';
import type { BuildingsMeta } from '../../types/map';

const INDEX = roomsIndexJson as RoomIndexEntry[];
const BUILDINGS = buildingsJson as unknown as BuildingsMeta;

export function ComposerRoomSearch({ selected, onSelect, onClear, t }: {
  selected: { code: string; name: string } | null;
  onSelect: (sel: { code: string; name: string; coord: [number, number] }) => void;
  onClear: () => void;
  t: (k: string) => string;
}) {
  const [q, setQ] = useState('');

  if (selected) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
        <Check size={14} className="text-success" />
        <span className="min-w-0 flex-1 truncate">{selected.name}</span>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onClear}>{t('map.changePlace')}</button>
      </div>
    );
  }

  const ql = q.trim().toLowerCase();
  const matches = ql
    ? INDEX.filter((r) => r.code.toLowerCase().includes(ql) || r.name.toLowerCase().includes(ql)).slice(0, 6)
    : [];

  return (
    <div className="mt-2">
      <label className="input input-bordered flex items-center gap-2">
        <Search size={15} className="opacity-60" />
        <input className="grow" placeholder={t('map.searchRoom')} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </label>
      {ql && (
        <div className="mt-1 flex max-h-40 flex-col overflow-y-auto">
          {matches.length === 0 && <p className="px-2 py-3 text-center text-xs text-base-content/50">{t('map.noRoomFound')}</p>}
          {matches.map((r) => {
            const coord = roomCodeToCoord(r.code, INDEX, BUILDINGS);
            if (!coord) return null;
            return (
              <button
                key={r.code} type="button"
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-base-200"
                onClick={() => onSelect({ code: r.code, name: r.name, coord })}
              >
                <MapPin size={13} className="flex-shrink-0 opacity-60" />
                <span className="font-semibold">{r.name}</span>
                <span className="truncate text-[11px] text-base-content/50">{r.code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

> Note: confirm `RoomIndexEntry` is exported from `mapHelpers.ts` and `BuildingsMeta` from `src/types/map.ts`. If `RoomIndexEntry` is not exported, add `export` to its declaration (it is used by `roomCodeToCoord`'s signature). If `BuildingsMeta` lives elsewhere, import from its real path (grep `type BuildingsMeta`).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/components/CampusMap/__tests__/ComposerRoomSearch.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap/ComposerRoomSearch.tsx src/components/CampusMap/__tests__/ComposerRoomSearch.test.tsx
git commit -m "feat(map): campus room search for the event composer"
```

---

### Task 4: EventComposer — venue picker, calendar, edit preservation

**Files:**
- Modify: `src/components/CampusMap/EventComposer.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json` (add `map.venueOffcampus`, `map.venueCampus`, `map.venueLabel`, `map.searchRoom`, `map.noRoomFound`, `map.selectDate`)
- Test: `src/components/CampusMap/__tests__/EventComposer.test.tsx` (extend)

**Interfaces:**
- Consumes: `MiniCalendar` (Task 2), `ComposerRoomSearch` (Task 3), store `draftCoord`/`beginPlacing`/`clearDraftCoord`/`editEventId`/`societyMapEvents`/`loadSocietyPosts`/`adminAssociationId`/`adminSession`; `createPost`/`updatePost`/`PostInput` from `../../api/societyPosts`.
- Produces: `EventComposer({ onDone }): JSX` — publishes with per-venue coord, preserves `venue_kind`/`room_code`/`category` on edit.

- [ ] **Step 1: Add i18n keys** to both locale files' `map` object.

`en.json`: `"venueLabel": "Where", "venueOffcampus": "In town", "venueCampus": "Campus", "searchRoom": "Search room or building…", "noRoomFound": "Nothing found.", "selectDate": "Pick a date"`
`cs.json`: `"venueLabel": "Kde", "venueOffcampus": "Ve městě", "venueCampus": "Kampus", "searchRoom": "Hledat místnost nebo budovu…", "noRoomFound": "Nic nenalezeno.", "selectDate": "Vyberte datum"`

- [ ] **Step 2: Write the failing tests** (replace the file's create/edit blocks). The mock stubs the API and store.

```tsx
// src/components/CampusMap/__tests__/EventComposer.test.tsx  (key cases)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventComposer } from '../EventComposer';

const createPost = vi.fn(async () => ({ id: 'new' }));
const updatePost = vi.fn(async () => ({}));
vi.mock('../../../api/societyPosts', () => ({
  createPost: (...a: unknown[]) => createPost(...a),
  updatePost: (...a: unknown[]) => updatePost(...a),
}));

beforeEach(() => {
  createPost.mockClear(); updatePost.mockClear();
  useAppStore.setState({
    language: 'cs', adminAssociationId: 'supef',
    adminSession: { user: { email: 'admin@supef.cz' } } as never,
    draftCoord: null, editEventId: null, composerOpen: true,
    societyMapEvents: [], loadSocietyPosts: vi.fn(async () => {}),
  });
});

describe('EventComposer publish', () => {
  it('creates an offcampus event with the placed coord', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('map.eventName'), { target: { value: 'Party' } });
    useAppStore.setState({ /* date chosen via calendar → simulate by setting through UI not possible; drive via re-render */ });
    // choose date through MiniCalendar
    fireEvent.click(screen.getByText('map.selectDate'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    fireEvent.click(screen.getByRole('button', { name: 'map.publish' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0] as { venueKind: string; coordLng: number; coordLat: number };
    expect(input.venueKind).toBe('offcampus');
    expect(input.coordLng).toBe(16.61);
  });

  it('preserves venue_kind=campus and room_code when editing a campus event', async () => {
    useAppStore.setState({
      editEventId: 'c1',
      societyMapEvents: [{
        id: 'c1', title: 'Deskovky', url: '', date: '2026-07-08', endDate: null, time: null,
        location: 'Q6.06', imageUrl: null, organizerKey: 'pef', societyId: 'supef',
        coord: [16.614, 49.209], roomCode: 'BA39N6006', venueKind: 'campus', category: 'boardgames',
      }],
    });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'map.saveChanges' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    const patch = updatePost.mock.calls[0][1] as { venue_kind: string; room_code: string; category: string };
    expect(patch.venue_kind).toBe('campus');
    expect(patch.room_code).toBe('BA39N6006');
    expect(patch.category).toBe('boardgames');
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npx vitest run src/components/CampusMap/__tests__/EventComposer.test.tsx`

- [ ] **Step 4: Rewrite `EventComposer.tsx`** (inline styling — no floating card; the parent panel provides the card)

```tsx
// src/components/CampusMap/EventComposer.tsx
import { useState } from 'react';
import { CalendarPlus, MapPin, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createPost, updatePost, type PostInput } from '../../api/societyPosts';
import { isScheduledEvent, goLiveDate } from './eventWindow';
import { MiniCalendar } from './MiniCalendar';
import { ComposerRoomSearch } from './ComposerRoomSearch';

export function EventComposer({ onDone }: { onDone: () => void }) {
  const associationId = useAppStore((s) => s.adminAssociationId);
  const email = useAppStore((s) => s.adminSession?.user.email ?? '');
  const draftCoord = useAppStore((s) => s.draftCoord);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const clearDraftCoord = useAppStore((s) => s.clearDraftCoord);
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const editId = useAppStore((s) => s.editEventId);
  const editing = useAppStore((s) => s.societyMapEvents.find((e) => e.id === s.editEventId) ?? null);
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const [title, setTitle] = useState(editing?.title ?? '');
  const [date, setDate] = useState(editing?.date ?? '');
  const [venue, setVenue] = useState<'offcampus' | 'campus'>(editing?.venueKind === 'campus' ? 'campus' : 'offcampus');
  const [room, setRoom] = useState<{ code: string; name: string; coord: [number, number] } | null>(
    editing && editing.venueKind === 'campus' && editing.roomCode && editing.coord
      ? { code: editing.roomCode, name: editing.location ?? editing.roomCode, coord: editing.coord }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const coord = venue === 'campus' ? room?.coord ?? null : draftCoord;
  const ready = !!title.trim() && !!date && !!coord;
  const scheduled = date ? isScheduledEvent(date) : false;

  const close = () => { clearDraftCoord(); onDone(); };

  const switchVenue = (v: 'offcampus' | 'campus') => {
    if (v === venue) return;
    setVenue(v);
    setRoom(null);
    if (v === 'campus') clearDraftCoord();
  };

  const publish = async () => {
    if (!ready || busy || !associationId || !coord) return;
    setBusy(true); setError(false);
    const input: PostInput = {
      title: title.trim(), body: '', category: editing?.category ?? 'party', date,
      venueKind: venue, roomCode: venue === 'campus' ? room?.code ?? null : null,
      coordLng: coord[0], coordLat: coord[1],
    };
    try {
      const res = editId
        ? await updatePost(editId, {
            title: input.title, date: input.date, category: input.category,
            venue_kind: input.venueKind, room_code: input.roomCode ?? null,
            coord_lng: input.coordLng, coord_lat: input.coordLat,
          })
        : await createPost(input, associationId, email);
      if (res.error) { setError(true); return; }
      await loadSocietyPosts();
      close();
    } catch { setError(true); } finally { setBusy(false); }
  };

  return (
    <div className="border-b border-base-300 bg-base-200/60 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20"><CalendarPlus size={14} className="text-primary" /></span>
        <span className="text-sm font-bold">{editId ? t('map.editEvent') : t('map.createEvent')}</span>
        <button type="button" className="btn btn-ghost btn-xs ml-auto" aria-label={t('common.cancel')} onClick={close}><X size={15} /></button>
      </div>

      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">{t('map.eventName')}</label>
      <input className="input input-bordered w-full" placeholder={t('map.eventName')} value={title} onChange={(e) => setTitle(e.target.value)} />

      <label className="mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">{t('map.eventDate')}</label>
      <MiniCalendar value={date || null} onChange={setDate} placeholder={t('map.selectDate')} t={t} locale={locale} />
      {scheduled && (
        <p className="mt-1.5 text-[11px] text-warning">{t('map.goesLive')} {goLiveDate(date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</p>
      )}

      <label className="mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">{t('map.venueLabel')}</label>
      <div className="flex gap-2">
        <button type="button" className={`btn btn-sm flex-1 gap-1 ${venue === 'offcampus' ? 'btn-primary' : 'btn-outline'}`} onClick={() => switchVenue('offcampus')}>
          <MapPin size={13} /> {t('map.venueOffcampus')}
        </button>
        <button type="button" className={`btn btn-sm flex-1 gap-1 ${venue === 'campus' ? 'btn-primary' : 'btn-outline'}`} onClick={() => switchVenue('campus')}>
          {t('map.venueCampus')}
        </button>
      </div>

      {venue === 'campus' ? (
        <ComposerRoomSearch selected={room ? { code: room.code, name: room.name } : null} onSelect={setRoom} onClear={() => setRoom(null)} t={t} />
      ) : (
        <>
          <button type="button" className={`btn btn-sm mt-2 w-full gap-2 ${draftCoord ? 'btn-outline' : 'btn-ghost border border-dashed border-base-content/30'}`} onClick={beginPlacing}>
            <MapPin size={14} /> {draftCoord ? t('map.changePlace') : t('map.selectPlace')}
          </button>
          <p className="mt-1.5 text-[11px] text-base-content/50">{draftCoord ? '' : t('map.clickToPlace')}</p>
        </>
      )}

      {error && <p className="mt-2 text-[11px] text-error">{t('admin.saveError')}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={close}>{t('common.cancel')}</button>
        <button type="button" className="btn btn-primary btn-sm flex-1" disabled={!ready || busy} onClick={publish}>
          {editId ? t('map.saveChanges') : t('map.publish')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run — expect PASS** (adjust the create test's date-selection interaction if the MiniCalendar month differs; the calendar opens on today's month — click prev/next until `15` of the intended month is present, or set the composer's initial date by seeding `editing`/state — keep the assertion on `venueKind`/coords).

Run: `npx vitest run src/components/CampusMap/__tests__/EventComposer.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/EventComposer.tsx src/components/CampusMap/__tests__/EventComposer.test.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat(map): composer venue picker (town/campus) + calendar; preserve venue/room/category on edit"
```

---

### Task 5: MyEventsPanel — EventRow rows, in-panel composer, logout

**Files:**
- Modify: `src/components/CampusMap/MyEventsPanel.tsx`
- Test: `src/components/CampusMap/__tests__/MyEventsPanel.test.tsx` (extend)

**Interfaces:**
- Consumes: `EventRow` (Task 1), `EventComposer` (Task 4), store `societyMapEvents`/`focusEventById`/`openComposer`/`composerOpen`/`editEventId`/`closeComposer`/`adminLogout`/`adminAssociationId`; `societyById` from `../../data/societies`.
- Produces: society-mode panel body with sections + inline composer + logout.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/CampusMap/__tests__/MyEventsPanel.test.tsx (key additions)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MyEventsPanel } from '../MyEventsPanel';

beforeEach(() => {
  useAppStore.setState({
    language: 'cs', adminAssociationId: 'supef', composerOpen: false, editEventId: null,
    societyMapEvents: [{
      id: 'e1', title: 'Spring Party', url: '', date: '2026-07-10', endDate: null, time: '20:00',
      location: 'Klub', imageUrl: null, organizerKey: 'pef', societyId: 'supef',
      coord: [16.6, 49.2], roomCode: null, venueKind: 'offcampus', category: 'party',
    }],
    openComposer: vi.fn(), adminLogout: vi.fn(async () => {}),
  });
});

describe('MyEventsPanel', () => {
  it('renders own events as rich rows with the thumbnail', () => {
    render(<MyEventsPanel />);
    expect(screen.getByText('Spring Party')).toBeInTheDocument();
    expect(document.querySelector('img[src="/emoji/1f389.svg"]')).toBeTruthy();
  });

  it('Create calls openComposer with no id', () => {
    const openComposer = vi.fn();
    useAppStore.setState({ openComposer });
    render(<MyEventsPanel />);
    screen.getByRole('button', { name: /map\.createEvent/ }).click();
    expect(openComposer).toHaveBeenCalledWith();
  });

  it('shows the inline composer when composerOpen', () => {
    useAppStore.setState({ composerOpen: true, closeComposer: vi.fn() });
    render(<MyEventsPanel />);
    expect(screen.getByPlaceholderText('map.eventName')).toBeInTheDocument();
  });

  it('logout calls adminLogout', () => {
    const adminLogout = vi.fn(async () => {});
    useAppStore.setState({ adminLogout });
    render(<MyEventsPanel />);
    screen.getByRole('button', { name: 'admin.logout' }).click();
    expect(adminLogout).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/components/CampusMap/__tests__/MyEventsPanel.test.tsx`

- [ ] **Step 3: Rewrite `MyEventsPanel.tsx`**

```tsx
// src/components/CampusMap/MyEventsPanel.tsx
import { LogOut, Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { sortByDate } from './eventHelpers';
import { isPastEvent, isScheduledEvent, goLiveDate } from './eventWindow';
import { societyById } from '../../data/societies';
import { EventRow } from './EventRow';
import { EventComposer } from './EventComposer';
import type { MapEvent } from '../../types/events';

export function MyEventsPanel() {
  const events = useAppStore((s) => s.societyMapEvents);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const openComposer = useAppStore((s) => s.openComposer);
  const composerOpen = useAppStore((s) => s.composerOpen);
  const editEventId = useAppStore((s) => s.editEventId);
  const closeComposer = useAppStore((s) => s.closeComposer);
  const adminLogout = useAppStore((s) => s.adminLogout);
  const assocId = useAppStore((s) => s.adminAssociationId);
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const soc = assocId ? societyById(assocId) : null;

  const past = sortByDate(events.filter((e) => isPastEvent(e.date))).reverse();
  const scheduled = sortByDate(events.filter((e) => isScheduledEvent(e.date)));
  const live = sortByDate(events.filter((e) => !isPastEvent(e.date) && !isScheduledEvent(e.date)));
  const goLive = (e: MapEvent) => `${t('map.goesLive')} ${goLiveDate(e.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;

  const section = (label: string, rows: MapEvent[], subline?: (e: MapEvent) => string) =>
    rows.length > 0 && (
      <div>
        <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-base-content/60">{label}</div>
        {rows.map((e) => (
          <EventRow key={e.id} event={e} locale={locale} t={t} selected={false} subline={subline?.(e)} onClick={() => focusEvent(e.id, { fly: true })} />
        ))}
      </div>
    );

  return (
    <div className="flex max-h-[80vh] flex-col">
      <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: soc?.color ?? 'var(--fallback-p,#0046a0)' }}>
          {soc?.shortName?.slice(0, 2).toUpperCase() ?? '•'}
        </span>
        <span className="text-sm font-bold">{soc?.name ?? t('map.myEvents')}</span>
        <button type="button" className="btn btn-primary btn-xs ml-auto gap-1" onClick={() => openComposer()}>
          <Plus size={13} /> {t('map.createEvent')}
        </button>
      </div>

      {composerOpen && <EventComposer key={editEventId ?? 'new'} onDone={closeComposer} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {section(t('map.liveNow'), live)}
        {section(t('map.scheduled'), scheduled, goLive)}
        {section(t('map.past'), past)}
        {events.length === 0 && <p className="px-3 py-6 text-center text-sm text-base-content/60">{t('map.noOwnEvents')}</p>}
      </div>

      <div className="border-t border-base-300 px-3 py-2">
        <button type="button" className="btn btn-ghost btn-xs gap-1.5 text-base-content/60" onClick={() => void adminLogout()}>
          <LogOut size={13} /> {t('admin.logout')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/components/CampusMap/__tests__/MyEventsPanel.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap/MyEventsPanel.tsx src/components/CampusMap/__tests__/MyEventsPanel.test.tsx
git commit -m "feat(map): MyEventsPanel adopts EventRow + hosts composer inline + logout"
```

---

### Task 6: MapSidePanel — society-only "Moje akce" third tab

**Files:**
- Modify: `src/components/CampusMap/MapSidePanel.tsx`
- Test: `src/components/CampusMap/__tests__/MapSidePanel.test.tsx` (create)

**Interfaces:**
- Consumes: store `mapMode`/`setMapMode`/`mapPanelTab`/`setMapPanelTab`/`adminRole`/`adminAssociationId`; `MyEventsPanel`, `EventsList`, `LandmarkPicker`, `societyById`.
- Behavior: tab `mine` shown only when `adminRole === 'association'`; active tab = `mapMode === 'society' ? 'mine' : mapPanelTab`. Selecting `mine` → `setMapMode('society')`; selecting `events`/`places` → `setMapMode('student')` (if currently society) + `setMapPanelTab(key)`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CampusMap/__tests__/MapSidePanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MapSidePanel } from '../MapSidePanel';

beforeEach(() => {
  useAppStore.setState({
    language: 'cs', mapMode: 'student', mapPanelTab: 'events', adminRole: null, adminAssociationId: null,
    mapEvents: [], societyMapEvents: [], eventFilter: 'all', mapSelection: null,
    setMapMode: vi.fn(), setMapPanelTab: vi.fn(),
  });
});

describe('MapSidePanel tabs', () => {
  it('shows two tabs for a normal student', () => {
    render(<MapSidePanel />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('shows the third "Moje akce" tab for an association', () => {
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef' });
    render(<MapSidePanel />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });

  it('clicking the society tab enters society mode', () => {
    const setMapMode = vi.fn();
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef', setMapMode });
    render(<MapSidePanel />);
    screen.getByRole('tab', { name: /map\.myEvents/ }).click();
    expect(setMapMode).toHaveBeenCalledWith('society');
  });

  it('clicking Events from society mode returns to student mode', () => {
    const setMapMode = vi.fn();
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef', mapMode: 'society', setMapMode });
    render(<MapSidePanel />);
    screen.getByRole('tab', { name: /map\.events/ }).click();
    expect(setMapMode).toHaveBeenCalledWith('student');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/components/CampusMap/__tests__/MapSidePanel.test.tsx`

- [ ] **Step 3: Rewrite `MapSidePanel.tsx`** (single card; no early return)

```tsx
// src/components/CampusMap/MapSidePanel.tsx
import type { ReactNode } from 'react';
import { MapPin, PartyPopper, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { societyById } from '../../data/societies';
import { LandmarkPicker } from './LandmarkPicker';
import { EventsList } from './EventsList';
import { MyEventsPanel } from './MyEventsPanel';

type TabKey = 'events' | 'places' | 'mine';

export function MapSidePanel() {
  const mode = useAppStore((s) => s.mapMode);
  const setMode = useAppStore((s) => s.setMapMode);
  const tab = useAppStore((s) => s.mapPanelTab);
  const setTab = useAppStore((s) => s.setMapPanelTab);
  const role = useAppStore((s) => s.adminRole);
  const assocId = useAppStore((s) => s.adminAssociationId);
  const { t } = useTranslation();

  const isSociety = mode === 'society';
  const active: TabKey = isSociety ? 'mine' : tab;
  const soc = assocId ? societyById(assocId) : null;

  const select = (key: TabKey) => {
    if (key === 'mine') { setMode('society'); return; }
    if (isSociety) setMode('student');
    setTab(key);
  };

  const tabBtn = (key: TabKey, icon: ReactNode, label: string) => (
    <button
      type="button" role="tab" id={`map-tab-${key}`}
      aria-selected={active === key} aria-controls="map-tabpanel"
      className={`tab gap-1.5 ${active === key ? 'tab-active font-semibold' : ''}`}
      onClick={() => select(key)}
    >
      {icon}{label}
    </button>
  );

  return (
    <div className="flex max-h-[80vh] w-64 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100/95 shadow-popover-heavy backdrop-blur-sm">
      <div role="tablist" className="tabs tabs-box tabs-sm m-1 mb-0 shrink-0">
        {tabBtn('events', <PartyPopper size={13} />, t('map.events'))}
        {tabBtn('places', <MapPin size={13} />, t('map.places'))}
        {role === 'association' && tabBtn('mine',
          <Sparkles size={13} style={{ color: soc?.color }} />, t('map.myEvents'))}
      </div>
      <div id="map-tabpanel" role="tabpanel" aria-labelledby={`map-tab-${active}`} className="min-h-0 flex-1 overflow-y-auto">
        {isSociety ? <MyEventsPanel /> : active === 'places' ? <LandmarkPicker /> : <EventsList />}
      </div>
    </div>
  );
}
```

> Note: `MyEventsPanel` now renders inside the tabpanel scroll container. Remove `MyEventsPanel`'s own outer `max-h-[80vh]` wrapper if double-scroll appears — keep its inner structure; the panel card already scrolls. (Adjust only if the reviewer/tests flag it.)

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/components/CampusMap/__tests__/MapSidePanel.test.tsx src/components/CampusMap/__tests__/MyEventsPanel.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap/MapSidePanel.tsx src/components/CampusMap/__tests__/MapSidePanel.test.tsx
git commit -m "feat(map): society-only 'Moje akce' third panel tab drives map mode"
```

---

### Task 7: enterSocietyMode + openSocietyAdmin; route login to the map

**Files:**
- Modify: `src/store/types.ts` (AdminSlice interface), `src/store/slices/createAdminSlice.ts`
- Modify: `src/components/SocietyAdmin/SocietyLoginForm.tsx`
- Test: `src/store/slices/__tests__/createAdminSlice.test.ts` (extend), `src/components/SocietyAdmin/__tests__/SocietyLoginForm.test.tsx` (extend/create)

**Interfaces:**
- Produces: `enterSocietyMode(): void` — `setMapMode('society')` + `focusCampus()` (bumps `mapFocusRequest` → app switches to map) + `set({ adminOverlayOpen: false })`. `openSocietyAdmin(): void` — if `adminRole === 'association' && adminAssociationId` → `enterSocietyMode()`; else `openAdminOverlay()`.
- Consumes: existing `setMapMode`, `focusCampus` (MapSlice), `openAdminOverlay` (AdminSlice).

- [ ] **Step 1: Add to `AdminSlice` interface** in `src/store/types.ts` (next to `openAdminOverlay`):

```ts
  enterSocietyMode: () => void;
  openSocietyAdmin: () => void;
```

- [ ] **Step 2: Write the failing store test**

```ts
// src/store/slices/__tests__/createAdminSlice.test.ts (additions)
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

describe('enterSocietyMode / openSocietyAdmin', () => {
  beforeEach(() => useAppStore.setState({
    adminRole: null, adminAssociationId: null, adminOverlayOpen: false,
    mapMode: 'student', mapFocusRequest: 0, societyPosts: [], societyMapEvents: [],
  }));

  it('enterSocietyMode flips to society mode, closes overlay, requests map focus', () => {
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef', adminOverlayOpen: true });
    useAppStore.getState().enterSocietyMode();
    const s = useAppStore.getState();
    expect(s.mapMode).toBe('society');
    expect(s.adminOverlayOpen).toBe(false);
    expect(s.mapFocusRequest).toBe(1);
  });

  it('openSocietyAdmin enters society mode when logged in as association', () => {
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef' });
    useAppStore.getState().openSocietyAdmin();
    expect(useAppStore.getState().mapMode).toBe('society');
  });

  it('openSocietyAdmin opens the login overlay when not logged in', () => {
    useAppStore.getState().openSocietyAdmin();
    expect(useAppStore.getState().adminOverlayOpen).toBe(true);
    expect(useAppStore.getState().mapMode).toBe('student');
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts`

- [ ] **Step 4: Implement in `createAdminSlice.ts`** (add the two actions to the returned slice)

```ts
  enterSocietyMode: () => {
    set({ adminOverlayOpen: false });
    get().setMapMode('society');
    get().focusCampus();
  },
  openSocietyAdmin: () => {
    const s = get();
    if (s.adminRole === 'association' && s.adminAssociationId) get().enterSocietyMode();
    else get().openAdminOverlay();
  },
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts`

- [ ] **Step 6: Route login.** In `SocietyLoginForm.tsx` `submit()`, after a successful `adminLogin`, enter society mode for association accounts:

```tsx
    const res = await adminLogin(email, password);
    if (res.error) { setError(true); return; }
    if (useAppStore.getState().adminRole === 'association') useAppStore.getState().enterSocietyMode();
```

(Import `useAppStore` if not already imported; `adminLogin` is already pulled from the store.)

- [ ] **Step 7: Write/extend the login-form test**

```tsx
// src/components/SocietyAdmin/__tests__/SocietyLoginForm.test.tsx (addition)
it('enters society mode after a successful association login', async () => {
  const adminLogin = vi.fn(async () => ({}));
  const enterSocietyMode = vi.fn();
  useAppStore.setState({ language: 'cs', adminLogin, enterSocietyMode, adminRole: 'association' });
  render(<SocietyLoginForm />);
  fireEvent.change(screen.getByLabelText(/admin\.email/i), { target: { value: 'admin@supef.cz' } });
  fireEvent.change(screen.getByLabelText(/admin\.password/i), { target: { value: 'x' } });
  fireEvent.click(screen.getByRole('button', { name: 'admin.login' }));
  await waitFor(() => expect(enterSocietyMode).toHaveBeenCalledOnce());
});
```

> If `SocietyLoginForm` reads `adminRole` at submit via `useAppStore.getState()`, seeding `adminRole: 'association'` before submit makes the guard pass. Adjust label queries to the form's actual `aria-label`/`id` wiring.

- [ ] **Step 8: Run — expect PASS**

Run: `npx vitest run src/components/SocietyAdmin/__tests__/SocietyLoginForm.test.tsx`

- [ ] **Step 9: Commit**

```bash
git add src/store/types.ts src/store/slices/createAdminSlice.ts src/store/slices/__tests__/createAdminSlice.test.ts src/components/SocietyAdmin/SocietyLoginForm.tsx src/components/SocietyAdmin/__tests__/SocietyLoginForm.test.tsx
git commit -m "feat(admin): enterSocietyMode/openSocietyAdmin; login routes onto the map"
```

---

### Task 8: Delete legacy surfaces; repoint triggers; overlay = login-only

**Files:**
- Delete: `src/components/SocietyAdmin/SocietyPostManager.tsx` (+ any `__tests__/SocietyPostManager.test.tsx`), `src/components/CampusMap/MapModeToggle.tsx` (+ `__tests__/MapModeToggle.test.tsx`)
- Modify: `src/components/SocietyAdmin/SocietyAdminOverlay.tsx`, `SpolkySection.tsx`, `ProfilePopup.tsx`, `MobileProfileSheet.tsx`, `CampusMapView.tsx`
- Modify: `src/i18n/locales/{en,cs}.json` (add `admin.reisAdminNote`)
- Test: `src/components/SocietyAdmin/__tests__/SocietyAdminOverlay.test.tsx` (extend)

- [ ] **Step 1: Add i18n key** `admin.reisAdminNote` — en: `"Signed in as reIS admin. Manage events under a specific society."`; cs: `"Přihlášen jako reIS admin. Akce se spravují u konkrétního spolku."`

- [ ] **Step 2: Overlay test — login-only**

```tsx
// SocietyAdminOverlay.test.tsx (replace SocietyPostManager expectations)
it('shows the login form when open and logged out', () => {
  useAppStore.setState({ adminOverlayOpen: true, adminSession: null, language: 'cs' });
  render(<SocietyAdminOverlay />);
  expect(screen.getByLabelText(/admin\.email/i)).toBeInTheDocument();
});
it('shows the reis-admin note (not a post manager) for a reis_admin session', () => {
  useAppStore.setState({ adminOverlayOpen: true, adminSession: { user: { email: 'reis.mendelu@gmail.com' } } as never, adminRole: 'reis_admin', language: 'cs' });
  render(<SocietyAdminOverlay />);
  expect(screen.getByText('admin.reisAdminNote')).toBeInTheDocument();
});
```

- [ ] **Step 3: Rewrite `SocietyAdminOverlay.tsx`** (drop `SocietyPostManager`)

```tsx
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { SocietyLoginForm } from './SocietyLoginForm';

export function SocietyAdminOverlay() {
  const open = useAppStore((s) => s.adminOverlayOpen);
  const close = useAppStore((s) => s.closeAdminOverlay);
  const logout = useAppStore((s) => s.adminLogout);
  const session = useAppStore((s) => s.adminSession);
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="modal modal-open" role="dialog">
      <div className="modal-box max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">{t('admin.title_panel')}</h3>
          <button className="btn btn-ghost btn-sm" onClick={close}>✕</button>
        </div>
        {session ? (
          <>
            <p className="text-sm text-base-content/70">{t('admin.reisAdminNote')}</p>
            <button className="btn btn-ghost btn-sm mt-4" onClick={() => void logout()}>{t('admin.logout')}</button>
          </>
        ) : <SocietyLoginForm />}
      </div>
      <div className="modal-backdrop" onClick={close} />
    </div>
  );
}
```

- [ ] **Step 4: Repoint triggers.** In `SpolkySection.tsx`, `ProfilePopup.tsx`, `MobileProfileSheet.tsx`: replace `s.openAdminOverlay` selector usage with `s.openSocietyAdmin` and rename the local const accordingly (button/triple-click now call `openSocietyAdmin`). E.g. in `SpolkySection.tsx`:

```tsx
  const openSocietyAdmin = useAppStore((s) => s.openSocietyAdmin);
  // ...
  <button onClick={openSocietyAdmin} ...>
```

and in `ProfilePopup.tsx` / `MobileProfileSheet.tsx`:

```tsx
  const openSocietyAdmin = useAppStore((s) => s.openSocietyAdmin);
  const onBadge = useTripleClick(openSocietyAdmin);
```

- [ ] **Step 5: Clean `CampusMapView.tsx`.** Remove `import { MapModeToggle }` and `import { EventComposer }`; remove `<MapModeToggle />` from the left column; remove the whole `{composerOpen && (...EventComposer...)}` block (composer now lives in MyEventsPanel). Keep the placement banner `{placing && ...}` (still used by offcampus placing). Remove the now-unused `composerOpen`/`closeComposer` selectors if no longer referenced.

- [ ] **Step 6: Delete files**

```bash
git rm src/components/CampusMap/MapModeToggle.tsx src/components/CampusMap/__tests__/MapModeToggle.test.tsx src/components/SocietyAdmin/SocietyPostManager.tsx
# also remove SocietyPostManager test if present:
git rm -f src/components/SocietyAdmin/__tests__/SocietyPostManager.test.tsx 2>/dev/null || true
```

- [ ] **Step 7: Run the affected tests + typecheck**

Run: `npx vitest run src/components/SocietyAdmin/__tests__/SocietyAdminOverlay.test.tsx && npm run typecheck`
Expected: overlay tests pass; typecheck has no NEW errors referencing deleted files (fix any dangling import the compiler flags).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(admin): delete legacy modal + map toggle; overlay is login-only; triggers route to map"
```

---

### Task 9: CodeRabbit hardening (delete safety, scheduled flag, placement guard)

**Files:**
- Modify: `src/components/CampusMap/EventDetailCard.tsx`, `src/components/CampusMap/EventLayer.tsx`, `src/store/slices/createMapSlice.ts`
- Modify: `src/i18n/locales/{en,cs}.json` (add `map.deleteConfirm`)
- Test: `src/components/CampusMap/__tests__/EventDetailCard.test.tsx`, `EventLayer.test.tsx`, `src/store/slices/__tests__/createMapSlice.test.ts`

**9a — EventDetailCard delete safety**

- [ ] **Step 1: Add i18n** `map.deleteConfirm` — en: `"Delete for good?"`; cs: `"Opravdu smazat?"`

- [ ] **Step 2: Failing test**

```tsx
// EventDetailCard.test.tsx (additions) — deletePost mock returns error
const deletePost = vi.fn(async () => ({ error: 'boom' }));
vi.mock('../../../api/societyPosts', () => ({ deletePost: (...a: unknown[]) => deletePost(...a) }));

it('keeps the card and does not reload when delete fails', async () => {
  const loadSocietyPosts = vi.fn(async () => {});
  const clearMapSelection = vi.fn();
  useAppStore.setState({ mapMode: 'society', adminAssociationId: 'supef', language: 'cs', loadSocietyPosts, clearMapSelection });
  render(<EventDetailCard event={mineEvent} />);
  fireEvent.click(screen.getByRole('button', { name: 'map.delete' })); // arm confirm
  fireEvent.click(screen.getByRole('button', { name: 'map.deleteConfirm' })); // confirm
  await waitFor(() => expect(deletePost).toHaveBeenCalledTimes(1));
  expect(loadSocietyPosts).not.toHaveBeenCalled();
  expect(clearMapSelection).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npx vitest run src/components/CampusMap/__tests__/EventDetailCard.test.tsx`

- [ ] **Step 4: Implement** in `EventDetailCard.tsx` — replace `removeEvent` and the Delete button:

```tsx
  const clearMapSelection = useAppStore((s) => s.clearMapSelection);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const removeEvent = async () => {
    if (deleting) return;
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    const res = await deletePost(event.id);
    setDeleting(false);
    if (res.error) { setConfirming(false); return; }
    clearMapSelection();
    await loadSocietyPosts();
  };
```

```tsx
    <button type="button" className="btn btn-outline btn-error btn-sm flex-1" disabled={deleting} onClick={removeEvent}>
      {confirming ? t('map.deleteConfirm') : t('map.delete')}
    </button>
```

(Import `useState` from `react`.)

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run src/components/CampusMap/__tests__/EventDetailCard.test.tsx`

**9b — EventLayer scheduled flag from any grouped event**

- [ ] **Step 6: Failing test** in `EventLayer.test.tsx` — a venue group containing one live + one scheduled event renders the pin `scheduled` in society mode.

```tsx
it('marks a mixed venue group scheduled if ANY event is scheduled (society mode)', () => {
  // build societyMapEvents with two events sharing a coord: one this-week, one 30+ days out
  // render EventLayer in society mode; assert the pin has data-scheduled="true"
  // (mirror the existing EventLayer.test.tsx setup/util for constructing groups)
  expect(document.querySelector('[data-scheduled="true"]')).toBeTruthy();
});
```

- [ ] **Step 7: Run — expect FAIL** (current code uses `events[0]`)

Run: `npx vitest run src/components/CampusMap/__tests__/EventLayer.test.tsx`

- [ ] **Step 8: Implement** — in `EventLayer.tsx` change the `scheduled` prop:

```tsx
          scheduled={mode === 'society' && p.group.events.some((e) => isScheduledEvent(e.date))}
```

- [ ] **Step 9: Run — expect PASS**

Run: `npx vitest run src/components/CampusMap/__tests__/EventLayer.test.tsx`

**9c — Placement always happens on the campus overview**

- [ ] **Step 10: Failing test** in `createMapSlice.test.ts`:

```ts
it('beginPlacing returns to the campus overview so floor drill-in cannot swallow the click', () => {
  useAppStore.setState({ activeBuildingId: 123, activeFloorId: 5, mapFocusRequest: 0, placingEvent: false });
  useAppStore.getState().beginPlacing();
  const s = useAppStore.getState();
  expect(s.placingEvent).toBe(true);
  expect(s.activeBuildingId).toBeNull();
  expect(s.mapFocusRequest).toBe(1);
});
```

- [ ] **Step 11: Run — expect FAIL**

Run: `npx vitest run src/store/slices/__tests__/createMapSlice.test.ts`

- [ ] **Step 12: Implement** — in `createMapSlice.ts` change `beginPlacing`:

```ts
  beginPlacing: () => set({
    placingEvent: true, mapSelection: null,
    activeBuildingId: null, activeFloorId: null,
    mapFocusRequest: get().mapFocusRequest + 1,
  }),
```

- [ ] **Step 13: Run — expect PASS**

Run: `npx vitest run src/store/slices/__tests__/createMapSlice.test.ts`

- [ ] **Step 14: Commit**

```bash
git add src/components/CampusMap/EventDetailCard.tsx src/components/CampusMap/EventLayer.tsx src/store/slices/createMapSlice.ts src/i18n/locales/en.json src/i18n/locales/cs.json src/components/CampusMap/__tests__/EventDetailCard.test.tsx src/components/CampusMap/__tests__/EventLayer.test.tsx src/store/slices/__tests__/createMapSlice.test.ts
git commit -m "fix(map): delete safety + confirm, scheduled-any grouping, placement returns to overview (CodeRabbit)"
```

---

## Final verification gate (after Task 9)

- [ ] `npm run typecheck` — only the 3 pre-existing errors (Erasmus ×2, useExamActions.test); zero new.
- [ ] Lint changed files: `npx eslint --max-warnings=0 <each changed .ts/.tsx>` — clean.
- [ ] `npm run build` — exit 0.
- [ ] `npx vitest run src/components/CampusMap src/store/slices/__tests__/createAdminSlice.test.ts src/store/slices/__tests__/createMapSlice.test.ts src/components/SocietyAdmin` — all pass.
- [ ] Manual smoke via a fresh `npm run zip` for the user to load.

## Self-Review notes
- **Spec coverage:** toggle→tab (T6), in-panel composer (T4/T5), calendar (T2), room search / no online (T3/T4), login→map + delete modal (T7/T8), EventRow reuse (T1), all CodeRabbit findings (T4/T9). ✔
- **Type consistency:** `PostInput` snake_case patch keys (`venue_kind`,`room_code`,`coord_lng`,`coord_lat`) match `updatePost`; `roomCodeToCoord` returns `[lng,lat]` = `MapEvent.coord`; `enterSocietyMode`/`openSocietyAdmin` added to `AdminSlice` interface before use. ✔
- **Timezone:** `calendar.toISO` builds from parts, never `toISOString`. ✔
