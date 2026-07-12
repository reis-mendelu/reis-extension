import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../collectRealData.ts'), 'utf8');

describe('scraper reuses the extension parsers (no drift)', () => {
  it('does not reimplement HTML parsing in the scraper', () => {
    expect(SRC).not.toMatch(/new DOMParser/);
    expect(SRC).not.toMatch(/parseFromString/);
    expect(SRC).not.toMatch(/\.querySelector/);
  });

  it('imports all IS data extraction from the extension api/services layer', () => {
    // Every IS fetcher used must come from @/api/*, @/services/sync/*,
    // @/injector/dataFetchers, @/utils/userParams, or @/types/messages.
    const importLines = SRC.split('\n').filter((l) => /^import .* from ['"]@\//.test(l));
    const nonSharedImport = importLines.find(
      (l) =>
        !/from ['"]@\/(api|services\/sync|injector\/dataFetchers|utils\/userParams|types\/messages)/.test(
          l
        )
    );
    expect(nonSharedImport, `unexpected import: ${nonSharedImport}`).toBeUndefined();
  });
});
