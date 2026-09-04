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

  it('ignores unrelated VITE_ variables it does not know about', () => {
    expect(findForbiddenWebBuildVars({ VITE_SOMETHING_ELSE: 'x' })).toEqual([]);
  });
});
