// Dev webapp entry: install the chrome shim BEFORE the app (and its transitive
// imports like icons.ts that read chrome.runtime.getURL at module eval), then
// boot the real reIS app exactly as the extension does.
import './chromeShim';

// Side-effect import: installs the web host. Must be an import, not a
// statement, for the same hoisting reason as phoneOverride below.
import './installWebPlatform';

// Side-effect import: must run BEFORE `@/entrypoints/main/main` so the phone
// override is applied before the React root renders. ES module imports hoist,
// so this only works because it appears in source order between chromeShim
// and main — see phoneOverride.ts for the override itself.
import './phoneOverride';

import '@/entrypoints/main/main';

// Last, and deliberately after the app: signs the harness in as a real society
// / reIS-admin account when credentials are configured, so the admin console
// can be tested against live Supabase instead of the in-memory dev store. Does
// nothing on a plain `npm run dev:web`. See devAdminSession.ts.
import './devAdminSession';
