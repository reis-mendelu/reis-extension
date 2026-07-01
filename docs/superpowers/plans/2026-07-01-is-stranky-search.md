# IS stránky search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sidebar's page-pinning feature (pin up to 6 pages into the "Student" flyout) with a row labeled "IS stránky" that opens the existing `IsPortalPopover` search-and-launch component, then delete all now-dead pinning code (slice, storage, UI).

**Architecture:** No new components. The Sidebar's `+ Přidat` row (desktop `NavItem.tsx`, mobile `MobileNavSheet.tsx`) is repointed from `PagePinnerModal` to `IsPortalPopover` (already used by the global header search's grid-icon launcher at `src/components/SearchBar/index.tsx` and `MobileSearchOverlay.tsx`). `PagePinnerModal.tsx`, `createPinnedPagesSlice.ts`, and every `pinnedPages`/`isPinned` read site are deleted.

**Tech Stack:** React 19, Zustand (slice pattern), TypeScript strict, Vitest, lucide-react icons.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-01-is-stranky-search-design.md` (read this first — it documents why `IsPortalPopover` is reused instead of building a new modal).
- This plan is a removal + rewire of existing, already-shipped behavior (`IsPortalPopover` is unmodified and untouched by this plan). No new pure logic is introduced, so tasks are verified with `npm run typecheck` / `npm run lint` / `npm run test:run` / `npm run build` rather than new failing tests — CLAUDE.md's test-first rule applies to new behavior, and there is none here.
- Max 200 lines per file (CLAUDE.md Iron Rule) — no file touched in this plan grows; several shrink.
- No proxy/re-export files, no `useEffect` for data fetching (CLAUDE.md Iron Rules) — not relevant to these changes but don't introduce any.
- `IsPortalPopover` props are `{ isOpen: boolean; onClose: () => void }` (not `open`/`onClose` like the deleted `PagePinnerModal`) — every call site must use `isOpen`.
- Commit after each task.

---

### Task 1: Repoint desktop Sidebar trigger to `IsPortalPopover`

**Files:**
- Modify: `src/components/Sidebar/NavItem.tsx`

**Interfaces:**
- Consumes: `IsPortalPopover` from `src/components/SearchBar/IsPortalPopover.tsx` — `IsPortalPopoverProps { isOpen: boolean; onClose: () => void }` (existing, unmodified).
- Produces: nothing new — this task only removes the `pinnedPages`/`unpinPage`/pin-hint state this file used to own.

- [ ] **Step 1: Replace the file contents**

Replace `src/components/Sidebar/NavItem.tsx` in full with:

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ExternalLink, Search } from 'lucide-react';
import type { MenuItem } from '../menuConfig';
import type { AppView } from '../../types/app';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { IsPortalPopover } from '../SearchBar/IsPortalPopover';

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
              <button
                onClick={(e) => { e.stopPropagation(); setPortalOpen(true); }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-base-content/40 hover:bg-base-200 hover:text-primary transition-colors relative"
              >
                <Search className="w-4 h-4" />
                <span>{t('sidebar.addPin')}</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <IsPortalPopover isOpen={portalOpen} onClose={() => setPortalOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: fails right now (PagePinnerModal still imported by MobileNavSheet.tsx, pinnedPages still referenced in MainItems.tsx/menuConfig.tsx/useMenuItems.ts/store — those are fixed in later tasks). Confirm the only errors reported are in those other files, not in `NavItem.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar/NavItem.tsx
