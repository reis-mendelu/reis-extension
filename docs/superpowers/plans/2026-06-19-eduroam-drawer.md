# Eduroam Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the eduroam Wi-Fi setup tutorial from a full-page `AppView` into a side drawer (reusing `AdaptiveDrawer`) and restyle the tutorial to reIS quality, keeping the existing flow and hook unchanged.

**Architecture:** A new tiny Zustand slice holds an `isEduroamOpen` flag. A new `EduroamDrawer` component wraps the existing `useEduroamSetup` flow in `AdaptiveDrawer` and is rendered in `AppOverlays`. The desktop sidebar's Wi-Fi item flips the flag instead of switching views; the old `'eduroam'` `AppView` and its `AppMain` branch are removed. The three device panels (iOS/Android/Mac) are restyled to a DaisyUI vertical stepper.

**Tech Stack:** React 19, TypeScript (strict), Zustand (sliced) + Immer, Tailwind CSS 4 + DaisyUI 5, Vitest + happy-dom, WXT.

## Global Constraints

- **DaisyUI semantic classes only** — no custom CSS (Iron Rule).
- **Max 200 lines per file** — split if larger (Iron Rule).
- **Direct imports only** — no re-export barrels (Iron Rule).
- **NO `useEffect` for data fetching** (Iron Rule). The eduroam flow already fetches on user action via `useEduroamSetup`; do not add effects.
- **Test first** — write a failing test before implementation (Iron Rule), where a behavioral test is meaningful.
- **`useEduroamSetup.ts` is UNCHANGED** in this plan — it is pure, container-agnostic state/logic.
- **No new i18n keys** — all `eduroam.*` copy already exists in both `src/i18n/locales/cs.json` and `en.json`, including `eduroam.title` and `eduroam.subtitle`.
- After all changes: `npm run build` must exit 0, `npm run typecheck` must pass, `npm run test:run` must pass.
- Run `npm run build` after changes and confirm exit 0 before claiming done (standing user rule).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/store/slices/createEduroamSlice.ts` | Holds `isEduroamOpen` + `setIsEduroamOpen` | Create |
| `src/store/slices/__tests__/createEduroamSlice.test.ts` | Slice default + setter test | Create |
| `src/store/types.ts` | `EduroamSlice` interface + `AppState` intersection | Modify |
| `src/store/useAppStore.ts` | Register slice | Modify |
| `src/components/Eduroam/EduroamDrawer.tsx` | `AdaptiveDrawer` shell + header + device segmented picker + active device panel; self-connects to store | Create |
| `src/components/Eduroam/__tests__/EduroamDrawer.test.tsx` | Drawer open/closed + segment switch test | Create |
| `src/components/AppOverlays.tsx` | Render `<EduroamDrawer/>` | Modify |
| `src/components/Sidebar.tsx` | Wi-Fi item flips `isEduroamOpen` instead of `onViewChange('eduroam')` | Modify |
| `src/components/AppMain.tsx` | Remove `'eduroam'` branch + `EduroamSetup` import | Modify |
| `src/types/app.ts` | Remove `'eduroam'` from `AppView` | Modify |
| `src/components/Eduroam/EduroamSetup.tsx` | Logic absorbed by `EduroamDrawer` | Delete |
| `src/components/Eduroam/IosTransfer.tsx` | Restyle steps → DaisyUI vertical stepper + styled QR card | Modify |
| `src/components/Eduroam/AndroidTransfer.tsx` | Same restyle | Modify |
| `src/components/Eduroam/MacInstall.tsx` | Same restyle | Modify |

---

## Task 1: Eduroam store slice

**Files:**
- Create: `src/store/slices/createEduroamSlice.ts`
- Create: `src/store/slices/__tests__/createEduroamSlice.test.ts`
- Modify: `src/store/types.ts` (add `EduroamSlice` interface near the `StudyJamsSlice` interface at line 176; extend the `AppState` intersection at line 396)
- Modify: `src/store/useAppStore.ts` (import + spread the slice)

**Interfaces:**
- Produces:
  - `EduroamSlice` = `{ isEduroamOpen: boolean; setIsEduroamOpen: (open: boolean) => void }`
  - `createEduroamSlice: AppSlice<EduroamSlice>`
  - Store fields `isEduroamOpen` (default `false`) and `setIsEduroamOpen` available on `useAppStore`.

- [ ] **Step 1: Write the failing test**

Create `src/store/slices/__tests__/createEduroamSlice.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

