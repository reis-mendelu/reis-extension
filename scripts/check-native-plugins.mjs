#!/usr/bin/env node
/**
 * Fails the Capacitor sync when a local `native/*` plugin is declared in
 * package.json but missing from node_modules.
 *
 * This exists because of a shipped regression. `native/capacitor-eduroam` is a
 * `file:` dependency, and a worktree whose node_modules predated it never got
 * the symlink. `cap sync` then built `packageClassList` from the dependencies it
 * COULD see, silently omitted `EduroamPlugin`, and the app installed and ran —
 * right up to the point a student tapped "Nastavit eduroam" and got
 * `"Eduroam" plugin is not implemented on ios`. Nothing before that moment said
 * anything was wrong: the build succeeded, the tests passed, and the native
 * Swift was sitting in the repo the whole time.
 *
 * `npm install` fixes it. The point of this check is that the failure announces
 * itself at sync time instead of on someone's iPad — see
 * native/capacitor-secure-store/README.md for why packageClassList is the only
 * thing that registers an iOS plugin, and why it cannot be hand-patched.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

// Every plugin that lives in this repo rather than on npm.
const local = Object.entries(deps).filter(([, spec]) => String(spec).startsWith('file:native/'));

const missing = local.filter(([name]) => !existsSync(join(root, 'node_modules', name)));

// The inverse mistake: a plugin directory nobody depends on is dead weight and
// will not be synced either, so say so rather than leaving it to be discovered.
const nativeDir = join(root, 'native');
const declared = new Set(local.map(([, spec]) => String(spec).replace('file:', '')));
const orphans = existsSync(nativeDir)
  ? readdirSync(nativeDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(nativeDir, e.name, 'package.json')))
      .map((e) => `native/${e.name}`)
      .filter((p) => !declared.has(p))
  : [];

if (missing.length === 0 && orphans.length === 0) {
  console.log(`native plugins: ${local.length} declared, all installed`);
  process.exit(0);
}

for (const [name, spec] of missing) {
  console.error(`✖ ${name} (${spec}) is declared but not in node_modules.`);
  console.error(`  cap sync would omit it from packageClassList, and every call to it`);
  console.error(`  would reject with "plugin is not implemented on ios".`);
}
for (const p of orphans) {
  console.error(`✖ ${p} exists but nothing depends on it — cap sync will not include it.`);
  console.error(`  Add it to package.json as "file:${p}" or delete it.`);
}
console.error('');
console.error('Run `npm install` and sync again.');
process.exit(1);
