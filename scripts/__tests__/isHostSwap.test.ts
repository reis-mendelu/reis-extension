import { describe, it, expect, vi, afterEach } from 'vitest';

// The school is read once at import, so each case imports a fresh module.
async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('../isHostSwap');
}

const defines = (m: Awaited<ReturnType<typeof load>>) =>
  (m.isHostSwapPlugin().config as () => { define?: Record<string, string> })().define;

const transform = (m: Awaited<ReturnType<typeof load>>, code: string, id = '/src/a.ts') =>
  m.isHostSwapPlugin().transform?.call({} as never, code, id) as { code: string } | null;

afterEach(() => vi.unstubAllEnvs());

describe('isHostSwap', () => {
  it('leaves a normal build alone: MENDELU, Supabase, every feature', async () => {
    const m = await load({ REIS_SCHOOL: '', REIS_PROTOTYPE: '', REIS_IS_HOST: '' });
    expect(m.SCHOOL.id).toBe('mendelu');
    expect(m.isHostSwapped).toBe(false);
    expect(defines(m)?.['import.meta.env.VITE_REIS_SCHOOL']).toBe('"mendelu"');
    expect(transform(m, "'is.mendelu.cz'; 'https://zvbpgkmnrqyprtkyxkwn.supabase.co'")).toBeNull();
    // Feature checks stay runtime calls: a MENDELU build's code is never rewritten.
    expect(
      transform(m, "currentSchool.has('campusMap') && fetch('https://is.mendelu.cz/x')")
    ).toBeNull();
  });

  it('takes the host from the profile table and cuts Supabase off', async () => {
    const m = await load({ REIS_SCHOOL: 'czu' });
    expect(m.SCHOOL.id).toBe('czu');
    expect(m.IS_HOST).toBe('is.czu.cz');
    expect(m.isHostSwapped).toBe(true);
    expect(
      m.swapHost(
        "fetch('https://is.mendelu.cz/auth/'); /^is\\.mendelu\\.cz$/; 'https://zvbpgkmnrqyprtkyxkwn.supabase.co'"
      )
    ).toBe("fetch('https://is.czu.cz/auth/'); /^is\\.czu\\.cz$/; 'https://supabase.invalid'");
  });

  it('REIS_SCHOOL=vse builds for insis.vse.cz', async () => {
    const m = await load({ REIS_SCHOOL: 'vse' });
    expect(m.IS_HOST).toBe('insis.vse.cz');
    expect(defines(m)?.['import.meta.env.VITE_REIS_SCHOOL']).toBe('"vse"');
    // A swapped file keeps its feature checks as runtime calls; only the host changes.
    expect(
      transform(m, "currentSchool.has('campusMap') && fetch('https://is.mendelu.cz/x')")?.code
    ).toBe("currentSchool.has('campusMap') && fetch('https://insis.vse.cz/x')");
  });

  it('rewrites modules through the plugin itself', async () => {
    const m = await load({ REIS_SCHOOL: 'czu' });
    expect(transform(m, "fetch('https://is.mendelu.cz/x')")?.code).toBe(
      "fetch('https://is.czu.cz/x')"
    );
    // Feature checks are left for runtime.
    expect(transform(m, "currentSchool.has('campusMap') && x")).toBeNull();
    // node_modules are never touched.
    expect(transform(m, "'is.mendelu.cz'", '/x/node_modules/lib/index.js')).toBeNull();
  });

  it('REIS_PROTOTYPE=1 builds a school against MENDELU itself: its features, Supabase cut', async () => {
    const m = await load({ REIS_SCHOOL: 'vse', REIS_PROTOTYPE: '1' });
    expect(m.SCHOOL.id).toBe('vse');
    expect(m.isHostSwapped).toBe(true);
    expect(m.IS_HOST).toBe('is.mendelu.cz');
    expect(m.swapHost("'https://zvbpgkmnrqyprtkyxkwn.supabase.co'")).toBe(
      "'https://supabase.invalid'"
    );
    expect(defines(m)?.['import.meta.env.VITE_REIS_SCHOOL']).toBe('"vse"');
  });

  it('refuses a prototype without a school, an unknown school and the old REIS_IS_HOST', async () => {
    await expect(load({ REIS_SCHOOL: '', REIS_PROTOTYPE: '1' })).rejects.toThrow(/REIS_SCHOOL/);
    await expect(load({ REIS_SCHOOL: 'muni' })).rejects.toThrow(/muni/);
    await expect(load({ REIS_SCHOOL: '', REIS_IS_HOST: 'insis.vse.cz' })).rejects.toThrow(
      /REIS_SCHOOL=vse/
    );
  });

  it('says just "IS" where the text said IS MENDELU', async () => {
    const m = await load({ REIS_SCHOOL: 'vse' });
    expect(m.swapHost('Otevřít v IS MENDELU · Původní IS Mendelu')).toBe(
      'Otevřít v IS · Původní IS'
    );
  });

  it('swaps the manifest and names the prototype', async () => {
    const m = await load({ REIS_SCHOOL: 'czu' });
    const manifest: Record<string, unknown> = {
      name: 'reIS',
      host_permissions: ['https://is.mendelu.cz/*'],
      content_scripts: [{ matches: ['https://is.mendelu.cz/auth/'] }],
      browser_specific_settings: { gecko: { id: 'reis-extension@mendelu.cz' } },
    };
    m.swapManifest(manifest);
    expect(manifest).toEqual({
      name: 'reIS – is.czu.cz prototyp',
      host_permissions: ['https://is.czu.cz/*'],
      content_scripts: [{ matches: ['https://is.czu.cz/auth/'] }],
      // Its own Firefox id: installs next to reIS, never over it.
      browser_specific_settings: { gecko: { id: 'reis-prototype@is.czu.cz' } },
    });
  });
});