git commit -m "feat(sidebar): repoint desktop IS flyout trigger to IsPortalPopover"
```

---

### Task 2: Repoint mobile Sidebar trigger to `IsPortalPopover`

**Files:**
- Modify: `src/components/MobileNav/MobileNavSheet.tsx`

**Interfaces:**
- Consumes: same `IsPortalPopover` as Task 1.

- [ ] **Step 1: Replace the file contents**

Replace `src/components/MobileNav/MobileNavSheet.tsx` in full with:

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, Search } from 'lucide-react';
import { useState } from 'react';
import type { MenuItem } from '../menuConfig';
import type { AppView } from '../../types/app';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { IsPortalPopover } from '../SearchBar/IsPortalPopover';

interface MobileNavSheetProps {
  item: MenuItem | null;
  onClose: () => void;
  onViewChange: (view: AppView) => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
  onOpenProfile?: () => void;
}

export function MobileNavSheet({ item, onClose, onViewChange, onOpenSubject, onOpenProfile }: MobileNavSheetProps) {
  const [portalOpen, setPortalOpen] = useState(false);
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
                        <button
                          onClick={(e) => { e.stopPropagation(); setPortalOpen(true); }}
                          className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-base-content/40 hover:bg-base-200 hover:text-primary transition-colors w-full text-left"
                        >
                          <Search className="w-4 h-4" />
                          <span>{t('sidebar.addPin')}</span>
                        </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <IsPortalPopover isOpen={portalOpen} onClose={() => setPortalOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: still fails (same pre-existing reasons as Task 1, fixed in Task 4) but no new errors from `MobileNavSheet.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/MobileNav/MobileNavSheet.tsx
git commit -m "feat(sidebar): repoint mobile IS flyout trigger to IsPortalPopover"
```

---

### Task 3: Delete the pinning modal, slice, and its store registration

**Files:**
- Delete: `src/components/Sidebar/PagePinnerModal.tsx`
- Delete: `src/store/slices/createPinnedPagesSlice.ts`
- Modify: `src/store/useAppStore.ts`
- Modify: `src/store/types.ts`
- Modify: `src/hooks/useAppLogic.ts:118-122`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — pure deletion. After this task, `pinnedPages`, `pinPage`, `unpinPage`, `migratePinnedIds`, and the `PinnedPage`/`PinnedPagesSlice` types no longer exist anywhere in the codebase.

- [ ] **Step 1: Delete the two files**

```bash
git rm src/components/Sidebar/PagePinnerModal.tsx src/store/slices/createPinnedPagesSlice.ts
```

- [ ] **Step 2: Remove the slice from `useAppStore.ts`**

In `src/store/useAppStore.ts`, delete this import line:

```ts
import { createPinnedPagesSlice } from './slices/createPinnedPagesSlice';
```

and delete this line from inside `create<AppState>()((...a) => ({ ... }))`:

```ts
  ...createPinnedPagesSlice(...a),
```

- [ ] **Step 3: Remove `PinnedPagesSlice` from `store/types.ts`**

Delete the import line:

```ts
import type { PinnedPage } from './slices/createPinnedPagesSlice';
```

Delete the interface block:

```ts
export interface PinnedPagesSlice {
  pinnedPages: PinnedPage[];
  loadPinnedPages: () => Promise<void>;
  pinPage: (page: PinnedPage) => Promise<void>;
  unpinPage: (id: string) => Promise<void>;
  migratePinnedIds: (navPages: PageCategory[]) => Promise<void>;
}
```

In the `AppState` type union (single line, search for `export type AppState =`), remove ` & PinnedPagesSlice` from the middle of the chain (it currently sits between `ErasmusSlice &` and `MenuSlice &`).

- [ ] **Step 4: Remove the `migratePinnedIds` call in `useAppLogic.ts`**

In `src/hooks/useAppLogic.ts`, this block:

```ts
            if (d.type === 'REIS_NAV_MENU') {
                useAppStore.getState().setNavPages(d.categories);
                useAppStore.getState().migratePinnedIds(d.categories);
                return;
            }
```

becomes:

```ts
            if (d.type === 'REIS_NAV_MENU') {
                useAppStore.getState().setNavPages(d.categories);
                return;
            }
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: remaining errors are only in `MainItems.tsx`, `menuConfig.tsx`, `useMenuItems.ts` (still reference `pinnedPages`/`PinnedPage` — fixed in Task 4). No errors in `useAppStore.ts`, `store/types.ts`, or `useAppLogic.ts`.

- [ ] **Step 6: Commit**

```bash
git add -A src/store/useAppStore.ts src/store/types.ts src/hooks/useAppLogic.ts
git commit -m "refactor(store): delete page-pinning slice and modal"
```

---

### Task 4: Strip `pinnedPages`/`isPinned` plumbing from the menu config

