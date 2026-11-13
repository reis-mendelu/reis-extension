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
    };
    m.swapManifest(manifest);
    expect(manifest).toEqual({
      name: 'reIS – is.czu.cz prototyp',
      host_permissions: ['https://is.czu.cz/*'],
      content_scripts: [{ matches: ['https://is.czu.cz/auth/'] }],
    });
  });
});
