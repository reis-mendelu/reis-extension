import { useAppStore } from '../src/store/useAppStore';
import { isHarnessEnabled } from '../src/utils/harnessEnabled';

/**
 * Dev-webapp only: expose the app's own store on `window.__reisStore`.
 *
 * Automated UI checks need to read and drive real store state (open the admin
 * console, inspect a draft coordinate) from the page. Importing
 * `src/store/useAppStore` from a page script does NOT reliably give the same
 * module: Vite resolves a `/@fs/...` request and the app's own bundled import
 * to specifiers that sometimes dedupe and sometimes do not, so a check could
 * silently end up reading a SECOND, empty store and conclude the app was
 * broken. Publishing the instance the app actually renders from removes that
 * whole class of false result.
 *
 * Guarded by `isHarnessEnabled`, and lives in `dev/` — which the extension and
 * Capacitor builds do not contain at all. Not bare `DEV`: a preview build is a
 * PRODUCTION build, so `DEV` is false there and the handle was missing exactly
 * where `check:app` needs it to drive the phone tabs. That was the fourth guard
 * in this codebase dead for the same reason.
 */
if (isHarnessEnabled(import.meta.env)) {
  (window as unknown as { __reisStore: typeof useAppStore }).__reisStore = useAppStore;
}