afterEach(() => {
  useAppStore.setState({ isEduroamOpen: false });
});

describe('createEduroamSlice', () => {
  it('defaults isEduroamOpen to false', () => {
    expect(useAppStore.getState().isEduroamOpen).toBe(false);
  });

  it('setIsEduroamOpen toggles the flag', () => {
    useAppStore.getState().setIsEduroamOpen(true);
    expect(useAppStore.getState().isEduroamOpen).toBe(true);
    useAppStore.getState().setIsEduroamOpen(false);
    expect(useAppStore.getState().isEduroamOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createEduroamSlice.test.ts`
Expected: FAIL — `isEduroamOpen` is `undefined` / `setIsEduroamOpen is not a function`.

- [ ] **Step 3: Create the slice**

Create `src/store/slices/createEduroamSlice.ts`:

```ts
import type { AppSlice, EduroamSlice } from '../types';

export const createEduroamSlice: AppSlice<EduroamSlice> = (set) => ({
  isEduroamOpen: false,
  setIsEduroamOpen: (isOpen) => set({ isEduroamOpen: isOpen }),
});
```

- [ ] **Step 4: Add the type to `src/store/types.ts`**

Add this interface immediately above the existing `export interface StudyJamsSlice {` (line 176):

```ts
export interface EduroamSlice {
    isEduroamOpen: boolean;
    setIsEduroamOpen: (open: boolean) => void;
}
```

Then extend the `AppState` intersection (line 396) by appending `& EduroamSlice` (place it right after `& StudyJamsSlice`):

```ts
export type AppState = ScheduleSlice & ExamSlice & SyllabusSlice & ZaznamnikSlice & FilesSlice & NotesSlice & ClassmatesSlice & SubjectsSlice & SyncSlice & ThemeSlice & I18nSlice & ErrorReportingSlice & SuccessRateSlice & StudyJamsSlice & EduroamSlice & FeedbackSlice & StudyPlanSlice & CvicneTestsSlice & ErasmusSlice & PinnedPagesSlice & MenuSlice & HiddenItemsSlice & CalendarCustomEventsSlice & TeachingWeekSlice & NavPagesSlice & ContextSlice & PulseSlice & NotificationSlice & BulletinSlice & ViewportSlice & import('./slices/createSearchSlice').SearchSlice & import('./slices/createPersonProfileSlice').PersonProfileSlice;
```

- [ ] **Step 5: Register the slice in `src/store/useAppStore.ts`**

Add the import after the `createStudyJamsSlice` import (line 16):

```ts
import { createEduroamSlice } from './slices/createEduroamSlice';
```

Add the spread in the `create<AppState>` object right after `...createStudyJamsSlice(...a),` (line 52):

```ts
  ...createEduroamSlice(...a),
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/store/slices/__tests__/createEduroamSlice.test.ts`
Expected: PASS (both tests).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: exit 0 (no errors).

- [ ] **Step 8: Commit**

```bash
git add src/store/slices/createEduroamSlice.ts src/store/slices/__tests__/createEduroamSlice.test.ts src/store/types.ts src/store/useAppStore.ts
git commit -m "feat(eduroam): add isEduroamOpen store slice"
```

---

## Task 2: EduroamDrawer container

Creates the drawer that hosts the eduroam flow and renders it via `AppOverlays`. The device panels (`IosTransfer`/`AndroidTransfer`/`MacInstall`) are reused as-is in this task (their restyle is Task 4). `EduroamSetup.tsx` is left untouched and still used by `AppMain` until Task 3, so the app keeps working throughout.

**Files:**
- Create: `src/components/Eduroam/EduroamDrawer.tsx`
- Create: `src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`
- Modify: `src/components/AppOverlays.tsx`

**Interfaces:**
- Consumes: `isEduroamOpen`, `setIsEduroamOpen` (Task 1); `useEduroamSetup()` (existing, unchanged) returning `{ status, target, selectTarget, password, qrDataUrl, error, run, openProfilesSettings }`; `AdaptiveDrawer` (`open`, `onClose`, `width`, `title`); `IosTransfer`/`AndroidTransfer`/`MacInstall` (existing prop shapes); `PasswordChip`.
- Produces: `EduroamDrawer` (default-less named export, no props — self-connects to store). Each device segment button carries `role="tab"` and `aria-selected`.

- [ ] **Step 1: Write the failing test**

Create `src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EduroamDrawer } from '../EduroamDrawer';
import { useAppStore } from '../../../store/useAppStore';

afterEach(() => {
  cleanup();
  useAppStore.setState({ isEduroamOpen: false, isTouch: false, isNarrow: false });
});

function open() {
  useAppStore.setState({ isEduroamOpen: true, isTouch: false, isNarrow: false, language: 'en' });
}

describe('EduroamDrawer', () => {
  it('renders nothing when isEduroamOpen is false', () => {
    useAppStore.setState({ isEduroamOpen: false, isTouch: false, isNarrow: false });
    const { container } = render(<EduroamDrawer />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the title and three device segments when open', () => {
    open();
    render(<EduroamDrawer />);
    expect(screen.getByText('eduroam Wi-Fi')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /iPhone/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Android/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Mac/i })).toBeTruthy();
  });

  it('switches the active device segment on click', () => {
    open();
    render(<EduroamDrawer />);
    const android = screen.getByRole('tab', { name: /Android/i });
    fireEvent.click(android);
    expect(android.getAttribute('aria-selected')).toBe('true');
  });

  it('closes via the close button', () => {
    open();
    render(<EduroamDrawer />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(useAppStore.getState().isEduroamOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`
Expected: FAIL — `Cannot find module '../EduroamDrawer'`.

- [ ] **Step 3: Create the component**

Create `src/components/Eduroam/EduroamDrawer.tsx`:

```tsx
import { Wifi, Smartphone, Laptop, Tablet, AlertTriangle, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useEduroamSetup, type EduroamTarget } from '../../hooks/data/useEduroamSetup';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import { IosTransfer } from './IosTransfer';
import { AndroidTransfer } from './AndroidTransfer';
import { MacInstall } from './MacInstall';

const SEGMENTS: { id: EduroamTarget; labelKey: string; icon: typeof Smartphone }[] = [
  { id: 'ios', labelKey: 'eduroam.targetIos', icon: Smartphone },
  { id: 'android', labelKey: 'eduroam.targetAndroid', icon: Tablet },
  { id: 'mac', labelKey: 'eduroam.targetMac', icon: Laptop },
];

/** Side-drawer host for the eduroam setup flow. Self-connects to the store. */
export function EduroamDrawer() {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const isOpen = useAppStore((s) => s.isEduroamOpen);
  const setOpen = useAppStore((s) => s.setIsEduroamOpen);
  const { status, target, selectTarget, password, qrDataUrl, error, run, openProfilesSettings } =
    useEduroamSetup();

  const guideHref = `https://eduroam.mendelu.cz/?lang=${language === 'en' ? 'en' : 'cz'}`;
  const close = () => setOpen(false);

  return (
    <AdaptiveDrawer open={isOpen} onClose={close} width="sm:w-[560px]" title={t('eduroam.title')}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-base-300">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Wifi className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate">{t('eduroam.title')}</h3>
          <p className="text-xs text-base-content/50 truncate">{t('eduroam.subtitle')}</p>
        </div>
        <button onClick={close} aria-label="Close" className="btn btn-ghost btn-xs btn-circle">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        <div role="tablist" className="join w-full">
          {SEGMENTS.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={target === id}
              className={`join-item btn flex-1 gap-2 ${target === id ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
              onClick={() => selectTarget(id)}
            >
              <Icon className="w-4 h-4" /> {t(labelKey)}
            </button>
          ))}
        </div>

        {status === 'error' && (
          <div className="alert alert-error text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {t('eduroam.error')}
              {error ? `: ${error}` : ''}
            </span>
          </div>
        )}

        {target === 'ios' && (
          <IosTransfer status={status} qrDataUrl={qrDataUrl} password={password} onGenerate={() => run('ios')} />
        )}
        {target === 'android' && (
          <AndroidTransfer status={status} qrDataUrl={qrDataUrl} password={password} onGenerate={() => run('android')} />
        )}
        {target === 'mac' && (
          <MacInstall
            status={status}
            password={password}
            guideHref={guideHref}
            onDownload={() => run('mac')}
            onOpenSettings={openProfilesSettings}
          />
        )}

        <p className="text-xs text-base-content/40">{t('eduroam.privacyNote')}</p>
      </div>
    </AdaptiveDrawer>
  );
}
```

Note: `useEduroamSetup` already exports `EduroamTarget`. The `run` mock-free unit test never clicks Generate, so no network is triggered on render or segment switch.

- [ ] **Step 4: Render the drawer in `AppOverlays.tsx`**

In `src/components/AppOverlays.tsx`, add the import after the `StudyJamModal` import (line 4):

```tsx
import { EduroamDrawer } from './Eduroam/EduroamDrawer'
```

Add `<EduroamDrawer />` inside the returned fragment, after the `<StudyJamModal ... />` line (line 25):

```tsx
            <EduroamDrawer />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`
Expected: PASS (all four tests).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/Eduroam/EduroamDrawer.tsx src/components/Eduroam/__tests__/EduroamDrawer.test.tsx src/components/AppOverlays.tsx
git commit -m "feat(eduroam): EduroamDrawer (AdaptiveDrawer host) rendered in AppOverlays"
```

---

## Task 3: Swap the trigger and remove the old full-page view

Flips the sidebar Wi-Fi item to open the drawer and removes the now-dead `'eduroam'` `AppView`, its `AppMain` branch, and the orphaned `EduroamSetup.tsx`. After this task there is exactly one entry point (the sidebar → drawer) and no `'eduroam'` view.

**Files:**
- Modify: `src/components/Sidebar.tsx:65`
- Modify: `src/components/AppMain.tsx` (remove import line 8 and branch line 48)
- Modify: `src/types/app.ts:1`
- Delete: `src/components/Eduroam/EduroamSetup.tsx`

**Interfaces:**
- Consumes: `setIsEduroamOpen` (Task 1).
- Produces: `AppView` no longer contains `'eduroam'`. No component references `EduroamSetup`.

- [ ] **Step 1: Point the sidebar Wi-Fi item at the drawer**

In `src/components/Sidebar.tsx`, add a store read near the other hooks (after line 21, `const hookItems = useMenuItems();`):

```tsx
  const setIsEduroamOpen = useAppStore((s) => s.setIsEduroamOpen);
```

Add the import at the top of the file (after line 6, the `useMenuItems` import):

```tsx
import { useAppStore } from '../store/useAppStore';
```

Replace the eduroam branch (line 65):

```tsx
                  else if (item.id === 'eduroam') onViewChange('eduroam');
```

with:

```tsx
                  else if (item.id === 'eduroam') setIsEduroamOpen(true);
```

- [ ] **Step 2: Remove the full-page branch from `AppMain.tsx`**

Delete the import (line 8):

```tsx
import { EduroamSetup } from './Eduroam/EduroamSetup'
```

Delete the branch (line 48):

```tsx
                    {currentView === 'eduroam' && <EduroamSetup />}
```

- [ ] **Step 3: Remove `'eduroam'` from the `AppView` union**

In `src/types/app.ts`, change line 1 from:

```ts
export type AppView = 'calendar' | 'exams' | 'settings' | 'timeline-demo' | 'subjects' | 'studyPlan' | 'erasmus' | 'eduroam' | 'iskam-dashboard';
```

to:

```ts
export type AppView = 'calendar' | 'exams' | 'settings' | 'timeline-demo' | 'subjects' | 'studyPlan' | 'erasmus' | 'iskam-dashboard';
```

- [ ] **Step 4: Delete the orphaned page component**

```bash
git rm src/components/Eduroam/EduroamSetup.tsx
```

- [ ] **Step 5: Verify no dangling references remain**

Run: `grep -rn "'eduroam'\|EduroamSetup" src --include="*.ts" --include="*.tsx"`
Expected: NO matches for the `AppView` literal `'eduroam'` and NO matches for `EduroamSetup`. (Matches for the menu item id string `'eduroam'` in `Sidebar.tsx`/`MainItems.tsx` and the `eduroam.*` i18n keys are expected and fine — but `onViewChange('eduroam')` must be gone and `EduroamSetup` must have zero hits.)

- [ ] **Step 6: Typecheck (catches any missed `AppView` reference)**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Run the full unit suite**

Run: `npm run test:run`
Expected: PASS (existing eduroam/api/service tests + the two new tests from Tasks 1–2).

- [ ] **Step 8: Commit**

```bash
git add src/components/Sidebar.tsx src/components/AppMain.tsx src/types/app.ts
git commit -m "feat(eduroam): sidebar opens drawer; remove full-page eduroam view"
```

---

## Task 4: Restyle the device panels to a vertical stepper

Elevates the three device panels from a bare `<ol class="list-decimal">` to a DaisyUI `steps steps-vertical` stepper with a styled QR card. Behavior is identical — only markup/classes change. Existing eduroam tests must stay green.

**Files:**
- Modify: `src/components/Eduroam/IosTransfer.tsx`
- Modify: `src/components/Eduroam/AndroidTransfer.tsx`
- Modify: `src/components/Eduroam/MacInstall.tsx`

**Interfaces:**
- Consumes: same props as today (`status`, `qrDataUrl`, `password`, `onGenerate`; Mac adds `guideHref`, `onOpenSettings`); `PasswordChip`; `EduroamStatus`/`isMac` from `useEduroamSetup`.
- Produces: no API change — same exported component names and prop shapes.

- [ ] **Step 1: Confirm the existing eduroam tests pass before touching markup (baseline)**

Run: `npx vitest run src/components/Eduroam`
Expected: PASS (the EduroamDrawer test from Task 2). Note the result as the green baseline.

- [ ] **Step 2: Restyle `IosTransfer.tsx`**

Replace the entire file `src/components/Eduroam/IosTransfer.tsx` with:

```tsx
import { Loader2, QrCode, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import type { EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface Props {
  status: EduroamStatus;
  qrDataUrl: string | null;
  password: string | null;
  onGenerate: () => void;
}

/** iPhone / iPad path: encrypt + upload happen in the hook; here we show the QR + steps. */
export function IosTransfer({ status, qrDataUrl, password, onGenerate }: Props) {
  const { t } = useTranslation();

  if (status !== 'done' || !qrDataUrl) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-base-content/70">{t('eduroam.iosIntro')}</p>
        <button className="btn btn-primary btn-lg gap-2" disabled={status === 'working'} onClick={onGenerate}>
          {status === 'working' ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
          {status === 'working' ? t('eduroam.preparing') : t('eduroam.iosGenerate')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="alert alert-success text-sm">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>{t('eduroam.iosReady')}</span>
      </div>
      <div className="self-center bg-base-200 rounded-box p-4 flex flex-col items-center gap-2">
        <div className="bg-white p-3 rounded-xl">
          <img src={qrDataUrl} alt="eduroam QR" width={220} height={220} />
        </div>
      </div>
      <ul className="steps steps-vertical">
        <li className="step step-primary text-sm text-left">{t('eduroam.iosStep1')}</li>
        <li className="step step-primary text-sm text-left">{t('eduroam.iosStep2')}</li>
        <li className="step step-primary text-sm text-left">
          <span>
            {t('eduroam.iosStep3')}
            {password && <PasswordChip password={password} />}
          </span>
        </li>
        <li className="step step-primary text-sm text-left">{t('eduroam.iosStep4')}</li>
      </ul>
      <button className="btn btn-ghost btn-sm self-start" onClick={onGenerate}>
        {t('eduroam.regenerate')}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Restyle `AndroidTransfer.tsx`**

Replace the entire file `src/components/Eduroam/AndroidTransfer.tsx` with:

```tsx
import { Loader2, QrCode, ShieldCheck, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import type { EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface Props {
  status: EduroamStatus;
  qrDataUrl: string | null;
  password: string | null;
  onGenerate: () => void;
}

const GETEDUROAM_PLAY_URL = 'https://play.google.com/store/apps/details?id=app.eduroam.geteduroam';

/** Android path: generate .eap-config, upload, show the QR + geteduroam steps. */
export function AndroidTransfer({ status, qrDataUrl, password, onGenerate }: Props) {
  const { t } = useTranslation();

  if (status !== 'done' || !qrDataUrl) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-base-content/70">{t('eduroam.androidIntro')}</p>
        <a
          className="link link-primary text-sm inline-flex items-center gap-1"
          href={GETEDUROAM_PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="w-4 h-4" /> {t('eduroam.getEduroam')}
        </a>
        <button className="btn btn-primary btn-lg gap-2" disabled={status === 'working'} onClick={onGenerate}>
          {status === 'working' ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
          {status === 'working' ? t('eduroam.preparing') : t('eduroam.androidGenerate')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="alert alert-success text-sm">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>{t('eduroam.androidReady')}</span>
      </div>
      <div className="self-center bg-base-200 rounded-box p-4 flex flex-col items-center gap-2">
        <div className="bg-white p-3 rounded-xl">
          <img src={qrDataUrl} alt="eduroam QR" width={220} height={220} />
        </div>
      </div>
      <ul className="steps steps-vertical">
        <li className="step step-primary text-sm text-left">{t('eduroam.androidStep0')}</li>
        <li className="step step-primary text-sm text-left">{t('eduroam.androidStep1')}</li>
        <li className="step step-primary text-sm text-left">{t('eduroam.androidStep2')}</li>
        <li className="step step-primary text-sm text-left">
          <span>
            {t('eduroam.androidStep3')}
            {password && <PasswordChip password={password} />}
          </span>
        </li>
        <li className="step step-primary text-sm text-left">{t('eduroam.androidStep4')}</li>
      </ul>
      <button className="btn btn-ghost btn-sm self-start" onClick={onGenerate}>
        {t('eduroam.regenerate')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Restyle `MacInstall.tsx`**

Replace the entire file `src/components/Eduroam/MacInstall.tsx` with:

```tsx
import { Download, ShieldCheck, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import { isMac, type EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface Props {
  status: EduroamStatus;
  password: string | null;
  guideHref: string;
  onDownload: () => void;
  onOpenSettings: () => void;
}

/** Mac path: download the profile on this Mac and install it via System Settings. */
export function MacInstall({ status, password, guideHref, onDownload, onOpenSettings }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {!isMac && (
        <div className="alert alert-info text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {t('eduroam.macHostHint')}{' '}
            <a className="link" href={guideHref} target="_blank" rel="noopener noreferrer">
              {t('eduroam.openGuide')}
            </a>
          </span>
        </div>
      )}

      {status !== 'done' && (
        <button
          className="btn btn-primary btn-lg gap-2"
          disabled={!isMac || status === 'working'}
          onClick={onDownload}
        >
          {status === 'working' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {status === 'working' ? t('eduroam.preparing') : t('eduroam.download')}
        </button>
      )}

      {status === 'done' && (
        <div className="flex flex-col gap-4">
          <div className="alert alert-success text-sm">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{t('eduroam.downloaded')}</span>
          </div>
          <ul className="steps steps-vertical">
            <li className="step step-primary text-sm text-left">
              <span>
                {t('eduroam.step1')}
                <button className="btn btn-sm btn-outline gap-2 mt-2 ml-1" onClick={onOpenSettings}>
                  <ExternalLink className="w-4 h-4" />
                  {t('eduroam.openSettings')}
                </button>
              </span>
            </li>
            <li className="step step-primary text-sm text-left">{t('eduroam.step2')}</li>
            <li className="step step-primary text-sm text-left">
              <span>
                {t('eduroam.step3')}
                {password && <PasswordChip password={password} />}
              </span>
            </li>
            <li className="step step-primary text-sm text-left">{t('eduroam.step4')}</li>
          </ul>
          <button className="btn btn-ghost btn-sm self-start" onClick={onDownload}>
            {t('eduroam.regenerate')}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the eduroam tests**

Run: `npx vitest run src/components/Eduroam`
Expected: PASS (EduroamDrawer test still green — segment switch + open/close are unaffected by the panel restyle).

- [ ] **Step 6: Production build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/Eduroam/IosTransfer.tsx src/components/Eduroam/AndroidTransfer.tsx src/components/Eduroam/MacInstall.tsx
git commit -m "feat(eduroam): restyle device panels to DaisyUI vertical stepper + styled QR card"
```

---

## Final Verification

- [ ] `npm run typecheck` → exit 0
- [ ] `npm run test:run` → all pass
- [ ] `npm run build` → exit 0
- [ ] Manual smoke (optional, `npm run dev`): click the sidebar Wi-Fi item → drawer slides in from the right; switch iOS/Android/Mac segments; the old full-page eduroam view is gone.

---

## Self-Review

**Spec coverage:**
- Container = side drawer via `AdaptiveDrawer` → Task 2 (`EduroamDrawer` wraps `AdaptiveDrawer`, `width="sm:w-[560px]"`, `title`).
- Entry point = sidebar opens drawer; old view removed → Task 3.
- New `isEduroamOpen` slice (own slice, mirrors StudyJams) → Task 1.
- Rendered in `AppOverlays` → Task 2 Step 4.
- Removals (`AppView` member, `AppMain` branch, `onViewChange` wiring) → Task 3.
- Segmented device picker replacing `tabs-boxed` → Task 2 (DaisyUI `join`).
- Vertical stepper + styled QR card replacing `list-decimal` → Task 4 (DaisyUI `steps steps-vertical`).
- `useEduroamSetup` untouched → honored across all tasks (only imported, never edited).
- Error handling unchanged → preserved verbatim in Task 2's `status === 'error'` block.
- i18n: all keys exist, no new keys → confirmed in Global Constraints; no i18n file is modified.
- Testing: hook tests stay green (Task 3 Step 7 runs full suite); new `EduroamDrawer` render test → Task 2; build exit 0 → Task 4.

**Placeholder scan:** No TBD/TODO; every code step shows full file or exact edit.

**Type consistency:** `EduroamSlice` fields (`isEduroamOpen`, `setIsEduroamOpen`) are defined in Task 1 and consumed identically in Tasks 2–3. `EduroamTarget` is imported from the existing hook. Device panel prop shapes are unchanged, so `EduroamDrawer`'s usage in Task 2 matches the components restyled in Task 4.

**Scope note:** Eduroam is currently unreachable on mobile (the bottom nav's fixed tabs + `is`/`vice` sheets never surface the childless `eduroam` mainItem). Removing the view does not regress mobile. Adding a mobile entry point is a separate product decision and is intentionally out of scope.
