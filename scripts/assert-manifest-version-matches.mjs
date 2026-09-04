// release-tag.yml derives the tag it pushes from package.json's version, but
// `npm run zip` packages the manifest version WXT reads from wxt.config.ts
// (manifest.version). Those two can drift — e.g. a release PR that bumps
// package.json but forgets wxt.config.ts — and a store submission's version
// cannot be recalled once made, so this must fail closed: an unreadable
// wxt.config.ts is a hard error here, never a silent skip.
//
// wxt.config.ts is TypeScript, so the version is pulled out with a regex
// rather than imported/executed. The regex is scoped to the `manifest: { ... }`
// object specifically (found via brace-matching, not a flat line match) so a
// `version` field anywhere else in the file — vite config, a dependency
// version in a comment — can never be picked up by mistake.

import { readFileSync } from 'node:fs';

/**
 * Extracts the `version` field from the `manifest: { ... }` object in a
 * wxt.config.ts source string. Returns null if either the manifest object or
 * a version field inside it cannot be found — callers must treat that as a
 * failure, not as "no version bump".
 *
 * @param {string} source raw contents of wxt.config.ts
 * @returns {string | null}
 */
export function extractManifestVersion(source) {
  const keyMatch = /\bmanifest\s*:\s*\{/.exec(source);
  if (!keyMatch) return null;

  const openBrace = source.indexOf('{', keyMatch.index);
  if (openBrace === -1) return null;

  // Walk braces to find the matching close, so nested objects inside
  // `manifest` (icons, host_permissions, browser_specific_settings, ...)
  // can't confuse a naive "up to the next `}`" match.
  let depth = 0;
  let closeBrace = -1;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        closeBrace = i;
        break;
      }
    }
  }
  if (closeBrace === -1) return null;

  const manifestBlock = source.slice(openBrace, closeBrace + 1);
  const versionMatch = /version\s*:\s*['"]([^'"]+)['"]/.exec(manifestBlock);
  return versionMatch ? versionMatch[1] : null;
}

/**
 * @param {{ packageJson: string; wxtConfig: string }} sources raw file contents
 * @returns {{ ok: true; version: string } | { ok: false; reason: string }}
 */
export function checkManifestVersionMatches({ packageJson, wxtConfig }) {
  let packageVersion;
  try {
    packageVersion = JSON.parse(packageJson).version;
  } catch {
    return { ok: false, reason: 'package.json is not valid JSON.' };
  }
  if (!packageVersion) {
    return { ok: false, reason: 'package.json has no version field.' };
  }

  const manifestVersion = extractManifestVersion(wxtConfig);
  if (!manifestVersion) {
    return {
      ok: false,
      reason:
        'Could not find manifest.version in wxt.config.ts. Refusing to tag: an ' +
        'unreadable manifest version must fail the release, not be skipped, ' +
        'because a store submission cannot be taken back.',
    };
  }

  if (manifestVersion !== packageVersion) {
    return {
      ok: false,
      reason:
        `package.json version (${packageVersion}) does not match ` +
        `wxt.config.ts manifest.version (${manifestVersion}). The tag is ` +
        'derived from package.json, but the packaged extension manifest ' +
        'comes from wxt.config.ts — bump both together before releasing.',
    };
  }

  return { ok: true, version: packageVersion };
}

// Only act when run as a script, so importing it from a test is side-effect free.
if (import.meta.url === `file://${process.argv[1]}`) {
  const packageJson = readFileSync('package.json', 'utf8');
  const wxtConfig = readFileSync('wxt.config.ts', 'utf8');

  const result = checkManifestVersionMatches({ packageJson, wxtConfig });
  if (!result.ok) {
    console.error(`::error::${result.reason}`);
    process.exit(1);
  }
  console.log(`package.json and wxt.config.ts manifest agree on version ${result.version}.`);
}