**Files:**
- Modify: `src/components/Menu/MainItems.tsx`
- Modify: `src/components/menuConfig.tsx`
- Modify: `src/hooks/ui/useMenuItems.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `mainItems(sid, oid, t, lang)` and `getMainMenuItems(sid, oid, t, lang)` — both drop their trailing `pinnedPages`/`navPages` parameters. Any other call site must be updated to match (none exist outside these three files — verified by grep during planning).

- [ ] **Step 1: Replace `MainItems.tsx`**

Replace `src/components/Menu/MainItems.tsx` in full with:

```tsx
import { Home, Book, CalendarCheck, LayoutDashboard, ClipboardList, PenTool, User, Wifi, Map } from 'lucide-react';
import type { MenuItem } from '../menuConfig';

export const mainItems = (sid: string, oid: string, t: (key: string) => string, lang: string = 'cz'): MenuItem[] => [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: <Home className="w-5 h-5" />, href: `https://is.mendelu.cz/auth/?lang=${lang}` },
    { id: 'exams', label: t('sidebar.exams'), icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'subjects', label: t('sidebar.subjects'), icon: <Book className="w-5 h-5" /> },
    { id: 'map', label: t('sidebar.map'), icon: <Map className="w-5 h-5" /> },
    {
        id: 'is',
        label: t('sidebar.is'),
        icon: <User className="w-5 h-5" />,
        expandable: true,
        children: [
            { id: 'eduroam', label: t('sidebar.eduroam'), icon: <Wifi className="w-4 h-4" />, isFeature: true },
            { id: 'portal-studenta', label: t('sidebar.portal'), icon: <LayoutDashboard className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/moje_studium.pl?lang=${lang}` },
            { id: 'zaznamniky', label: t('sidebar.notebooks'), icon: <ClipboardList className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/student/list.pl?studium=${sid};obdobi=${oid};lang=${lang}` },
            { id: 'testy', label: t('sidebar.tests'), icon: <PenTool className="w-4 h-4" />, href: `https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?_m=205;lang=${lang}` },
        ]
    },
];
```

- [ ] **Step 2: Replace `menuConfig.tsx`**

Replace `src/components/menuConfig.tsx` in full with:

```tsx
import { Settings, LogOut } from 'lucide-react';
import { mainItems } from './Menu/MainItems';

export interface MenuItem { 
    id: string; 
    label: string; 
    shortLabel?: string; 
    popupLabel?: string; 
    icon: React.ReactNode; 
    badge?: number; 
    expandable?: boolean; 
    children?: { 
        label: string; 
        id: string; 
        subtitle?: string; 
        icon?: React.ReactNode; 
        href?: string; 
        isFeature?: boolean; 
        isSubject?: boolean; 
        courseCode?: string; 
        subjectId?: string; 
    }[]; 
    danger?: boolean; 
    onClick?: () => void; 
    href?: string; 
    isFeature?: boolean;
    type?: 'item' | 'header' | 'divider';
}

export const getMainMenuItems = (sid: string = '', oid: string = '', t: (key: string) => string, lang: string = 'cz'): MenuItem[] => mainItems(sid, oid, t, lang);

export const getSettingsMenuItems = (logout: () => void): MenuItem[] => [
    { id: 'nastaveni', label: 'Nastavení', icon: <Settings className="w-5 h-5" /> },
    { id: 'odhlaseni', label: 'Odhlášení', icon: <LogOut className="w-5 h-5" />, danger: true, onClick: logout }
];
```

- [ ] **Step 3: Update `useMenuItems.ts`**

In `src/hooks/ui/useMenuItems.ts`, delete this line:

```ts
  const pinnedPages = useAppStore(state => state.pinnedPages);
```

and this line:

```ts
  const navPages = useAppStore(state => state.navPages);
```

and change:

```ts
  const items = getMainMenuItems(params?.studium ?? '', params?.obdobi ?? '', t, language, pinnedPages, navPages);
```

to:

```ts
  const items = getMainMenuItems(params?.studium ?? '', params?.obdobi ?? '', t, language);
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 — this was the last consumer of `pinnedPages`/`PinnedPage`/`isPinned`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Menu/MainItems.tsx src/components/menuConfig.tsx src/hooks/ui/useMenuItems.ts
git commit -m "refactor(sidebar): drop pinnedPages/isPinned plumbing from menu config"
```

---

### Task 5: i18n cleanup — rename the trigger label, drop dead pin strings

**Files:**
- Modify: `src/i18n/locales/cs.json:129-132`
- Modify: `src/i18n/locales/en.json:129-132`

**Interfaces:** none — string-only changes consumed by `t('sidebar.addPin')` in Tasks 1–2.

- [ ] **Step 1: Edit `cs.json`**

In `src/i18n/locales/cs.json`, this block:

```json
    "addPin": "Přidat",
    "addPinTitle": "Připnout stránku",
    "pinNudge": "Připni si sem nejpoužívanější IS stránky",
    "pinLimitReached": "Maximum 6 stránek",
