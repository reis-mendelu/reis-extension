# IS stránky search (replace page pinning)

## Problem

The "Student" sidebar flyout (`src/components/Sidebar/NavItem.tsx`, `item.id === 'is'`) has a "+ Přidat" row that opens `PagePinnerModal`, letting a user pin up to 6 IS Mendelu pages so they show up permanently as extra children in that flyout. Usage data shows almost nobody uses pinning. The modal already contains a working fuzzy search over every page in `pagesData`/`navPages` — it's a search UI wearing a pin-toggle UI.

## Decision

Repurpose the modal into a pure search-and-launch tool, renamed **"IS stránky"**, and delete the pinning feature (state, storage, UI) entirely. The "Student" flyout's 4 fixed rows (eduroam, Portál studenta, Záznamníky, Testy) are untouched and keep that name — only the trigger row and the modal change.

Approaches considered:
1. **Repurpose `PagePinnerModal` in place** (chosen) — smallest blast radius, reuses the existing category list + `fuzzyIncludes` filter, touches only files already in the pin code path.
2. Fold page search into the global header search (`SearchBar/useSearch.ts`) as a third result section — rejected, drags a static local page list into the subject/people search's debounced-network/relevance-scoring machinery for no benefit.
3. Hybrid (standalone component surfaced inside the global search overlay) — rejected, biggest lift for a feature usage shows is low-value.

## Component & rename

- `src/components/Sidebar/PagePinnerModal.tsx` → renamed `src/components/Sidebar/IsPagesSearchModal.tsx` (stays ≤200 lines per project convention).
- Modal title: i18n key `sidebar.addPinTitle` → repurposed to read "IS stránky" (same string cs/en — it's a Czech IS-system proper name, not translated).
- Trigger row in `NavItem.tsx` and `MobileNavSheet.tsx`: currently `Plus` icon + `t('sidebar.addPin')` ("Přidat"/"Add"). Becomes a `Search` (lucide) icon + label "IS stránky", reusing the `sidebar.addPinTitle` key (or repointing `sidebar.addPin` to "IS stránky" — implementer's call, just keep cs/en in sync).
- Remove: the pin-limit hint (`sidebar.pinLimitReached`), the first-time nudge tooltip (`showPinHint` state, `pin_hint_dismissed` IndexedDB key, `sidebar.pinNudge` string) — there's no pin limit or pin concept left to nudge about.
- i18n cleanup: drop `pinNudge` and `pinLimitReached` keys from `src/i18n/locales/cs.json` and `en.json`; update `addPinTitle`/`addPin` values to "IS stránky" (cs and en).

## Behavior

- Same fuzzy-search-over-categories UI as today: `fuzzyIncludes` filters `navPages ?? pagesData` per category, grouped under category headers, exactly as `PagePinnerModal` does now.
- Each result row becomes a plain clickable item (no `Check`/pin icon). On click:
  1. Resolve the URL: `injectUserParams(page.href, studiumId, lang, obdobiId)` (the modal needs `studiumId`/`obdobiId` from the store — currently only `MainItems.tsx` does this resolution for pinned children; the modal itself must now pull these the same way).
  2. `window.open(url, '_blank', 'noopener,noreferrer')`.
  3. **Modal stays open** — no auto-close after a click, so the user can open several pages in one search session.
- The search input keeps its value/focus between clicks (no auto-clear) — re-searching is just editing the existing query.
- Esc / backdrop click still closes the modal, unchanged from today.
- The modal's open/close trigger wiring (`pinnerOpen` state in `NavItem.tsx`/`MobileNavSheet.tsx`) is unchanged — only the label/icon on the row that opens it changes.

## Data/state removal

Delete entirely:
- `src/store/slices/createPinnedPagesSlice.ts` (the whole file: `pinnedPages`, `pinPage`, `unpinPage`, `migratePinnedIds`, `normalizePath`, `MAX_PINS`, `STORAGE_KEY = 'pinned_pages'`).
- Its registration in `useAppStore.ts` and the `PinnedPagesSlice` type union / `pinnedPages`/`pinPage`/`unpinPage`/`migratePinnedIds` entries in `src/store/types.ts`.
- The `migratePinnedIds` call site in `src/hooks/useAppLogic.ts:120`.
- The `isPinned` mapping + `...pinnedPages.map(...)` spread in `src/components/Menu/MainItems.tsx` (the `is` category's `children` array goes back to exactly its 4 static entries — `pinnedPages` param can be dropped from `mainItems`/`getMainMenuItems` signatures, along with the now-unused `Pin` icon import).
- The unpin `X` button block (`child.isPinned ? ... : ...` branch) in `NavItem.tsx` and the equivalent in `MobileNavSheet.tsx` — once there are no pinned children, that branch is dead; the `isPinned` field on `MenuItem`/children can also be removed if nothing else sets it.
- `hasPinnedChildren` / `canAddMore` (pin-count-based) logic in both files.
- `pinnedPages` plumbing in `src/hooks/ui/useMenuItems.ts`.

## Existing pinned data for current users

`pinnedPages` is read from `chrome.storage.sync` only through the slice being deleted. Once the slice is gone, previously-pinned pages simply stop appearing in the flyout — no migration step needed. The orphaned `pinned_pages` sync-storage key is harmless and left in place (not worth a cleanup migration for a low-usage feature).

## Testing

Per project convention (test-first, no `useEffect` for data fetching, etc.):
- Rewrite the existing `PagePinnerModal` test suite (move/rename to `IsPagesSearchModal`) to cover: fuzzy search filters pages across categories; clicking a result calls `window.open` with the `injectUserParams`-resolved URL; the modal does **not** close after a click; Esc/backdrop-click still closes it.
- Delete `createPinnedPagesSlice`'s test file along with the slice.
- Update any `MainItems.tsx` / `NavItem.tsx` / `MobileNavSheet.tsx` tests that assert pin/unpin behavior or the 6-item cap — remove those assertions; add/keep coverage that the "Student" flyout renders exactly its 4 static children.

## Out of scope

- No "recently visited pages" fallback or any other replacement persistence — straight removal, as agreed.
- No changes to the global header search (`SearchBar/`) or its subject/people result types.
- No changes to the "Student" flyout's 4 fixed entries or their existing special-case click handling (eduroam modal, etc.).
