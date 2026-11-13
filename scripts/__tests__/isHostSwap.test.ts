import { describe, it, expect, vi, afterEach } from 'vitest';

// IS_HOST is read once at import, so each case imports a fresh module.
async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('../isHostSwap');
}

afterEach(() => vi.unstubAllEnvs());

describe('isHostSwap', () => {
  it('leaves a normal build alone: MENDELU, Supabase, no flag', async () => {
    const m = await load({ REIS_IS_HOST: '', REIS_PROTOTYPE: '' });
    expect(m.isHostSwapped).toBe(false);
    expect(
      m.isHostSwapPlugin().transform?.call({} as never, "'is.mendelu.cz'", '/src/a.ts')
    ).toBeNull();
  });

  it('points every IS address at the other school and cuts Supabase off', async () => {
    const m = await load({ REIS_IS_HOST: 'is.czu.cz' });
    expect(m.isHostSwapped).toBe(true);
    expect(
      m.swapHost(
        "fetch('https://is.mendelu.cz/auth/'); /^is\\.mendelu\\.cz$/; 'https://zvbpgkmnrqyprtkyxkwn.supabase.co'"
      )
    ).toBe("fetch('https://is.czu.cz/auth/'); /^is\\.czu\\.cz$/; 'https://supabase.invalid'");
  });

  it('rewrites modules and sets the flag through the plugin itself', async () => {
    const m = await load({ REIS_IS_HOST: 'is.czu.cz' });
    const plugin = m.isHostSwapPlugin();
    const config = (plugin.config as () => { define?: Record<string, string> })();
    expect(config.define?.['import.meta.env.VITE_REIS_OTHER_SCHOOL']).toBe('"1"');
    const out = plugin.transform?.call(
      {} as never,
      "fetch('https://is.mendelu.cz/x')",
      '/src/a.ts'
    ) as {
      code: string;
    };
    expect(out.code).toBe("fetch('https://is.czu.cz/x')");
    // node_modules are never touched.
    expect(
      plugin.transform?.call({} as never, "'is.mendelu.cz'", '/x/node_modules/lib/index.js')
    ).toBeNull();
  });

  it('REIS_PROTOTYPE=1 builds the prototype for MENDELU itself: flag on, Supabase cut', async () => {
    const m = await load({ REIS_IS_HOST: '', REIS_PROTOTYPE: '1' });
    expect(m.isHostSwapped).toBe(true);
    expect(m.IS_HOST).toBe('is.mendelu.cz');
    expect(m.swapHost("'https://zvbpgkmnrqyprtkyxkwn.supabase.co'")).toBe(
      "'https://supabase.invalid'"
    );
    const config = (m.isHostSwapPlugin().config as () => { define?: Record<string, string> })();
    expect(config.define?.['import.meta.env.VITE_REIS_OTHER_SCHOOL']).toBe('"1"');
  });

  it('says just "IS" where the text said IS MENDELU', async () => {
    const m = await load({ REIS_IS_HOST: 'insis.vse.cz' });
    expect(m.swapHost('Otevřít v IS MENDELU · Původní IS Mendelu')).toBe(
      'Otevřít v IS · Původní IS'
    );
  });

  it('swaps the manifest and names the prototype', async () => {
    const m = await load({ REIS_IS_HOST: 'is.czu.cz' });
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
