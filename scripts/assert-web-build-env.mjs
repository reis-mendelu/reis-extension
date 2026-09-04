// Vite inlines every VITE_* variable into the bundle, and this bundle is served
// from a public URL. The preview needs exactly three variables; anything that
// carries a credential must stop the build rather than be published.
//
// Asserts on the ENVIRONMENT, not on the built output: grepping the bundle for
// a secret's value would require the value to be present in CI and in the test.

const FORBIDDEN_EXACT = ['VITE_EXTENSION_SECRET'];
const FORBIDDEN_PREFIXES = ['VITE_SUPABASE_'];

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string[]} forbidden variable names present in `env`, sorted
 */
export function findForbiddenWebBuildVars(env) {
  return Object.keys(env)
    .filter(
      (key) =>
        FORBIDDEN_EXACT.includes(key) || FORBIDDEN_PREFIXES.some((prefix) => key.startsWith(prefix))
    )
    .sort();
}

// Only act when run as a script, so importing it from a test is side-effect free.
if (import.meta.url === `file://${process.argv[1]}`) {
  const found = findForbiddenWebBuildVars(process.env);
  if (found.length > 0) {
    console.error(
      `\nRefusing to build the public web bundle: ${found.join(', ')} present in the environment.\n` +
        `Vite inlines VITE_* into the bundle, so these would be published.\n` +
        `The web build takes exactly VITE_DEV_SOCIETY and VITE_PREVIEW_BUILD.\n`
    );
    process.exit(1);
  }
}
