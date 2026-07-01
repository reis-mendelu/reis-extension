# IS stránky search (replace page pinning)

## Problem

The "Student" sidebar flyout (`src/components/Sidebar/NavItem.tsx`, `item.id === 'is'`) has a "+ Přidat" row that opens `PagePinnerModal`, letting a user pin up to 6 IS Mendelu pages so they show up permanently as extra children in that flyout. Usage data shows almost nobody uses pinning. The modal already contains a working fuzzy search over every page in `pagesData`/`navPages` — it's a search UI wearing a pin-toggle UI.

## Decision

Repurpose the modal into a pure search-and-launch tool, renamed **"IS stránky"**, and delete the pinning feature (state, storage, UI) entirely. The "Student" flyout's 4 fixed rows (eduroam, Portál studenta, Záznamníky, Testy) are untouched and keep that name — only the trigger row and the modal change.

Approaches considered:
1. **Repurpose `PagePinnerModal` in place** (chosen) — smallest blast radius, reuses the existing category list + `fuzzyIncludes` filter, touches only files already in the pin code path.
2. Fold page search into the global header search (`SearchBar/useSearch.ts`) as a third result section — rejected, drags a static local page list into the subject/people search's debounced-network/relevance-scoring machinery for no benefit.
3. Hybrid (standalone component surfaced inside the global search overlay) — rejected, biggest lift for a feature usage shows is low-value.

## Component & rename — reuse `IsPortalPopover`, don't build a new modal

**Deviation from the original plan (discovered while mapping files for implementation):** the codebase already has `src/components/SearchBar/IsPortalPopover.tsx`, wired to the global header search bar's grid-icon launcher (`SearchBar/index.tsx`, `SearchBar/MobileSearchOverlay.tsx`). It already does exactly what this spec needs: fuzzy-filters every category in `pagesData`, and on click resolves `injectUserParams(href, studiumId, lang)` and `window.open(url, '_blank')` **without closing**. Building a second, near-identical modal (`IsPagesSearchModal`) would duplicate ~150 lines of UI for no behavioral difference. Decision: **delete `PagePinnerModal.tsx` outright and point the Sidebar/mobile trigger at the existing `IsPortalPopover`** instead of creating a new component.

- `src/components/Sidebar/PagePinnerModal.tsx` is deleted, not renamed.
- Trigger row in `NavItem.tsx` and `MobileNavSheet.tsx`: currently `Plus` icon + `t('sidebar.addPin')` ("Přidat"/"Add"), opens `PagePinnerModal`. Becomes a `Search` (lucide) icon + label "IS stránky" (repoint the `sidebar.addPin` key to that string), opens `IsPortalPopover` via the same local `pinnerOpen`/`setPinnerOpen` state already in both files (renamed to `portalOpen`/`setPortalOpen` for clarity) — same pattern `SearchBar/index.tsx` already uses (`isPortalOpen`/`setIsPortalOpen`).
- `IsPortalPopover` has no modal title bar of its own (the triggering button already carries the label) — so no separate "title" string is needed; `sidebar.addPinTitle` key is deleted rather than repurposed.
- Remove: the pin-limit hint (`sidebar.pinLimitReached`), the first-time nudge tooltip (`showPinHint` state, `pin_hint_dismissed` IndexedDB key, `sidebar.pinNudge` string) — there's no pin limit or pin concept left to nudge about.
- i18n cleanup: drop `addPinTitle`, `pinNudge`, `pinLimitReached` keys from `src/i18n/locales/cs.json` and `en.json`; update `addPin` value to "IS stránky" (same string cs/en — it's a Czech IS-system proper name, not translated).
- `IsPortalPopover` itself is unmodified — it already resolves `studiumId`/`language` from the store internally, so the Sidebar/mobile trigger sites don't need to plumb those through.

## Behavior

All of this is existing, already-shipped behavior in `IsPortalPopover` — nothing to build, only to point the Sidebar/mobile trigger at it:
- Fuzzy-filters every category in `pagesData` as the user types (accent-insensitive `strip()` + `includes()`), grouped under category headers with icons.
- Each result is a plain clickable item. On click: `injectUserParams(href, studiumId, language === 'en' ? 'en' : 'cz')` → `window.open(finalUrl, '_blank')`. **Stays open** after a click (no `onClose()` call in `handleLinkClick`), so the user can open several pages in one session.
- Filter input keeps its value between clicks; Esc isn't wired but the `X` close button and backdrop click close it.
- One behavior gap vs. the old pin-modal flow: `IsPortalPopover` doesn't use `navPages` (the live-scraped category list with corrected ids/labels) — it always reads the static `pagesData` import. This already matches how the global search's grid-icon launcher behaves today, so it's an accepted pre-existing characteristic, not a regression introduced by this change.

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

Neither `PagePinnerModal.tsx` nor `createPinnedPagesSlice.ts` has an existing test file (verified — none found under `__tests__`), so there's nothing to delete on that front. `IsPortalPopover` itself is untouched, so its existing behavior needs no new tests. What does need attention:
- `src/utils/__tests__/noHardcodedIds.test.ts` has a hard assertion (`should be used for pinned pages in MainItems.tsx`) checking that the literal string `href: injectUserParams(p.href, sid, lang, oid)` exists in `MainItems.tsx`. That line is deleted as part of this change (the `is` category's `children` goes back to its 4 static entries), so this test must be updated — delete that specific `it(...)` block; the sibling assertion covering `SearchBar/index.tsx`'s `injectUserParams` usage is untouched and still valid.
- Any test asserting on `MenuItem.isPinned`, `pinnedPages`, or the 6-item cap (search the test suite for these before starting, since none were found during design-time exploration but the codebase may have changed) must be removed.
- New coverage isn't required for `NavItem.tsx`/`MobileNavSheet.tsx`'s trigger-row change beyond what TypeScript + the build already enforce, since the row now just flips a boolean and renders an existing, already-tested-by-shipping component.

## Out of scope

- No "recently visited pages" fallback or any other replacement persistence — straight removal, as agreed.
- No changes to the global header search (`SearchBar/`) or its subject/people result types.
- No changes to the "Student" flyout's 4 fixed entries or their existing special-case click handling (eduroam modal, etc.).
