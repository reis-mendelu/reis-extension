/**
 * Whether harness-only behaviour is active.
 *
 * Two builds want it: the `npm run dev:web` dev server (`DEV`), and the
 * deployed Vercel preview, which is a production build and so has `DEV` false.
 * The extension and Capacitor builds set neither and must never get it.
 *
 * Kept as a pure function over an injected env rather than reading
 * `import.meta.env` directly, so it can be tested — the same reason
 * `resolveDevPhoneOverride` is a pure function next door.
 */
export interface HarnessEnv {
  DEV?: boolean;
  VITE_PREVIEW_BUILD?: string;
}

export function isHarnessEnabled(env: HarnessEnv): boolean {
  return env.DEV === true || env.VITE_PREVIEW_BUILD === 'true';
}
