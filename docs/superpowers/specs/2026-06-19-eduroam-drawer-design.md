# Eduroam Drawer — Design Spec

**Date:** 2026-06-19
**Branch:** `feat/eduroam-mobileconfig`
**Status:** Approved (brainstorming)

## Problem

The eduroam Wi-Fi setup tutorial is currently a **full page** (`AppView = 'eduroam'`),
reached from the sidebar Wi-Fi item via `onViewChange('eduroam')` and rendered in
`AppMain` as `<EduroamSetup>` (`h-full overflow-y-auto p-6`). Every other secondary
flow in reIS (Erasmus, Exam, ClassmatePerson, SubjectFile) is a **drawer**. Eduroam
is the odd one out, and its tutorial markup (`tabs tabs-boxed` + bare `list-decimal`)
looks plainer than the rest of the app.

## Goal

Move eduroam into a **side drawer** that reuses the existing `AdaptiveDrawer`
pattern, and **restyle the tutorial to reIS quality** while keeping the proven
flow (device tabs → generate → QR + numbered steps) unchanged.

## Decisions (from brainstorming)

1. **Container:** Side drawer via the existing `AdaptiveDrawer`
   (`src/components/ui/AdaptiveDrawer.tsx`) — desktop slide-in-from-right, phone
   full-height swipeable bottom sheet. *Not* a centered modal.
2. **Entry point:** The sidebar Wi-Fi item opens the drawer over the current view.
   The old full-page `'eduroam'` view is **removed entirely** (no fallback path).
3. **Design scope:** Polished restyle, **same flow**. Device picker → segmented
   control; steps → a real vertical stepper; QR in a styled card; clearer CTA +
   success state. No interaction redesign (no auto-advance wizard, no new
   platform auto-detect — the hook already defaults the tab to `isMac ? 'mac' : 'ios'`).

## Architecture

### State
- New slice `src/store/slices/createEduroamSlice.ts` holding:
  - `isEduroamOpen: boolean` (default `false`)
  - `setIsEduroamOpen: (open: boolean) => void`
- Mirrors `isStudyJamOpen`/`setIsStudyJamOpen` in `createStudyJamsSlice.ts`. A
  dedicated slice is used because there is no generic UI slice and `createMenuSlice`
  is the canteen menu, not navigation.
- Register the slice in `useAppStore.ts` and add its types to `src/store/types.ts`.

### Entry point
- `Sidebar.tsx:65` — the `item.id === 'eduroam'` branch calls
  `setIsEduroamOpen(true)` instead of `onViewChange('eduroam')`.
- `MainItems.tsx` — keeps the Wi-Fi entry (label/icon unchanged).

### Rendering
- `<EduroamDrawer>` is rendered in `AppOverlays.tsx`, alongside the other overlays,
  reading `isEduroamOpen` / `setIsEduroamOpen` from the store.

### Removals
- `'eduroam'` removed from the `AppView` union in `src/types/app.ts`.
- The `currentView === 'eduroam'` branch and the `EduroamSetup` import removed from
  `AppMain.tsx`.
- The `onViewChange('eduroam')` wiring removed from `Sidebar.tsx`.

## Components

| Component | Change |
|-----------|--------|
| `EduroamDrawer.tsx` (new) | `AdaptiveDrawer` shell (`width="sm:w-[560px]"`, `title="eduroam"`). Drawer header: icon tile + title/subtitle + `X` close button, matching `ErasmusDrawer`. Calls `useEduroamSetup()` and passes props to the body (same wiring the page does today). |
| `EduroamSetup.tsx` | Becomes the drawer body. Device picker `tabs tabs-boxed` → **segmented control** (DaisyUI `join` of `btn`s, active = `btn-primary`), keeping iOS/Android/Mac + icons. Drop the standalone full-page `<h1>` header and the `h-full overflow-y-auto p-6` wrapper — the drawer owns header + scroll. |
| `IosTransfer.tsx` / `AndroidTransfer.tsx` / `MacInstall.tsx` | Restyle to a shared **vertical stepper**: numbered circle nodes (`bg-primary/10 text-primary`) with a thin `border-base-300` connector line; QR in a styled `bg-base-200` card with a white inner plate for scan contrast; success state as `alert-success`. **Behavior identical** — only markup/classes change. |
| `PasswordChip.tsx` | Reused unchanged. |
| `useEduroamSetup.ts` | **Unchanged** — pure state/logic, container-agnostic. |

## Design language

- DaisyUI semantic classes only (Iron Rule: no custom CSS).
- Primary green for active segment + primary CTA; `base-200`/`base-300` surfaces;
  `base-content/60` for secondary text.
- Stepper reads as a guided tutorial, not a bare `<ol>`.
- Drawer-width-aware; scrolls within the drawer body; phone gets the bottom sheet
  automatically via `AdaptiveDrawer`.

## Data flow

Unchanged from today. `useEduroamSetup()` owns `status`/`target`/`password`/
`qrDataUrl`/`error` and `run`/`selectTarget`/`openProfilesSettings`. The drawer is
purely a new container + restyle around the same hook.

## Error handling

Unchanged. `status === 'error'` renders the `alert-error` with the message; the
hook's `logError('useEduroamSetup.run', …)` stays. No new network or logic paths,
so no new failure modes.

## i18n

- All existing `eduroam.*` keys reused.
- New keys only if copy changes (e.g. a drawer subtitle); added to **both**
  `src/i18n/locales/cs.json` and `en.json`.

## Testing

- Hook untouched → existing `eduroam.test.ts`, `eduroamTransfer.test.ts`, and
  `services/eduroam/*` tests stay green.
- **New (test-first, per CLAUDE.md):** a render test for `EduroamDrawer` following
  the `AdaptiveDrawer.test.tsx` pattern — opens/closes via `isEduroamOpen`, switches
  device tab, and asserts the QR appears after generate. Failing test before the
  component.
- `npm run build` must exit 0 after changes (standing rule), and `npm run typecheck`
  must pass (the removed `AppView` member must have no dangling references).

## Files touched

- `src/store/slices/createEduroamSlice.ts` (new)
- `src/store/useAppStore.ts`, `src/store/types.ts`
- `src/components/Sidebar.tsx`
- `src/components/AppMain.tsx`
- `src/components/AppOverlays.tsx`
- `src/types/app.ts`
- `src/components/Eduroam/EduroamDrawer.tsx` (new)
- `src/components/Eduroam/EduroamSetup.tsx`, `IosTransfer.tsx`, `AndroidTransfer.tsx`, `MacInstall.tsx`
- `src/components/Eduroam/__tests__/EduroamDrawer.test.tsx` (new)
- `src/i18n/locales/cs.json`, `en.json` (only if copy changes)

## Out of scope

- Platform auto-detect beyond the existing `isMac` default.
- Wizard-style one-step-at-a-time interaction.
- Any change to `useEduroamSetup`, the cert/transfer APIs, or the eduroam services.
