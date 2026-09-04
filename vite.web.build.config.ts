import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import { resolve } from 'path';
import webDevConfig from './vite.web.config';
import { stripDevRealDataPlugin } from './scripts/stripDevRealData.mjs';

// The two dev-server plugins, by the `name` each one actually returns —
// verified against dev/snapshotPlugin.ts:33 and dev/adminSessionPlugin.ts:65.
// A name that matches nothing filters nothing, and the build then fails inside
// dev-server middleware that has no business running here.
const DEV_SERVER_PLUGINS = ['reis-snapshot-refresh', 'reis-dev-admin-session'];

// Build-only variant of the localhost:3000 harness config, for the deployed
// preview. Two differences, both deliberate:
//
//  1. No snapshot or admin-session plugin. Both are dev-server middleware and
//     do not exist in a build. Nothing is lost: the preview runs in mock mode,
//     where loadRealDataSnapshot returns early and no snapshot is ever fetched,
//     and devAdminSession bails because VITE_DEV_SOCIETY is set.
//  2. An explicit outDir — `dist-web/`, so it cannot collide with the WXT
//     extension output or dist-capacitor/.
//
// The env this expects (VITE_DEV_SOCIETY, VITE_PREVIEW_BUILD) comes from the `build:web` script, which refuses to run
// if anything carrying a credential is also present.
export default defineConfig(async (env) => {
  const base = (await (typeof webDevConfig === 'function'
    ? webDevConfig(env)
    : webDevConfig)) as UserConfig;

  // Filtered by name rather than by rebuilding the list from scratch, so a
  // plugin added to the dev config later is carried over here instead of being
  // silently lost. The spread is what replaces the array — mergeConfig
  // CONCATENATES plugin arrays, so passing plugins in the second argument would
  // put the dev-server plugins straight back.
  const plugins = (base.plugins ?? []).filter(
    (p) =>
      !(
        p &&
        typeof p === 'object' &&
        'name' in p &&
        DEV_SERVER_PLUGINS.includes(p.name as string)
      )
  );
  // publicDir is inherited unchanged from the dev config (below), which is
  // deliberate — it also carries fonts/icons/emoji/society images this build
  // needs. That means it also copies the gitignored real-data snapshot; this
  // plugin is what strips it back out, the equivalent of wxt.config.ts's
  // `build:publicAssets` hook for the extension build.
  plugins.push(stripDevRealDataPlugin());

  return mergeConfig(
    { ...base, plugins },
    {
      build: {
        outDir: resolve(__dirname, 'dist-web'),
        emptyOutDir: true,
        sourcemap: false,
      },
    }
  );
});
