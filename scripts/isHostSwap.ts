import type { Plugin } from 'vite';

// Prototype builds for another school on the same UIS (IS4U) system:
//
//   REIS_IS_HOST=is.czu.cz npx wxt zip
//
// Every `is.mendelu.cz` in the bundle and the manifest becomes that host, and
// Supabase is cut off, so a prototype install never reaches the production
// database (its "PEF" would land in MENDELU's PEF counts). Unset, nothing here
// runs and the build is the normal MENDELU one. Not a release path: the
// prototype has no Novinky, no daily count and MENDELU-only parsers where
// a school differs (see research/czu-dump/audit-2026-10-26.md).

const MENDELU_HOST = 'is.mendelu.cz';
const SUPABASE_HOST = 'zvbpgkmnrqyprtkyxkwn.supabase.co';

export const IS_HOST = process.env.REIS_IS_HOST || MENDELU_HOST;
// REIS_PROTOTYPE=1 makes the prototype for MENDELU itself: the only way to
// boot-test it (Supabase cut off) on an account we can sign in with.
export const isHostSwapped = IS_HOST !== MENDELU_HOST || process.env.REIS_PROTOTYPE === '1';

export function swapHost(text: string): string {
  return (
    text
      .replaceAll(MENDELU_HOST, IS_HOST)
      .replaceAll('is\\.mendelu\\.cz', IS_HOST.replaceAll('.', '\\.'))
      .replaceAll(SUPABASE_HOST, 'supabase.invalid')
      // Visible wording ("Otevřít v IS MENDELU", "Původní IS Mendelu"): just "IS".
      .replace(/\bIS (?:MENDELU|Mendelu)\b/g, 'IS')
  );
}

export function isHostSwapPlugin(): Plugin {
  return {
    name: 'reis-is-host-swap',
    enforce: 'pre',
    // Read by src/utils/otherSchool.ts to hide MENDELU-only features.
    config: () =>
      isHostSwapped
        ? { define: { 'import.meta.env.VITE_REIS_OTHER_SCHOOL': JSON.stringify('1') } }
        : {},
    transform(code, id) {
      if (!isHostSwapped || id.includes('/node_modules/')) return null;
      if (!/mendelu/i.test(code) && !code.includes(SUPABASE_HOST)) return null;
      return { code: swapHost(code), map: null };
    },
  };
}

/**
 * Same swap on the generated manifest: content-script matches, host permissions.
 * The prototype also gets its own Firefox add-on id, so it installs next to
 * reIS instead of replacing it (Chrome gives an unpacked build its own id).
 */
export function swapManifest(manifest: Record<string, unknown>): void {
  const swapped = JSON.parse(swapHost(JSON.stringify(manifest))) as Record<string, unknown>;
  const bss = swapped.browser_specific_settings as { gecko?: { id?: string } } | undefined;
  if (bss?.gecko) bss.gecko.id = `reis-prototype@${IS_HOST}`;
  Object.assign(manifest, swapped, { name: `reIS – ${IS_HOST} prototyp` });
}
