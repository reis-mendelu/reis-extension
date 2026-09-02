# Mobile first-run welcome (language + one-tap eduroam) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After sign-in, a first-run screen in the Capacitor app offers CZ/EN and one tap that sets up eduroam natively, then continues into the app; never shown again once dismissed.

**Architecture:** A `welcomeSeen` flag on the mobile UI slice, hydrated from IndexedDB `meta.welcome_dismissed` in `startApp` before the React root renders, gates `MobileApp` between a new `WelcomeScreen` and the tab tree. The screen reuses `useEduroamSetup` + `nativeEduroamTarget`/`canConfigureEduroamNatively` (verified on Android and iOS) and `setLanguage`; no native code changes.

**Tech Stack:** React + Zustand slice pattern, IndexedDBService, DaisyUI/Tailwind (no custom CSS), `motion/react`, Vitest + Testing Library, i18n JSON.

**Spec:** `docs/superpowers/specs/2026-09-02-mobile-welcome-eduroam-design.md`.

## Global Constraints

- Iron rules: no `localStorage`; no `useEffect` for data fetching (hydration happens in the slice action called from `startApp`); DaisyUI classes only; max 200 lines per file; test first; direct imports.
- Copy keys under `mobile.welcome` in BOTH `cs.json` and `en.json` (`mobileKeys.test.ts` enforces parity). Reuse `eduroam.native.button`, `eduroam.native.working`, `eduroam.native.iosLifetime`, `onboarding.getStarted`, `settings.czech`, `settings.english`.
- IndexedDB key is exactly `meta` / `welcome_dismissed` (shared with the desktop modal and `SyncMigration`).
- The eduroam card renders only when `canConfigureEduroamNatively(target)`; demo mode never shows the screen.
- `welcomeSeen === null` renders the tab tree (never flash the welcome on a returning student).
- Card surface `bg-base-100` on the `bg-base-200` page; never `bg-base-300` on `base-200`.
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/store/types.ts` (MobileUiSlice) | `welcomeSeen`, `hydrateWelcome`, `dismissWelcome` types | 1 |
| `src/store/slices/createMobileUiSlice.ts` | the state + two actions | 1 |
| `src/store/slices/__tests__/createMobileUiSlice.test.ts` | slice tests | 1 |
| `src/i18n/locales/{cs,en}.json` | `mobile.welcome.*` keys | 2 |
| `src/components/mobile/WelcomeScreen.tsx` (new) | the screen | 2 |
| `src/components/mobile/WelcomeWifiCard.tsx` (new) | the eduroam card (keeps both files < 200 lines) | 2 |
| `src/components/mobile/__tests__/WelcomeScreen.test.tsx` (new) | screen tests | 2 |
| `src/components/mobile/MobileApp.tsx` | gate on `welcomeSeen === false` | 3 |
| `src/components/mobile/__tests__/MobileApp.test.tsx` (new) | gate tests | 3 |
| `capacitor/main.capacitor.tsx` | `hydrateWelcome({ demo })` before the root renders | 4 |
| `capacitor/__tests__/startApp.test.ts` | demo → seen; non-demo → hydrated | 4 |
| `dev/phoneOverride.ts` | dev-only `?welcome=1` forces the screen for verify-ui | 4 |

---

### Task 1: `welcomeSeen` on the mobile UI slice

**Files:** `src/store/types.ts`, `src/store/slices/createMobileUiSlice.ts`, `src/store/slices/__tests__/createMobileUiSlice.test.ts`

**Produces:**
```ts
welcomeSeen: boolean | null;
hydrateWelcome(o: { demo: boolean }): Promise<void>;
dismissWelcome(): Promise<void>;
```

- [ ] **Step 1: failing tests** — append to the slice test file (mock storage at the top):

```ts
vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) },
}));
```
```ts
describe('welcome', () => {
  it('starts unknown, so a returning student never sees a flash of the welcome', () => {
    expect(state.welcomeSeen).toBeNull();
  });

  it('hydrates to false when the key was never written (first run, or an install from before the screen existed)', async () => {
    const { IndexedDBService } = await import('../../../services/storage');
    vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);
    await state.hydrateWelcome({ demo: false });
    expect(IndexedDBService.get).toHaveBeenCalledWith('meta', 'welcome_dismissed');
    expect(state.welcomeSeen).toBe(false);
  });

  it('hydrates to true once dismissed', async () => {
    const { IndexedDBService } = await import('../../../services/storage');
    vi.mocked(IndexedDBService.get).mockResolvedValue(true);
    await state.hydrateWelcome({ demo: false });
    expect(state.welcomeSeen).toBe(true);
  });

  it('treats demo mode as seen without touching storage', async () => {
    const { IndexedDBService } = await import('../../../services/storage');
    vi.mocked(IndexedDBService.get).mockClear();
    await state.hydrateWelcome({ demo: true });
    expect(state.welcomeSeen).toBe(true);
    expect(IndexedDBService.get).not.toHaveBeenCalled();
  });

  it('dismissWelcome hides the screen immediately and persists the flag', async () => {
    const { IndexedDBService } = await import('../../../services/storage');
    await state.dismissWelcome();
    expect(state.welcomeSeen).toBe(true);
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'welcome_dismissed', true);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/store/slices/__tests__/createMobileUiSlice.test.ts` → FAIL (`hydrateWelcome` not a function).

- [ ] **Step 3: implement.** In `types.ts` `MobileUiSlice` add:
```ts
  /**
   * First-run welcome gate for the phone UI. null = not hydrated yet (render the
   * app, never flash the welcome at a returning student); false = show it.
   */
  welcomeSeen: boolean | null;
  hydrateWelcome: (o: { demo: boolean }) => Promise<void>;
  dismissWelcome: () => Promise<void>;
```
In the slice add `welcomeSeen: null,` and:
```ts
  // Read once at boot, before the root renders (capacitor/main.capacitor.tsx).
  // Same key as the desktop WelcomeModal: a device that dismissed it there has
  // dismissed it here. Demo mode is "seen" — there is no IS certificate to set
  // eduroam up from, and the reviewer's path should not open with a Wi-Fi alert.
  hydrateWelcome: async ({ demo }) => {
    if (demo) {
      set({ welcomeSeen: true });
      return;
    }
    const dismissed = await IndexedDBService.get('meta', 'welcome_dismissed');
    set({ welcomeSeen: dismissed === true });
  },
  // State first, storage second: the screen must go away on the tap, and a
  // failed write is logged by the caller through the returned promise.
  dismissWelcome: async () => {
    set({ welcomeSeen: true });
    await IndexedDBService.set('meta', 'welcome_dismissed', true);
  },
```
with `import { IndexedDBService } from '../../services/storage';`.

- [ ] **Step 4:** tests PASS; `npm run typecheck`. Commit: `feat(mobile): welcomeSeen gate state on the mobile UI slice`.

---

### Task 2: `WelcomeScreen` + copy

**Files:** `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`, `src/components/mobile/WelcomeScreen.tsx`, `src/components/mobile/WelcomeWifiCard.tsx`, `src/components/mobile/__tests__/WelcomeScreen.test.tsx`

- [ ] **Step 1: copy.** Under `"mobile"` in both locales add:
```json
    "welcome": {
      "title": "Vítej v reISu",
      "wifiLine": "Školní Wi-Fi jedním klepnutím",
      "wifiDone": "Hotovo, na fakultě se připojíš sám",
      "wifiFailed": "Nepovedlo se, nastavíš to později v profilu",
      "notNow": "Teď ne",
      "continue": "Pokračovat"
    }
```
```json
    "welcome": {
      "title": "Welcome to reIS",
      "wifiLine": "Campus Wi-Fi in one tap",
      "wifiDone": "Done, you'll connect on campus automatically",
      "wifiFailed": "Didn't work, you can set it up later in your profile",
      "notNow": "Not now",
      "continue": "Continue"
    }
```
`npx vitest run src/i18n/__tests__/mobileKeys.test.ts` → PASS.

- [ ] **Step 2: failing screen tests** — `WelcomeScreen.test.tsx`, mocking `useEduroamSetup` and `eduroamNative` as `EduroamSheet.test.tsx` does:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';
import { useAppStore } from '../../../store/useAppStore';
import { useEduroamSetup } from '../../../hooks/data/useEduroamSetup';
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../../../mobile/eduroamNative';

vi.mock('../../../hooks/data/useEduroamSetup', () => ({ useEduroamSetup: vi.fn() }));
vi.mock('../../../mobile/eduroamNative', () => ({
  canConfigureEduroamNatively: vi.fn().mockReturnValue(false),
  nativeEduroamTarget: vi.fn().mockReturnValue(null),
}));

type HookState = ReturnType<typeof useEduroamSetup>;
function hook(over: Partial<HookState> = {}): HookState {
  return {
    status: 'idle', target: 'ios', selectTarget: vi.fn(), password: null, qrDataUrl: null,
    error: null, outcome: null, run: vi.fn(), reset: vi.fn(), openProfilesSettings: vi.fn(),
    ...over,
  };
}
function setup(o: { os?: 'ios' | 'android' | null; hookState?: Partial<HookState> } = {}) {
  const os = o.os ?? null;
  vi.mocked(nativeEduroamTarget).mockReturnValue(os);
  vi.mocked(canConfigureEduroamNatively).mockReturnValue(os !== null);
  const h = hook(o.hookState);
  vi.mocked(useEduroamSetup).mockReturnValue(h);
  const dismissWelcome = vi.fn().mockResolvedValue(undefined);
  const setLanguage = vi.fn();
  useAppStore.setState({ language: 'cz', dismissWelcome, setLanguage } as never);
  render(<WelcomeScreen />);
  return { h, dismissWelcome, setLanguage };
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('WelcomeScreen', () => {
  it('off Capacitor there is no Wi-Fi card, just the title, language and Let\'s go', () => {
    const { dismissWelcome } = setup();
    expect(screen.getByText('Vítej v reISu')).toBeInTheDocument();
    expect(screen.queryByText('Nastavit eduroam')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jdeme na to' }));
    expect(dismissWelcome).toHaveBeenCalledOnce();
  });

  it('switches language with the same toggle the profile sheet uses', () => {
    const { setLanguage } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(setLanguage).toHaveBeenCalledWith('en');
  });

  it('on the phone shows the card and runs the native setup on tap', () => {
    const { h } = setup({ os: 'android' });
    expect(screen.getByText('Školní Wi-Fi jedním klepnutím')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nastavit eduroam' }));
    expect(h.run).toHaveBeenCalledWith('android');
  });

  it('Not now dismisses without touching eduroam', () => {
    const { h, dismissWelcome } = setup({ os: 'ios' });
    fireEvent.click(screen.getByRole('button', { name: 'Teď ne' }));
    expect(dismissWelcome).toHaveBeenCalledOnce();
    expect(h.run).not.toHaveBeenCalled();
  });

  it('after a save the card is done, the button is gone and the footer says Let\'s go', () => {
    setup({ os: 'android', hookState: { status: 'done', outcome: 'saved' } });
    expect(screen.getByText('Hotovo, na fakultě se připojíš sám')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nastavit eduroam' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jdeme na to' })).toBeInTheDocument();
    expect(screen.queryByText(/dokud máte reIS/)).not.toBeInTheDocument();
  });

  it('already-configured counts as done, and iOS gets the lifetime line', () => {
    setup({ os: 'ios', hookState: { status: 'done', outcome: 'already-configured' } });
    expect(screen.getByText('Hotovo, na fakultě se připojíš sám')).toBeInTheDocument();
    expect(screen.getByText(/dokud máte reIS nainstalovaný/)).toBeInTheDocument();
  });

  it('a cancelled system dialog goes quietly back to the button', () => {
    setup({ os: 'ios', hookState: { status: 'idle', outcome: 'cancelled' } });
    expect(screen.getByRole('button', { name: 'Nastavit eduroam' })).toBeInTheDocument();
    expect(screen.queryByText(/Nepovedlo se/)).not.toBeInTheDocument();
  });

  it('a failure says so in one line and lets the student continue', () => {
    const { dismissWelcome } = setup({ os: 'android', hookState: { status: 'error', outcome: 'failed' } });
    expect(screen.getByText(/Nepovedlo se, nastavíš to později v profilu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nastavit eduroam' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pokračovat' }));
    expect(dismissWelcome).toHaveBeenCalledOnce();
  });

  it('a rejection before the OS was reached is also the failure line', () => {
    setup({ os: 'android', hookState: { status: 'error', outcome: null, error: 'Failed to fetch' } });
    expect(screen.getByText(/Nepovedlo se/)).toBeInTheDocument();
  });

  it('shows the working state while the OS dialog is up', () => {
    setup({ os: 'ios', hookState: { status: 'working' } });
    expect(screen.getByText('Otevírám nastavení Wi-Fi…')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3:** run → FAIL (module missing).

- [ ] **Step 4: build the two components.**

`WelcomeWifiCard.tsx` — props `{ status, outcome, target, onSetup }`; renders the glyph (`Wifi` from lucide, `motion.div` pulse while working unless `useReducedMotion()`), the one line (`wifiLine` | `wifiDone` | `wifiFailed`), the button (`eduroam.native.button` / spinner + `eduroam.native.working`), hidden when done; on iOS + done, `eduroam.native.iosLifetime` in `text-xs text-base-content/60`. Card: `rounded-box bg-base-100 p-6 shadow-card flex flex-col items-center gap-4 text-center`. Done glyph: `text-primary` with a `Check` badge; idle glyph `text-base-content/70`.

`WelcomeScreen.tsx`:
```tsx
export function WelcomeScreen() {
  const { t, language } = useTranslation();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const dismissWelcome = useAppStore((s) => s.dismissWelcome);
  const target = nativeEduroamTarget();
  const native = target !== null && canConfigureEduroamNatively(target);
  const { status, outcome, run } = useEduroamSetup(target ?? undefined);
  const done = status === 'done' && (outcome === 'saved' || outcome === 'already-configured');
  const failed = status === 'error';
  const dismiss = () => void dismissWelcome().catch((e) => logError('WelcomeScreen.dismiss', e));
  // footer: done || !native → primary getStarted; failed → primary continue; else ghost notNow
}
```
Layout: `flex min-h-dvh flex-col bg-base-200 px-6 pb-[calc(1.5rem_+_env(safe-area-inset-bottom,0px))] pt-[calc(1.5rem_+_var(--safe-top,0px))]`; inner `mx-auto flex w-full max-w-sm flex-1 flex-col`; header row: `ReisLogo className="h-10 w-10"` left, language `join` right (`settings.czech`/`settings.english` labels, `btn btn-xs`, active `btn-primary`, inactive `btn-ghost opacity-60`); title `font-display text-3xl font-bold` under it; card centred in the remaining space (`flex-1 flex items-center`); footer button full width (`btn btn-primary w-full` or `btn btn-ghost w-full`). Passing `target ?? undefined` to the hook means the password prefetch runs only on the phone; off Capacitor the hook is idle and unused.

- [ ] **Step 5:** tests PASS; `npm run typecheck`; `npx eslint src/components/mobile`; prettier. Commit: `feat(mobile): first-run WelcomeScreen with language and one-tap eduroam`.

---

### Task 3: gate in `MobileApp`

**Files:** `src/components/mobile/MobileApp.tsx`, `src/components/mobile/__tests__/MobileApp.test.tsx`

- [ ] **Step 1: failing test** (mock the heavy screens):
```tsx
vi.mock('../screens/CalendarScreen', () => ({ CalendarScreen: () => <div>calendar-screen</div> }));
vi.mock('../screens/ExamsScreen', () => ({ ExamsScreen: () => null }));
vi.mock('../screens/SubjectsScreen', () => ({ SubjectsScreen: () => null }));
vi.mock('../screens/MapScreen', () => ({ MapScreen: () => null }));
vi.mock('../screens/StudentScreen', () => ({ StudentScreen: () => null }));
vi.mock('../nav/BottomNav', () => ({ BottomNav: () => <nav>bottom-nav</nav> }));
vi.mock('../sheets/SheetHost', () => ({ SheetHost: () => null }));
vi.mock('../WelcomeScreen', () => ({ WelcomeScreen: () => <div>welcome-screen</div> }));

it('shows the welcome instead of the tabs on first run', () => {
  useAppStore.setState({ welcomeSeen: false, mobileTab: 'calendar', demoMode: false } as never);
  render(<MobileApp />);
  expect(screen.getByText('welcome-screen')).toBeInTheDocument();
  expect(screen.queryByText('bottom-nav')).not.toBeInTheDocument();
});
it.each([null, true])('renders the tabs when welcomeSeen is %s', (v) => { ... expect calendar-screen and bottom-nav, no welcome-screen });
```
- [ ] **Step 2:** FAIL. **Step 3:** in `MobileApp`, after reading `demoMode`: `const welcomeSeen = useAppStore((s) => s.welcomeSeen); if (welcomeSeen === false) return <WelcomeScreen />;` with a comment that `null` (not hydrated: the extension's phone layout and the dev webapp never hydrate) renders the app. **Step 4:** PASS, typecheck, commit: `feat(mobile): gate the phone UI behind the first-run welcome`.

---

### Task 4: boot hydration + dev switch

**Files:** `capacitor/main.capacitor.tsx`, `capacitor/__tests__/startApp.test.ts`, `dev/phoneOverride.ts`

- [ ] **Step 1: failing test** in `startApp.test.ts` demo case: after `startApp({ demo: true })`, `expect(useAppStore.getState().welcomeSeen).toBe(true)`. Add a second test: `startApp({ demo: false })` with `IndexedDBService.get` returning undefined leaves `welcomeSeen === false` — but the non-demo path starts sync; the existing mock of `@/injector/syncGate` already neuters it. Mock `@/services/storage`'s `IndexedDBService.get` for `welcome_dismissed` → `undefined` (other keys as the real entrypoint needs: keep the real module and `vi.spyOn(IndexedDBService, 'get')` returning `undefined` only when `key === 'welcome_dismissed'`, else calling through).
- [ ] **Step 2:** FAIL. **Step 3:** in `startApp`, immediately before `await import('@/entrypoints/main/main')`:
```ts
  // Before the root renders, so the first frame is already either the welcome
  // or the app — never the app with the welcome flashing over it a tick later.
  await useAppStore.getState().hydrateWelcome({ demo });
```
- [ ] **Step 4:** in `dev/phoneOverride.ts`, inside the `if (import.meta.env.DEV)` block: `if (new URLSearchParams(window.location.search).get('welcome') === '1') useAppStore.setState({ welcomeSeen: false });` with a comment: dev-only, lets `verify-ui` reach the screen on the web host, where nothing hydrates the flag.
- [ ] **Step 5:** PASS, typecheck, commit: `feat(mobile): hydrate the welcome gate at boot; dev ?welcome=1`.

---

### Task 5: verification

- [ ] `npm run test:run`, `npm run typecheck`, changed-files `eslint --max-warnings=0`, prettier on touched files.
- [ ] verify-ui: `preview_start` `reis-webapp`, then `npm run verify:ui -- welcome --url "http://localhost:<port>/?welcome=1"` for dark and `--theme light`; read `.verify/` findings; no overflow/collision/contrast errors.
- [ ] iPad: `npm run cap:sync`, device build, install; delete-and-reinstall is not needed — `welcome_dismissed` was never written on mobile, so the welcome shows on next launch. Walk: welcome → CZ/EN switch → Nastavit eduroam → Join → done state + iOS line → Jdeme na to → calendar; relaunch → no welcome. Read the console for `Eduroam configure` / outcome. Record in the spec's §5.
