import { setDemoModeFlag } from '../src/errors/demoMode';
import { setDemoErrorHandler } from '../src/utils/reportError';
import { handleDemoError } from '../src/mobile/demoToast';
import { isPreviewBuild } from '../src/utils/harnessEnabled';

// Side-effect import, and deliberately the FIRST one in main.web.tsx after
// chromeShim — see the comment there and the ordering note in main.web.tsx.
//
// None of `errors/demoMode.ts`, `utils/reportError.ts`, `mobile/demoToast.ts`
// or `harnessEnabled.ts` import the store — `demoToast.ts`'s own comment
// documents why it deliberately doesn't (a slice → reportError → demoToast →
// useAppStore → slice cycle) — so this module cannot pull the store (or
// anything else in the app's module graph) in as a side effect of setting the
// flag. That matters: on the deployed preview, `@/entrypoints/main/main`
// calls `initializeStore()`, which fire-and-forgets `trackDailyUsage()` —
// guarded by `isDemoMode()` — before `bootDemoMode()` (imported last in
// main.web.tsx) ever runs. Without this early flag, that guard reads `false`
// and the preview files a real `track_daily_usage` RPC against production
// Supabase on every load, bot and crawler visits included. Setting the flag
// here, ahead of any import that could reach the store, is what makes the
// guard see the right value in time — and `src/store/slices/createDemoSlice.ts`
// seeds the store's own `demoMode` field from this same flag at creation, for
// the guards (`loadContext`, mainly) that read `get().demoMode` directly.
//
// `bootDemoMode()` still runs where it always has — it does the actual data
// loading (`enterDemo()` + `refreshDemoData()`), which needs the store and so
// cannot happen this early.
setDemoModeFlag(isPreviewBuild(import.meta.env));

// Registers the same demo-mode toast the Capacitor bootstrap wires up
// (capacitor/main.capacitor.tsx) — its comment there calling demo mode
// "Capacitor-only" predates the preview build's own demo mode and is now
// stale. Without a handler registered, `logError`'s documented fallback
// applies: a blocked `DemoModeError` (e.g. `getUserParams` in
// `loadContext`, itself gated on the store's `demoMode` field above) falls
// through to `sendTelemetry` and files a real `report_error_v2` RPC for an
// entirely expected, intentional block — on every preview load, again eating
// into the shared rate limit that protects genuine student error reports.
if (isPreviewBuild(import.meta.env)) {
  setDemoErrorHandler(handleDemoError);
}
