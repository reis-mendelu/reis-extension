import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('vite.web.build.config.ts', () => {
  it('registers the reis-strip-dev-real-data plugin to prevent dev-real-data.json from shipping', async () => {
    const configPath = resolve(__dirname, '../../vite.web.build.config.ts');
    const { default: webBuildConfig } = await import(configPath);
    const env = { command: 'build', mode: 'production' };
    const config = await webBuildConfig(env);

    // Flatten the plugins array and filter out falsy entries, since
    // Vite's plugin array can contain nested arrays and null/undefined.
    function flattenPlugins(plugins: unknown): unknown[] {
      if (!Array.isArray(plugins)) return [];
      const result: unknown[] = [];
      for (const p of plugins) {
        if (Array.isArray(p)) {
          result.push(...flattenPlugins(p));
        } else if (p) {
          result.push(p);
        }
      }
      return result;
    }

    const flatPlugins = flattenPlugins(config.plugins);

    // Check that the strip plugin is present by name.
    const stripPluginFound = flatPlugins.some(
      (p) =>
        p &&
        typeof p === 'object' &&
        'name' in p &&
        p.name === 'reis-strip-dev-real-data'
    );

    expect(
      stripPluginFound,
      'reis-strip-dev-real-data plugin must be registered to prevent dev-real-data.json from shipping'
    ).toBe(true);
  });
});
