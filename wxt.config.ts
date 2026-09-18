import { defineConfig } from 'wxt';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { SNAPSHOT_FILENAMES } from './scripts/stripDevRealData.mjs';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  hooks: {
    // Never ship the localhost real-data snapshot in a production build.
    // It stays packed in dev (chrome-mv3-dev) so the unpacked extension can
    // fetch it, but is stripped from production output.
    'build:publicAssets'(wxt, files) {
      if (wxt.config.mode === 'production') {
        // Both local snapshots, not just the first one: `sanitise:snapshot`
        // writes preview-data.json into the same publication directory, and
        // it used to ride straight into the zip.
        for (const filename of SNAPSHOT_FILENAMES) {
          const i = files.findIndex((f) => f.relativeDest === filename);
          if (i !== -1) files.splice(i, 1);
        }
      }
    },
    // Strip the MV3-only OSM tile-identity keys from the MV2 (Firefox) build.
    //
    // This is done HERE rather than by making `manifest` a function of
    // `manifestVersion`, because scripts/assert-manifest-version-matches.mjs
    // reads the version straight out of the manifest object literal below with
    // a regex. A function manifest is unreadable to it and it fails closed —
    // correctly — which is what blocked the v5.2.2 tag. Keep it a plain object.
    //
    // That regex matches the FIRST occurrence in the file, comments included,
    // so do not write the manifest key followed by an open brace in prose
    // anywhere above the real one: it silently captures the comment instead and
    // the release fails with "Could not find manifest.version". Learned the
    // hard way, twice, in one release.
    'build:manifestGenerated'(wxt, manifest) {
      if (wxt.config.manifestVersion === 3) return;
      delete manifest.declarative_net_request;
      const dropped = ['declarativeNetRequestWithHostAccess', 'https://tile.openstreetmap.org/*'];
      // MV2 has no declarativeNetRequest at all, so the permission would be an
      // unknown string in front of an AMO reviewer and the host permission
      // would buy nothing (tiles are plain <img> loads). WXT folds
      // host_permissions into permissions for MV2, so filter both.
      if (manifest.permissions)
        manifest.permissions = manifest.permissions.filter((p: string) => !dropped.includes(p));
      if (manifest.host_permissions)
        manifest.host_permissions = manifest.host_permissions.filter(
          (p: string) => !dropped.includes(p)
        );
    },
  },
  webExt: {
    disabled: process.env.WXT_RUNNER_DISABLED === 'true',
  },
  manifest: {
    name: 'reIS',
    version: '5.2.5',
    description: 'Modernizovaný reIS rozšířený pro IS Mendelu',
    icons: {
      16: 'reIS_logo_16.png',
      48: 'reIS_logo_48.png',
      128: 'reIS_logo_128.png',
    },
    // `declarativeNetRequestWithHostAccess`, not plain `declarativeNetRequest`:
    // it can only act where a host permission already exists, which is the
    // whole of what the OSM rule below needs and reads far better in a store
    // review than blanket request-blocking would.
    //
    // MV3 only — the Firefox build is MV2 and the hook above strips it.
    permissions: ['storage', 'unlimitedStorage', 'alarms', 'declarativeNetRequestWithHostAccess'],
    // The campus map's basemap comes from OpenStreetMap, whose tile usage
    // policy blocks traffic it cannot attribute to a named app — and the block
    // is silent: every tile returns a 403 "not following the tile usage policy"
    // image, so the map becomes a wall of error tiles.
    //
    // The native shell already solves this by appending a name + contact URL to
    // the WebView User-Agent (capacitor.config.ts), which is why the map works
    // on a phone but not in the extension. The extension serves the app from a
    // `chrome-extension://` iframe: browsers strip an extension origin from
    // `Referer`, and `User-Agent` is a forbidden header for page JS, so its tile
    // requests arrived anonymous. A declarativeNetRequest rule is the only lever
    // an extension has, and it appends the SAME identifier the native shell
    // sends so OSM sees one reIS, not two.
    //
    // Known, accepted limitation: a STATIC rule cannot be scoped to "requests
    // reIS itself made", because the extension id is not knowable when the file
    // is written. So any other site in the same browser that loads OSM tiles
    // also gets `reIS/5` appended — their own Referer still identifies them, but
    // reIS's name rides along on traffic that is not ours. Measured alternative
    // if that ever matters: registering the rule DYNAMICALLY from the background
    // worker with `initiatorDomains: [chrome.runtime.id]` does scope it exactly
    // (verified with testMatchOutcome — our origin matches, other sites and
    // other extensions do not). It is not used here because a dynamic rule only
    // exists once the worker has run, and a static one is live from install.
    declarative_net_request: {
      rule_resources: [
        { id: 'osm-tile-identity', enabled: true, path: 'osm-tile-identity.rules.json' },
      ],
    },
    host_permissions: [
      'https://is.mendelu.cz/*',
      // Not for fetching — tiles are plain <img> loads and need no permission.
      // This is what makes the modifyHeaders rule above legal; without it the
      // rule is silently ignored.
      'https://tile.openstreetmap.org/*',
      'https://raw.githubusercontent.com/reis-mendelu/reis-data/*',
      'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/*',
      'https://skm.mendelu.cz/*',
      'https://mendelu.cz/*',
      'https://zvbpgkmnrqyprtkyxkwn.supabase.co/*',
      'https://hei.api.uni-foundation.eu/*',
      'https://photon.komoot.io/*',
    ],
    action: {
      default_popup: 'main.html',
    },
    browser_specific_settings: {
      gecko: {
        id: 'reis-extension@mendelu.cz',
        strict_min_version: '140.0',
        data_collection_permissions: {
          required: ['none'],
          optional: [],
        },
      },
      gecko_android: {
        strict_min_version: '140.0',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    web_accessible_resources: [
      {
        resources: [
          'main.html',
          'assets/*',
          'reIS_logo_16.png',
          'reIS_logo_48.png',
          'reIS_logo_128.png',
          'reIS_logo.svg',
          'fonts/*',
        ],
        matches: ['https://is.mendelu.cz/*'],
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }),
});
