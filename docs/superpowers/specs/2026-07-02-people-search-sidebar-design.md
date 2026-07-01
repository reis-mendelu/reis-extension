# People search in the Sidebar (second "Student" flyout row)

## Problem

The "Student" sidebar flyout now has an "IS stránky" row (added in the companion spec `2026-07-01-is-stranky-search-design.md`) that opens `IsPortalPopover` to search all IS Mendelu pages. There's no equivalent quick way to search for a specific person (student/teacher/staff) from the sidebar — the only people search today is `PeopleSearchBar`, a header-toolbar-only widget.

## Decision

Add a second row, labeled "Lidé"/"People", to the same "Student" flyout in both `NavItem.tsx` (desktop) and `MobileNavSheet.tsx` (mobile). It opens a new popover, `PeopleSearchPopover`, shaped exactly like `IsPortalPopover` (`{ isOpen, onClose }`, portal-rendered backdrop + card, stays open after a click) rather than reusing `PeopleSearchBar`'s inline expanding-bar widget, whose UX (fixed-width CSS transitions, absolute-positioned dropdown relative to itself) was built for a header toolbar slot and doesn't fit a flyout menu row.

Approaches considered:
1. **New `PeopleSearchPopover`, shaped like `IsPortalPopover`** (chosen) — small new presentation shell; reuses `useSearch(query)`'s existing people-filtering logic exactly the way `PeopleSearchBar` already does (fetch both subjects+people, filter client-side to the `people` section) — no changes to `useSearch` itself.
2. Reuse `PeopleSearchBar` inline inside the flyout row — rejected: its expand-in-place, absolute-positioned, fixed-width-transition UX doesn't fit a flyout menu item.
3. Add a `peopleOnly` mode to `useSearch` to skip the wasted subjects fetch — rejected: more "correct" but touches the shared, actively-evolving search hook used by the global header search and `PeopleSearchBar`, for a purely internal efficiency gain. `PeopleSearchBar` already accepts the fetch-both-filter-to-people trade-off; matching that precedent keeps this change small and low-risk.

## Component

`src/components/SearchBar/PeopleSearchPopover.tsx` (new, ≤200 lines per CLAUDE.md's Iron Rule). Props: `{ isOpen: boolean; onClose: () => void }`, matching `IsPortalPopover`'s contract exactly. Portal-rendered to `document.body` via `createPortal`, same structure as `IsPortalPopover`: `fixed inset-0 z-[100]` backdrop (click closes), centered card, `X` close button.

## Behavior

- Input placeholder uses the existing `search.peoplePlaceholder` i18n key ("Hledat lidi..."/"Search people...") — already defined and already used by `PeopleSearchBar`, no new key needed for this string.
- Calls `useSearch(query)` (both subjects and people are fetched under the hood — same accepted trade-off `PeopleSearchBar` already makes), then filters to `sections.find(s => s.key === 'people')?.results ?? []`.
- Unlike `IsPortalPopover` (static local `pagesData`, no loading state, no minimum query length), this popover needs:
  - `query.trim().length < 2` gating — show nothing (or a hint) until at least 2 characters are typed, same threshold `PeopleSearchBar` uses.
  - An `isLoading` state (from `useSearch`) to show a loading indicator, using the existing `search.loading` i18n key.
  - An empty-state message using the existing `search.empty` i18n key when the query is long enough but nothing matches.
- Each result row: an avatar-style icon (same visual pattern `PeopleSearchBar` uses — a circular badge with a `User`/`Briefcase` icon) + name + role detail (student/teacher/employee, from `SearchResult.detail`). This popover writes its own row markup rather than reusing `SearchResultItem` (that component carries keyboard-nav/selection-highlight state built for the header dropdown's arrow-key navigation, which this popover doesn't need).
- Click a result:
  1. `saveToHistory(result)` — same call `PeopleSearchBar` already makes, so a pick here also shows up in the header search's "recently searched" list. Consistent cross-surface behavior, no new state needed (uses the existing `createSearchSlice` `recentSearches`/`saveRecentSearch`).
  2. `injectUserParams(result.link, studiumId, language === 'en' ? 'en' : 'cz')` → `window.open(url, '_blank')`.
  3. **Popover stays open** after the click (same as `IsPortalPopover`'s behavior for this plan's earlier feature) — unlike `PeopleSearchBar`, which collapses after a pick. This lets a user look up several people in one sitting.
- Backdrop-click and the `X` button close the popover (verified: `IsPortalPopover` has no Escape-key handler either, so this popover matches that precedent exactly rather than adding new behavior). The query is **not** cleared between clicks or on close-then-reopen (matches `IsPortalPopover`'s existing behavior for its own input — no special-casing here).

## Sidebar wiring

- `NavItem.tsx` and `MobileNavSheet.tsx` each get a second local boolean state, `peoplePortalOpen`/`setPeoplePortalOpen`, alongside the existing `portalOpen`/`setPortalOpen` for "IS stránky" — the two rows are fully independent, opening two independent popovers.
- New row: icon `UserSearch` (lucide-react) — the same icon `PeopleSearchBar` already uses for its own trigger button, for visual consistency across the two people-search entry points in the app. Label: new i18n key `sidebar.people` = "Lidé" (cs) / "People" (en).
- `sidebar.people` is a **new** key rather than reusing `search.people` (existing key, "Lidé"/"People", used today as the header search dropdown's section-header label) — different context (a sidebar row label vs. a results-section header), and this plan's sibling feature already established the pattern of a dedicated `sidebar.*` key per flyout row (`sidebar.addPin` for "IS stránky").
- Row order in the flyout: eduroam, Portál studenta, Záznamníky, Testy, **IS stránky**, **Lidé** (new row appended after the existing "IS stránky" row, both flush against the same divider styling already in place).

## Testing

No existing test files for `IsPortalPopover`, `PeopleSearchBar`, `NavItem.tsx`, or `MobileNavSheet.tsx` (confirmed absent during this plan's prior feature) — so there's no TDD gate to satisfy for the new component or the flyout wiring. Verification follows the same gates as the prior feature in this plan: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`, plus a manual smoke test (open the "Lidé" row, search a known name, confirm a result opens in a new tab and the popover stays open, confirm it also appears under "recently searched" in the header search).

## Out of scope

- No changes to `useSearch`, `PeopleSearchBar`, or the global header search bar — this is purely a new, additive entry point.
- No "peopleOnly" mode added to `useSearch` (see Approach 3, rejected).
- No changes to `IsPortalPopover` or the "IS stránky" row from the prior feature in this plan.