```

becomes:

```json
    "addPin": "IS stránky",
```

- [ ] **Step 2: Edit `en.json`**

In `src/i18n/locales/en.json`, this block:

```json
    "addPin": "Add",
    "addPinTitle": "Pin a page",
    "pinNudge": "Pin your most-used IS pages here",
    "pinLimitReached": "Maximum 6 pages",
```

becomes:

```json
    "addPin": "IS stránky",
```

(Same string in both locales — "IS stránky" is the Czech IS Mendelu system's proper name, not translated, matching how e.g. "eduroam" stays untranslated elsewhere in this file.)

- [ ] **Step 3: Verify JSON is still valid and the key is used**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/cs.json'))" && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json'))" && echo OK`
Expected: `OK`

Run: `grep -rn "addPinTitle\|pinNudge\|pinLimitReached" src`
Expected: no output (no remaining references — they were already removed from `NavItem.tsx`/`MobileNavSheet.tsx` in Tasks 1–2).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "i18n: rename sidebar.addPin to IS stránky, drop dead pin strings"
```

---

### Task 6: Update the stale `noHardcodedIds` regression test

**Files:**
- Modify: `src/utils/__tests__/noHardcodedIds.test.ts:44-48`

**Interfaces:** none.

**Why:** this test asserts the literal string `href: injectUserParams(p.href, sid, lang, oid)` exists in `MainItems.tsx`. Task 4 deleted that line (along with the rest of the pinned-pages mapping), so this assertion is now testing code that no longer exists and must be removed — not weakened, removed, since the behavior it guarded (no hardcoded IDs in pinned-page links) no longer applies because there are no more pinned-page links in that file.

- [ ] **Step 1: Remove the stale test block**

In `src/utils/__tests__/noHardcodedIds.test.ts`, delete this `it(...)` block from the `describe('injectUserParams', ...)` suite:

```ts
    it('should be used for pinned pages in MainItems.tsx', () => {
        const content = fs.readFileSync(path.resolve(__dirname, '../../components/Menu/MainItems.tsx'), 'utf-8');
        expect(content).toContain('injectUserParams');
        expect(content).toContain('href: injectUserParams(p.href, sid, lang, oid)');
    });
```

leaving the `describe('injectUserParams', ...)` block with only its first `it('should be used when navigating to pages in SearchBar', ...)` test.

- [ ] **Step 2: Run the test file**

Run: `npx vitest run src/utils/__tests__/noHardcodedIds.test.ts`
Expected: PASS (all remaining assertions green; the deleted one is gone).

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/noHardcodedIds.test.ts
git commit -m "test: drop stale pinned-pages assertion from noHardcodedIds"
```

---

### Task 7: Full verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 3: Full test suite**

Run: `npm run test:run`
Expected: exits 0, no failing tests.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Grep for leftover references**

Run: `grep -rln "PagePinnerModal\|pinnedPages\|pinPage\|unpinPage\|createPinnedPagesSlice\|PinnedPagesSlice\|migratePinnedIds" src`
Expected: no output.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`, load the unpacked extension build per the WXT dev workflow, open it on an IS Mendelu page (or with mock data per `VITE_USE_MOCK_DATA=true` if available). Hover the "Student" sidebar icon, confirm the flyout shows exactly 4 entries (eduroam, Portál studenta, Záznamníky, Testy) plus a new "IS stránky" row with a search icon. Click it, confirm `IsPortalPopover` opens, type a query, click a result, confirm it opens in a new tab and the popover stays open. Repeat on mobile width for `MobileNavSheet`.

- [ ] **Step 7: Final commit (if any cleanup was needed)**

```bash
git status
```

If Steps 1–6 required no further code changes, this task produces no commit — verification-only.
