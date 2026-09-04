// Vite inlines every VITE_* variable into the bundle, and this bundle is served
// from a public URL. The preview needs exactly two variables (VITE_DEV_SOCIETY,
// VITE_PREVIEW_BUILD); anything else carrying the VITE_ prefix must stop the
// build rather than be published — an allowlist, not a denylist of the
// specific secrets we happened to think of. .env.example alone names
// VITE_GEMINI_API_KEY and VITE_GOOGLE_CLIENT_ID, neither of which a denylist
// of just VITE_EXTENSION_SECRET / VITE_SUPABASE_* would ever catch.
//
// Asserts on the ENVIRONMENT, not on the built output: grepping the bundle for
// a secret's value would require the value to be present in CI and in the test.
//
// Scoped to the VITE_ prefix specifically — every other environment variable
// (PATH, HOME, CI, ...) is left alone, since only VITE_* is what Vite inlines
// and rejecting anything broader would break the build on every machine.

const ALLOWED_VITE_VARS = ['VITE_DEV_SOCIETY', 'VITE_PREVIEW_BUILD'];

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string[]} VITE_-prefixed variable names present in `env` that are
 *   not on the allowlist, sorted
 */
export function findForbiddenWebBuildVars(env) {
  return Object.keys(env)
    .filter((key) => key.startsWith('VITE_') && !ALLOWED_VITE_VARS.includes(key))
    .sort();
}

// Only act when run as a script, so importing it from a test is side-effect free.
if (import.meta.url === `file://${process.argv[1]}`) {
  const found = findForbiddenWebBuildVars(process.env);
  if (found.length > 0) {
    console.error(
      `\nRefusing to build the public web bundle: ${found.join(', ')} present in the environment.\n` +
        `Vite inlines VITE_* into the bundle, so these would be published.\n` +
        `The web build takes exactly ${ALLOWED_VITE_VARS.join(' and ')}.\n` +
        // The one non-obvious cause, and it has already bitten once: Vercel's
        // "Automatically expose System Environment Variables" project setting
        // injects a VITE_VERCEL_* variable for every piece of build metadata it
        // knows (commit SHA, branch, author, commit message, project id, ...).
        // None are secret, but none are wanted in the bundle either, and the
        // failure otherwise reads as if something leaked.
        (found.some((k) => k.startsWith('VITE_VERCEL_'))
          ? `\nThe VITE_VERCEL_* names above are injected by Vercel's "Automatically expose System Environment Variables" project setting, not by this repo. Turn that setting off for this project — the web build does not use them.\n`
          : '')
    );
    process.exit(1);
  }
}
