// Dev webapp entry: install the chrome shim BEFORE the app (and its transitive
// imports like icons.ts that read chrome.runtime.getURL at module eval), then
// boot the real reIS app exactly as the extension does.
import './chromeShim';

// Side-effect import, and deliberately first after chromeShim — before
// installWebPlatform, phoneOverride, and (most importantly) the app itself.
// Puts the app into demo mode on the deployed preview before anything in the
// module graph can reach the store and fire a real network call gated on
// that flag (trackDailyUsage() inside @/entrypoints/main/main's
// initializeStore()). Also see the ordering comment on
// `@/entrypoints/main/main` below, and earlyDemoMode.ts itself for why
// `bootDemoMode` at the bottom of this file is a separate, later step.
import './earlyDemoMode';

// Side-effect import: installs the web host. Must be an import, not a
// statement, for the same hoisting reason as phoneOverride below.
import './installWebPlatform';

// Side-effect import: must run BEFORE `@/entrypoints/main/main` so the phone
// override is applied before the React root renders. ES module imports hoist,
// so this only works because it appears in source order between chromeShim
// and main — see phoneOverride.ts for the override itself.
import './phoneOverride';

import '@/entrypoints/main/main';

// After the app, so it publishes the very store instance the React root renders
// from. See storeHandle.ts for why importing the module separately is not a
// reliable substitute.
import './storeHandle';

// After the app too, and deliberately: it re-posts the snapshot once it has
// written the user params the app's own first pass had to do without. See
// snapshotUserParams.ts.
import './snapshotUserParams';

// Last, and deliberately after the app: signs the harness in as a real society
// / reIS-admin account when credentials are configured, so the admin console
// can be tested against live Supabase instead of the in-memory dev store. Does
// nothing on a plain `npm run dev:web`. See devAdminSession.ts.
import './devAdminSession';

// Loads the deployed preview's demo data (enterDemo() + a store refresh), so
// the screens have data and stop trying to reach IS Mendelu. No-op locally.
// The flag itself is already set by now — see earlyDemoMode.ts at the top of
// this file — this only does the data loading, which needs the store and so
// cannot happen that early.
import { bootDemoMode } from './bootDemoMode';
void bootDemoMode(import.meta.env);
