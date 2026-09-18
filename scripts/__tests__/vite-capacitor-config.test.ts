import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The Capacitor build copies `public/` verbatim into dist-capacitor/, which
// `npx cap sync` then copies into ios/App/App/public/ and Android's assets —
// i.e. straight into the binary that goes to the App Store. The web build has
// had a strip plugin for this since it started publishing to a public URL;
// the Capacitor build never did, so a machine that had ever run
// `scrape:real` / `sanitise:snapshot` shipped the builder's own academic
// record to the store.
describe('vite.capacitor.config.ts', () => {
  it('registers the reis-strip-dev-real-data plugin so no local snapshot reaches a store binary', async () => {
    const configPath = resolve(__dirname, '../../vite.capacitor.config.ts');
    const { default: capacitorConfig } = await import(configPath);

    const config =
      typeof capacitorConfig === 'function'
        ? await capacitorConfig({ command: 'build', mode: 'production' })
        : capacitorConfig;

    function flattenPlugins(plugins: unknown): unknown[] {
      if (!Array.isArray(plugins)) return [];
      const result: unknown[] = [];
      for (const p of plugins) {
        if (Array.isArray(p)) result.push(...flattenPlugins(p));
        else if (p) result.push(p);
      }
      return result;
    }

    const names = flattenPlugins(config.plugins).map((p) => (p as { name?: string })?.name ?? '');

    expect(names).toContain('reis-strip-dev-real-data');
  });
});
