import { useAppStore } from '../src/store/useAppStore';

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
 * DEV-gated, and lives in `dev/` — the harness that only ever runs under
 * `npm run dev:web`, never in the extension or the Capacitor bundle.
 */
if (import.meta.env.DEV) {
  (window as unknown as { __reisStore: typeof useAppStore }).__reisStore = useAppStore;
}
