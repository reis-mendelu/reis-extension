import { describe, it, expect, vi, afterEach } from 'vitest';
import { SCHOOL_PROFILES } from '../../src/utils/schoolProfiles';

/**
 * The manifest each school's build ships, made the way WXT makes it: the
 * manifest literal in wxt.config.ts, plus what WXT adds, through the config's
 * own `build:manifestGenerated` hook. The school is read once at import, so
 * each case loads a fresh config.
 *
 * VŠE's is a store listing of its own (Chrome only), so it carries only what
 * VŠE's features use: its IS and nothing else. Every host there is a
 * justification in front of a reviewer, and a host the build never uses is a
 * reason to reject it. privacy:check reads only MENDELU's literal, so this is
 * the check on the VŠE override.
 */
type Manifest = Record<string, unknown> & {
  permissions?: string[];
  host_permissions?: string[];
  optional_permissions?: string[];
};

async function generated(env: Record<string, string>, manifestVersion: 2 | 3): Promise<Manifest> {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const config = (await import('../../wxt.config')).default as unknown as {
    manifest: Manifest;
    hooks: { 'build:manifestGenerated': (wxt: unknown, manifest: Manifest) => void };
  };
  // What WXT adds to the literal from the entrypoints (content.ts, background.ts).
  const host = env.REIS_PROTOTYPE === '1' || !env.REIS_SCHOOL ? 'is.mendelu.cz' : 'insis.vse.cz';
  const manifest: Manifest = {
    manifest_version: manifestVersion,
    ...structuredClone(config.manifest),
    background: { service_worker: 'background.js' },
    content_scripts: [
      {
        matches: ['https://is.mendelu.cz/auth/', 'https://is.mendelu.cz/auth/?*'],
        run_at: 'document_start',
        js: ['content-scripts/content.js'],
      },
    ],
  };
  // WXT folds host_permissions into permissions for MV2.
  if (manifestVersion === 2) {
    manifest.permissions = [...(manifest.permissions ?? []), ...(manifest.host_permissions ?? [])];
    delete manifest.host_permissions;
  }
  config.hooks['build:manifestGenerated']({ config: { manifestVersion } }, manifest);
  expect(JSON.stringify(manifest.content_scripts)).toContain(host);
  return manifest;
}

afterEach(() => vi.unstubAllEnvs());

describe('the VŠE manifest (REIS_SCHOOL=vse)', () => {
  const VSE = { REIS_SCHOOL: 'vse', REIS_PROTOTYPE: '', REIS_IS_HOST: '' };

  it('is "reIS pro VŠE" on insis.vse.cz, and asks for nothing else', async () => {
    const m = await generated(VSE, 3);
    expect(m.name).toBe('reIS pro VŠE');
    expect(m.description).toBe(SCHOOL_PROFILES.vse.listing?.description);
    expect(m.host_permissions).toEqual(['https://insis.vse.cz/*']);
    // No map, so no OSM tile rule and no permission for it.
    expect(m.permissions).toEqual(['storage', 'unlimitedStorage', 'alarms']);
    expect(m).not.toHaveProperty('declarative_net_request');
    // Chrome only: no Firefox id or data categories that describe MENDELU's flows.
    expect(m).not.toHaveProperty('browser_specific_settings');
    expect(m.web_accessible_resources).toEqual([
      expect.objectContaining({ matches: ['https://insis.vse.cz/*'] }),
    ]);
  });

  it('names no MENDELU host, no Supabase and no other school anywhere', async () => {
    const text = JSON.stringify(await generated(VSE, 3));
    expect(text).not.toMatch(/mendelu/i);
    expect(text).not.toMatch(/supabase/i);
    expect(text).not.toMatch(/prototyp/i);
  });

  it('adds no webRequest in an MV2 build, which only the map needs', async () => {
    const m = await generated(VSE, 2);
    expect(m.permissions).toEqual([
      'storage',
      'unlimitedStorage',
      'alarms',
      'https://insis.vse.cz/*',
    ]);
    expect(m).not.toHaveProperty('optional_permissions');
  });
});

describe('the other builds', () => {
  it('REIS_PROTOTYPE=1 says it is a VŠE prototype on is.mendelu.cz', async () => {
    const m = await generated({ REIS_SCHOOL: 'vse', REIS_PROTOTYPE: '1', REIS_IS_HOST: '' }, 3);
    expect(m.name).toBe('reIS – VŠE prototyp na is.mendelu.cz');
    expect(m.host_permissions).toEqual(['https://is.mendelu.cz/*']);
    // Its own Firefox id: installs next to reIS, never over it.
    expect(m.browser_specific_settings).toMatchObject({
      gecko: { id: 'reis-prototype@is.mendelu.cz' },
    });
    expect(JSON.stringify(m)).not.toMatch(/supabase/i);
  });

  it('MENDELU keeps every host, the map rule and webRequest', async () => {
    const mv3 = await generated({ REIS_SCHOOL: '', REIS_PROTOTYPE: '', REIS_IS_HOST: '' }, 3);
    expect(mv3.name).toBe('reIS');
    expect(mv3.host_permissions).toHaveLength(10);
    expect(mv3).toHaveProperty('declarative_net_request');
    const mv2 = await generated({ REIS_SCHOOL: '', REIS_PROTOTYPE: '', REIS_IS_HOST: '' }, 2);
    expect(mv2.permissions).toEqual(expect.arrayContaining(['webRequest', 'webRequestBlocking']));
  });
});
