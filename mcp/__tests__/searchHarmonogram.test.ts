// Relevance on text shaped like a real course schedule: a made-up harmonogram
// (no real people or names) whose week table came out of a PDF extractor, with the
// line a student would ask about. Both the spelled and the diacritics-free query
// must land on that line.
import { describe, it, expect } from 'vitest';
import { runSearch } from '../searchTool';
import { storeHarness } from './storeTestKit';
import { seed, type SearchResult } from './searchKit';

const { open } = storeHarness();

// As extracted from a PDF: cells run together, lines broken where the layout broke them.
const HARMONOGRAM = `Harmonogram předmětu EBC-XX Ukázková ekonomika – ZS
2026/2027
Týden Datum Téma přednášky Cvičení
1 21. 9. Úvod do předmětu, podmínky zápočtu Organizace
2 28. 9. Státní svátek —
3 5. 10. Náklady a výnosy podniku Příklady 1
11 30. 11. Finanční plánování Příklady 8
12.–13. 7. 12. – 18. 12. 12. týden a 13. týden: zápočtové písemné práce
14 21. 12. Shrnutí a konzultace Zkouška – termíny v IS
Poznámka: Příchod na zápočtovou písemnou práci s indexem, žádné pomůcky kromě kalkulačky.`;

const CONDITIONS = `Podmínky absolvování
Zápočet: aktivní účast na cvičeních a min. 50 % bodů z průběžných testů.
Zkouška: písemná, 60 minut.`;

describe('a made-up harmonogram', () => {
  for (const query of [
    'zápočtové písemné práce',
    'zapoctove pisemne prace',
    '"Zápočtové písemné PRÁCE"',
  ]) {
    it(`finds the line for "${query}"`, async () => {
      const store = open();
      await seed(store, [
        {
          code: 'EBC-XX',
          name: 'Ukázková ekonomika',
          title: 'Harmonogram',
          file: 'harmonogram.pdf',
          modified: '24. 11. 2026',
          text: HARMONOGRAM,
        },
        { code: 'EBC-XX', file: 'podminky.pdf', modified: '24. 11. 2026', text: CONDITIONS },
      ]);
      const r = (await runSearch(store, { query })) as unknown as SearchResult;
      expect(r.hits).toHaveLength(1);
      const hit = r.hits[0]!;
      expect(hit).toMatchObject({ subject: 'EBC-XX', file: 'harmonogram.pdf' });
      // the whole line is in the snippet, with the matching words marked
      expect(hit.snippet!.replace(/\*\*/g, '')).toContain(
        '12. týden a 13. týden: zápočtové písemné práce'
      );
      expect(hit.snippet).toMatch(/týden: \*\*zápočtové/);
      expect(hit.line).toBe(8);
      expect(hit.storedPath).toMatch(/^text\/[0-9a-f]{32}\.json$/);
    });
  }

  it('ands a word of the file name with a word of its text, and matches part of a word', async () => {
    const store = open();
    await seed(store, [
      { code: 'EBC-XX', file: 'podminky.pdf', text: CONDITIONS },
      { code: 'EBC-XX', file: 'harmonogram.pdf', text: HARMONOGRAM },
    ]);
    const run = async (query: string) =>
      ((await runSearch(store, { query })) as unknown as SearchResult).hits.map((x) => x.file);
    // "zapoc" is in both files' text, "harmonogram" only in one file's name
    expect(await run('harmonogram zapoc')).toEqual(['harmonogram.pdf']);
    // more occurrences first
    expect(await run('zapoc')).toEqual(['harmonogram.pdf', 'podminky.pdf']);
    // "zapocet" is spelled "zápočtu" and "zápočtové" in the harmonogram, so it is not there
    expect(await run('harmonogram zapocet')).toEqual([]);
  });
});
