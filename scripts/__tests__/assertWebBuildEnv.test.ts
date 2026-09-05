import { describe, it, expect } from 'vitest';
import { findForbiddenWebBuildVars } from '../assert-web-build-env.mjs';

describe('findForbiddenWebBuildVars', () => {
  it('allows the three variables the preview build needs', () => {
    expect(
      findForbiddenWebBuildVars({
        VITE_DEV_SOCIETY: 'reis',
        VITE_PREVIEW_BUILD: 'true',
        PATH: '/usr/bin',
      })
    ).toEqual([]);
  });

  it('rejects the extension secret', () => {
    expect(findForbiddenWebBuildVars({ VITE_EXTENSION_SECRET: 'abc' })).toEqual([
      'VITE_EXTENSION_SECRET',
    ]);
  });

  it('rejects any Supabase credential by prefix', () => {
    expect(
      findForbiddenWebBuildVars({
        VITE_SUPABASE_URL: 'https://x.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'k',
      })
    ).toEqual(['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL']);
  });

  // An empty value still means the variable is present in the environment, and
  // a .env that sets it empty today can set it non-empty tomorrow. Fail on
  // presence, not on truthiness.
  it('rejects a forbidden variable even when it is empty', () => {
    expect(findForbiddenWebBuildVars({ VITE_EXTENSION_SECRET: '' })).toEqual([
      'VITE_EXTENSION_SECRET',
    ]);
  });

  // This used to be "ignores unrelated VITE_ variables it does not know
  // about" — a denylist hole: .env.example names VITE_GEMINI_API_KEY and
  // VITE_GOOGLE_CLIENT_ID, and neither would ever have appeared in
  // FORBIDDEN_EXACT / FORBIDDEN_PREFIXES. The script is an allowlist now, so
  // any VITE_ variable the build doesn't explicitly need is rejected.
  it('rejects any VITE_ variable that is not on the allowlist', () => {
    expect(findForbiddenWebBuildVars({ VITE_SOMETHING_ELSE: 'x' })).toEqual([
      'VITE_SOMETHING_ELSE',
    ]);
  });

  it('rejects VITE_ variables named in .env.example that the web build does not use', () => {
    expect(
      findForbiddenWebBuildVars({
        VITE_GEMINI_API_KEY: 'key',
        VITE_GOOGLE_CLIENT_ID: 'id',
      })
    ).toEqual(['VITE_GEMINI_API_KEY', 'VITE_GOOGLE_CLIENT_ID']);
  });

  it('leaves non-VITE_ environment variables alone', () => {
    expect(
      findForbiddenWebBuildVars({
        PATH: '/usr/bin',
        HOME: '/root',
        CI: 'true',
      })
    ).toEqual([]);
  });

  // Vercel injects these and no project setting fully stops it. They carry no
  // credential, and nothing in the app references a VITE_VERCEL_* name, so Vite
  // never inlines them — rejecting them would make the deploy permanently
  // unbuildable. Observed live: the allowlist failed a real Vercel build on 19
  // of them, then on VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG alone.
  it('allows the real-data flag', () => {
    expect(
      findForbiddenWebBuildVars({
        VITE_DEV_SOCIETY: 'reis',
        VITE_PREVIEW_BUILD: 'true',
        VITE_PREVIEW_DATA: 'real',
      })
    ).toEqual([]);
  });

  it("allows Vercel's platform-injected VITE_VERCEL_* metadata", () => {
    expect(
      findForbiddenWebBuildVars({
        VITE_DEV_SOCIETY: 'reis',
        VITE_PREVIEW_BUILD: 'true',
        VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG: 'x',
        VITE_VERCEL_GIT_COMMIT_SHA: 'abc',
        VITE_VERCEL_ENV: 'preview',
      })
    ).toEqual([]);
  });

  it('still rejects a non-Vercel VITE_ variable alongside them', () => {
    expect(
      findForbiddenWebBuildVars({
        VITE_VERCEL_ENV: 'preview',
        VITE_GEMINI_API_KEY: 'secret',
      })
    ).toEqual(['VITE_GEMINI_API_KEY']);
  });
});
