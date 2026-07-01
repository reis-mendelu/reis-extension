# People search in the Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second row, "Lidé"/"People", to the Sidebar's "Student" flyout (both desktop and mobile) that opens a new popover searching only people, mirroring the "IS stránky" row added earlier in this branch.

**Architecture:** A new presentation component, `PeopleSearchPopover`, shaped exactly like the existing `IsPortalPopover` (`{ isOpen, onClose }`, portal-rendered backdrop+card, stays open after a click), but backed by `useSearch()` filtered to the `people` section — the same data-fetching trade-off `PeopleSearchBar` (the existing header widget) already makes. No changes to `useSearch`, `PeopleSearchBar`, or `IsPortalPopover`.

**Tech Stack:** React 19, Zustand (via `useSearch`'s `useAppStore` reads), TypeScript strict, lucide-react icons, `react-dom` `createPortal`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-02-people-search-sidebar-design.md`.
- `PeopleSearchPopover` props must be `{ isOpen: boolean; onClose: () => void }` — same contract as `IsPortalPopover`, so both can be wired into `NavItem.tsx`/`MobileNavSheet.tsx` identically.
- Max 200 lines per file (CLAUDE.md Iron Rule).
- No existing test files cover `IsPortalPopover`, `PeopleSearchBar`, `NavItem.tsx`, or `MobileNavSheet.tsx` (verified during planning) — no TDD gate applies to this plan; verification is via typecheck/lint/test/build, matching the precedent set by the "IS stránky" feature earlier in this branch.
- New i18n key: `sidebar.people` = "Lidé" (cs) / "People" (en) — a **new** key, not a reuse of `search.people` (different context: that key labels the header search's results section, not a sidebar row).
- Reuse existing i18n keys as-is, no new strings needed for them: `search.peoplePlaceholder`, `search.loading`, `search.empty`.
- Click behavior: `saveToHistory(result)` then `injectUserParams(result.link, studiumId, language === 'en' ? 'en' : 'cz')` → `window.open(url, '_blank')`, popover **stays open** afterward (does not call `onClose()`).
- Commit after each task.

---

### Task 1: Create `PeopleSearchPopover`

**Files:**
- Create: `src/components/SearchBar/PeopleSearchPopover.tsx`

**Interfaces:**
- Consumes: `useSearch(query)` from `src/components/SearchBar/useSearch.ts` (existing, unmodified) — returns `{ sections, isLoading, studiumId, saveToHistory, ... }`. `sections` is `SearchSection[]` where each section has `{ key: string; label: string; results: SearchResult[] }` (`src/components/SearchBar/types.ts`, existing). `injectUserParams` from `src/data/pagesData.ts` (existing, same import `PeopleSearchBar.tsx` already uses).
- Produces: `PeopleSearchPopover({ isOpen, onClose }: { isOpen: boolean; onClose: () => void })` — a React component. Tasks 2 and 3 import this from `../SearchBar/PeopleSearchPopover` and render `<PeopleSearchPopover isOpen={peoplePortalOpen} onClose={() => setPeoplePortalOpen(false)} />`.

- [ ] **Step 1: Create the file**

Create `src/components/SearchBar/PeopleSearchPopover.tsx`:

```tsx
import { useState } from 'react';
import { Search, X, User } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useSearch } from './useSearch';
import { useTranslation } from '../../hooks/useTranslation';
import { injectUserParams } from '../../data/pagesData';
import type { SearchResult } from './types';

interface PeopleSearchPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PeopleSearchPopover({ isOpen, onClose }: PeopleSearchPopoverProps) {
  const { t, language } = useTranslation();
  const [query, setQuery] = useState('');
  const { sections, isLoading, studiumId, saveToHistory } = useSearch(query);
  const people = sections.find(s => s.key === 'people')?.results ?? [];

  if (!isOpen) return null;

  const handlePick = (r: SearchResult) => {
    saveToHistory(r);
    if (r.link) window.open(injectUserParams(r.link, studiumId, language === 'en' ? 'en' : 'cz'), '_blank');
  };

  const showResults = query.trim().length >= 2;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Content Container */}
      <div className="relative w-full max-w-md max-h-[90vh] bg-base-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Header: query input + close */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('search.peoplePlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-base-200 border border-base-300 rounded-xl text-sm text-base-content placeholder-base-content/50 focus:outline-none focus:border-primary/50 transition-colors"
              autoFocus
            />
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-base-200 rounded-xl transition-colors text-base-content/50 hover:text-base-content"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {showResults && (
            isLoading ? (
              <div className="py-8 text-center text-sm text-base-content/50">
                {t('search.loading')}
              </div>
            ) : people.length === 0 ? (
              <div className="py-8 text-center text-sm text-base-content/50">
                {t('search.empty')}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {people.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handlePick(p)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-base-200 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center shrink-0 text-base-content/50">
                      <User className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm truncate">{p.title}</span>
                      {p.detail && <span className="block text-[11px] text-base-content/50 truncate">{p.detail}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors attributed to `PeopleSearchPopover.tsx` (this file isn't imported anywhere yet, so it can't affect other files' typecheck — confirm no errors reference it directly). Pre-existing unrelated errors (ErasmusSemesterSection.tsx, useExamActions.test.ts, createErasmusSlice.ts) are expected and not your concern.

- [ ] **Step 3: Commit**

```bash
git add src/components/SearchBar/PeopleSearchPopover.tsx
git commit -m "feat(search): add PeopleSearchPopover for sidebar people search"
```

---

### Task 2: Wire the "Lidé" row into the desktop Sidebar

**Files:**
- Modify: `src/components/Sidebar/NavItem.tsx`

**Interfaces:**
- Consumes: `PeopleSearchPopover` from Task 1 (`../SearchBar/PeopleSearchPopover`), props `{ isOpen: boolean; onClose: () => void }`.

- [ ] **Step 1: Replace the file contents**

Replace `src/components/Sidebar/NavItem.tsx` in full with:

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ExternalLink, Search, UserSearch } from 'lucide-react';
import type { MenuItem } from '../menuConfig';
import type { AppView } from '../../types/app';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { IsPortalPopover } from '../SearchBar/IsPortalPopover';
import { PeopleSearchPopover } from '../SearchBar/PeopleSearchPopover';

interface NavItemProps {
  item: MenuItem;
  isActive: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onViewChange: (view: AppView) => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
}

export function NavItem({ item, isActive, isHovered, onMouseEnter, onMouseLeave, onClick, onViewChange, onOpenSubject }: NavItemProps) {
  const [portalOpen, setPortalOpen] = useState(false);
  const [peoplePortalOpen, setPeoplePortalOpen] = useState(false);
  const setIsEduroamOpen = useAppStore(s => s.setIsEduroamOpen);
  const { t } = useTranslation();

  return (
    <div
      className="relative group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        onClick={onClick}
        className={`relative w-14 h-auto min-h-[56px] py-2 rounded-xl flex flex-col items-center justify-center transition-all duration-200 mx-auto
          ${isActive
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'text-base-content/50 hover:bg-base-100 hover:text-base-content hover:shadow-sm'
          }`}
      >
        {item.href && !item.expandable && item.id !== 'dashboard' && (
          <ExternalLink className="absolute top-1 right-1 w-2.5 h-2.5 text-base-content/30" />
        )}
        <div className="relative flex items-center justify-center">
          {item.icon}
          {item.badge !== undefined && (
            <span className={`absolute -top-2 -right-3 font-bold px-1 rounded text-[10px] leading-[14px] shadow-sm transition-all duration-300
              ${item.badge > 0
                ? 'bg-neutral text-neutral-content scale-110 shadow-neutral/20'
                : 'bg-base-content/10 text-base-content/50'
              }`}>
              {item.badge}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-1 font-medium w-full text-center px-1 leading-tight">
          {item.label}
        </span>
      </button>

      {/* Popup Menu for expandable items */}
      <AnimatePresence>
        {isHovered && item.expandable && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute left-14 -top-4 bg-base-100 rounded-xl shadow-popover-heavy border border-base-300 p-2 z-50 ${
                item.id === 'subjects' && item.children && item.children.length > 4 ? 'w-[500px] max-w-[calc(100vw-5rem)]' : 'w-64 max-w-[calc(100vw-5rem)]'
            }`}
          >
            <div className={`gap-0.5 ${
                item.id === 'subjects' && item.children && item.children.length > 4 ? 'grid grid-cols-2' : 'flex flex-col'
            }`}>
              {!item.children || item.children.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <div className="skeleton w-4 h-4 rounded" />
                    <div className="skeleton h-3 rounded flex-1" />
                  </div>
                ))
              ) : item.children.map((child) => (
                <a
                  key={child.id}
                  href={child.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (child.id === 'zapisy-zkousky') {
                      e.preventDefault();
                      onViewChange('exams');
                    } else if (child.id === 'studijni-plany') {
                      e.preventDefault();
                      onViewChange('subjects');
                    } else if (child.isSubject && child.courseCode) {
                      e.preventDefault();
                      onOpenSubject?.(child.courseCode, child.label, child.subjectId);
                    } else if (child.id === 'eduroam') {
                      e.preventDefault();
                      setIsEduroamOpen(true);
                    } else if (child.isFeature) {
                       e.preventDefault();
                    }
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-base-content/70 hover:bg-base-200 hover:text-primary transition-colors group/item cursor-pointer"
                >
                  <span className="text-base-content/50 group-hover/item:text-primary transition-colors">
                    {child.icon || <ChevronRight className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 flex flex-col min-w-0">
                    <span className="font-medium truncate">{child.label}</span>
                    {child.subtitle && (
                      <span className="text-[10px] text-base-content/40 truncate">{child.subtitle}</span>
                    )}
                  </div>
                  {!child.isFeature && !child.isSubject && (
                    <ExternalLink className="w-3 h-3 text-base-content/30 group-hover/item:text-base-content/50" />
                  )}
                </a>
              ))}
            </div>

            {item.id === 'is' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setPortalOpen(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-base-content/40 hover:bg-base-200 hover:text-primary transition-colors relative"
                >
                  <Search className="w-4 h-4" />
                  <span>{t('sidebar.addPin')}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPeoplePortalOpen(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-base-content/40 hover:bg-base-200 hover:text-primary transition-colors relative"
                >
                  <UserSearch className="w-4 h-4" />
                  <span>{t('sidebar.people')}</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <IsPortalPopover isOpen={portalOpen} onClose={() => setPortalOpen(false)} />
      <PeopleSearchPopover isOpen={peoplePortalOpen} onClose={() => setPeoplePortalOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors attributed to `NavItem.tsx`. Pre-existing unrelated errors (ErasmusSemesterSection.tsx, useExamActions.test.ts, createErasmusSlice.ts) are expected. `sidebar.people` isn't defined in the i18n locale files until Task 4 — this does NOT cause a typecheck error (the `t()` helper's key type isn't that strict; if it were, that would show up here as a new, real error — if so, note it in your report and continue, Task 4 will resolve it).

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar/NavItem.tsx
git commit -m "feat(sidebar): add Lidé (people search) row to desktop IS flyout"
```

---

### Task 3: Wire the "Lidé" row into the mobile Sidebar

**Files:**
- Modify: `src/components/MobileNav/MobileNavSheet.tsx`

**Interfaces:**
- Consumes: same `PeopleSearchPopover` as Task 2.

- [ ] **Step 1: Replace the file contents**

Replace `src/components/MobileNav/MobileNavSheet.tsx` in full with:

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, Search, UserSearch } from 'lucide-react';
import { useState } from 'react';
import type { MenuItem } from '../menuConfig';
import type { AppView } from '../../types/app';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { IsPortalPopover } from '../SearchBar/IsPortalPopover';
import { PeopleSearchPopover } from '../SearchBar/PeopleSearchPopover';

interface MobileNavSheetProps {
  item: MenuItem | null;
  onClose: () => void;
  onViewChange: (view: AppView) => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
  onOpenProfile?: () => void;
}

export function MobileNavSheet({ item, onClose, onViewChange, onOpenSubject, onOpenProfile }: MobileNavSheetProps) {
  const [portalOpen, setPortalOpen] = useState(false);
  const [peoplePortalOpen, setPeoplePortalOpen] = useState(false);
  const setIsEduroamOpen = useAppStore(s => s.setIsEduroamOpen);
  const { t } = useTranslation();

  if (!item) return null;

  const handleChildClick = (child: NonNullable<MenuItem['children']>[number]) => {
    if (child.id === 'zapisy-zkousky') {
      onViewChange('exams');
    } else if (child.id === 'studijni-plany') {
      onViewChange('subjects');
    } else if (child.isSubject && child.courseCode) {
      onOpenSubject?.(child.courseCode, child.label, child.subjectId);
    } else if (child.id === 'eduroam') {
      setIsEduroamOpen(true);
    } else if (child.id === 'profile-action') {
      onOpenProfile?.();
    } else if (child.href) {
      window.open(child.href, '_blank');
    }
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {item && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={onClose}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 rounded-t-2xl shadow-lg max-h-[70vh] flex flex-col"
            >
              <div className="flex items-center justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-base-300" />
              </div>
              <div className="px-4 pb-2 pt-1">
                <h3 className="font-bold text-base">{item.popupLabel || item.label}</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {!item.children || item.children.length === 0 ? (
                  <div className="flex flex-col gap-1 p-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-3">
                        <div className="skeleton w-4 h-4 rounded" />
                        <div className="skeleton h-3 rounded flex-1" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {item.children.map(child => (
                      <div key={child.id} className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-base-content/70 hover:bg-base-200 active:bg-base-200 transition-colors w-full">
                        <button
                          onClick={() => handleChildClick(child)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          {child.icon ? (
                            <span className="text-base-content/50">
                              {child.icon}
                            </span>
                          ) : null}
                          <div className="flex-1 flex flex-col min-w-0">
                            <span className="font-medium truncate">{child.label}</span>
                            {child.subtitle && (
                              <span className="text-[10px] text-base-content/40 truncate">{child.subtitle}</span>
                            )}
                          </div>
                          {!child.isFeature && !child.isSubject && (
                            <ExternalLink className="w-3 h-3 text-base-content/30" />
                          )}
                        </button>
                      </div>
                    ))}

                    {item.id === 'is' && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPortalOpen(true); }}
                          className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-base-content/40 hover:bg-base-200 hover:text-primary transition-colors w-full text-left"
                        >
                          <Search className="w-4 h-4" />
                          <span>{t('sidebar.addPin')}</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPeoplePortalOpen(true); }}
                          className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-base-content/40 hover:bg-base-200 hover:text-primary transition-colors w-full text-left"
                        >
                          <UserSearch className="w-4 h-4" />
                          <span>{t('sidebar.people')}</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <IsPortalPopover isOpen={portalOpen} onClose={() => setPortalOpen(false)} />
      <PeopleSearchPopover isOpen={peoplePortalOpen} onClose={() => setPeoplePortalOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors attributed to `MobileNavSheet.tsx`. Same pre-existing/`sidebar.people` caveats as Task 2, Step 2.

- [ ] **Step 3: Commit**

```bash
git add src/components/MobileNav/MobileNavSheet.tsx
git commit -m "feat(sidebar): add Lidé (people search) row to mobile IS flyout"
```

---

### Task 4: i18n — add the `sidebar.people` key

**Files:**
- Modify: `src/i18n/locales/cs.json:129`
- Modify: `src/i18n/locales/en.json:129`

**Interfaces:** none — string-only change consumed by `t('sidebar.people')` in Tasks 2–3.

- [ ] **Step 1: Edit `cs.json`**

In `src/i18n/locales/cs.json`, this line:

```json
    "addPin": "IS stránky",
```

becomes:

```json
    "addPin": "IS stránky",
    "people": "Lidé",
```

- [ ] **Step 2: Edit `en.json`**

In `src/i18n/locales/en.json`, this line:

```json
    "addPin": "IS stránky",
```

becomes:

```json
    "addPin": "IS stránky",
    "people": "People",
```

- [ ] **Step 3: Verify JSON validity and full typecheck**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/cs.json'))" && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json'))" && echo OK`
Expected: `OK`

Run: `npm run typecheck`
Expected: no errors attributed to `NavItem.tsx`, `MobileNavSheet.tsx`, `PeopleSearchPopover.tsx`, or the i18n files. Pre-existing unrelated errors (ErasmusSemesterSection.tsx, useExamActions.test.ts, createErasmusSlice.ts) are expected.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "i18n: add sidebar.people key for the Lidé search row"
```

---

### Task 5: Full verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: only the 3 pre-existing, unrelated errors (ErasmusSemesterSection.tsx, useExamActions.test.ts, createErasmusSlice.ts) — zero errors related to this feature or the earlier "IS stránky" feature.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: same pre-existing lint state as before this task's changes (9 errors/19 warnings, none in files this plan touched — confirmed byte-identical to `main` during the earlier feature in this branch). If `PeopleSearchPopover.tsx`, `NavItem.tsx`, or `MobileNavSheet.tsx` introduce any NEW lint error, that's a real regression — fix it.

- [ ] **Step 3: Full test suite**

Run: `npm run test:run`
Expected: same as the earlier feature's baseline — 137 passed / 5 failed (iskam parser tests failing on a missing gitignored `.agent/fixtures/` directory, an environment gap unrelated to any code) / 1 skipped. Zero failures related to this feature.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Grep for consistency**

Run: `grep -rn "PeopleSearchPopover" src`
Expected: exactly 4 matches — the component's own definition (`PeopleSearchPopover.tsx`), its import + usage in `NavItem.tsx`, and its import + usage in `MobileNavSheet.tsx`.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`, load the unpacked extension build per the WXT dev workflow. Hover the "Student" sidebar icon, confirm the flyout now shows: eduroam, Portál studenta, Záznamníky, Testy, "IS stránky", **"Lidé"** (new row, with a person-search icon). Click "Lidé", confirm the popover opens, type at least 2 characters of a known person's name, confirm results appear, click one, confirm it opens the person's profile in a new tab and the popover **stays open**. Open the header search bar's dropdown afterward and confirm the picked person now appears under "recently searched". Repeat at mobile width for `MobileNavSheet`.

- [ ] **Step 7: Final commit (if any cleanup was needed)**

```bash
git status
```

If Steps 1–6 required no further code changes, this task produces no commit — verification-only.
