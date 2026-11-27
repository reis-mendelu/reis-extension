import { describe, it, expect } from 'vitest';
import { createStore } from '../store';
import { toResult } from '../format';
import { runSearch, MAX_HITS } from '../searchTool';
import { storeHarness } from './storeTestKit';
import { seed, type SearchResult } from './searchKit';

const { h, open } = storeHarness();
const search = async (store: ReturnType<typeof open>, query: string, subject?: string) =>
  (await runSearch(store, { query, ...(subject ? { subject } : {}) })) as unknown as SearchResult;

describe('mendelu_search over the store', () => {
  it('says so when nothing is stored, and after a forget', async () => {
    const store = open();
    const empty = await search(store, 'zápočet');
    expect(empty.found).toBe(0);
    expect(empty.note).toMatch(/Nothing is stored yet.*mendelu_read_file/);

    await seed(store, [{ code: 'EBC-PE', file: 'a.txt', text: 'zápočet je 9. 12.' }]);
    expect((await search(store, 'zápočet')).found).toBe(1);
    await store.forget();
    expect((await search(store, 'zápočet')).note).toMatch(/Nothing is stored yet/);
  });

  it('ignores case and diacritics in both directions, in the text', async () => {
    const store = open();
    await seed(store, [
      { code: 'EBC-PE', file: 'a.txt', text: 'Písemná část: ZÁPOČET se píše v týdnu 12.' },
    ]);
    for (const q of ['zapocet', 'ZÁPOČET', 'pisemna', 'PISEMNA cast', 'týdnu']) {
      expect((await search(store, q)).found, q).toBe(1);
    }
    expect((await search(store, 'započet')).hits[0]!.snippet).toContain('**ZÁPOČET**');
  });

  it('ands words and matches a quoted phrase as a phrase', async () => {
    const store = open();
    await seed(store, [
      { code: 'EBC-PE', file: 'a.txt', text: 'Zápočtová písemná práce je povinná.' },
      { code: 'EBC-PE', file: 'b.txt', text: 'Práce písemná, zápočtová jen pro kombinované.' },
      { code: 'EBC-PE', file: 'c.txt', text: 'Zápočtová práce bez písemné části.' },
    ]);
    expect((await search(store, 'zapoctova pisemna prace')).hits.map((x) => x.file)).toEqual([
      'a.txt',
      'b.txt',
    ]);
    expect((await search(store, '"zapoctova pisemna prace"')).hits.map((x) => x.file)).toEqual([
      'a.txt',
    ]);
    expect((await search(store, 'zapoctova kalkulacka')).found).toBe(0);
  });

  it('matches a phrase across a line break, as a PDF breaks lines', async () => {
    const store = open();
    await seed(store, [{ code: 'EBC-PE', file: 'a.pdf', text: 'zápočtové\npísemné   práce 12.' }]);
    expect((await search(store, '"zápočtové písemné práce"')).found).toBe(1);
  });

  it('finds a hit past the 25,000 characters the old reader cut at', async () => {
    const store = open();
    const text = `${'Úvod do předmětu. '.repeat(3000)}Odevzdání projektu: 17. 1. 2027.`;
    expect(text.length).toBeGreaterThan(50_000);
    await seed(store, [{ code: 'EBC-PE', file: 'long.txt', text }]);
    const r = await search(store, 'odevzdani projektu');
    expect(r.hits[0]!.snippet).toContain('**Odevzdání** **projektu**: 17. 1. 2027.');
  });

  it('ranks a name match above any body-only hit, and more occurrences higher', async () => {
    const store = open();
    await seed(store, [
      { code: 'EBC-PE', file: 'prednaska1.txt', text: 'zápočet '.repeat(30) },
      { code: 'EBC-PE', file: 'prednaska2.txt', text: 'jednou zápočet' },
      { code: 'EBC-PE', file: 'Zapocet-podminky.txt', title: 'Podmínky zápočtu', text: 'nic' },
    ]);
    const files = (await search(store, 'zapocet')).hits.map((x) => x.file);
    expect(files).toEqual(['Zapocet-podminky.txt', 'prednaska1.txt', 'prednaska2.txt']);
  });

  it('searches names and listing metadata, for files whose text is not saved too', async () => {
    const store = open();
    await seed(store, [
      {
        code: 'EBC-PE',
        name: 'Podniková ekonomika',
        file: 'harmonogram.pdf',
        folder: 'Organizace',
        modified: '24. 11. 2026',
      },
      { code: 'EBC-PS', name: 'Počítačové sítě', file: 'sit.pdf', text: 'nic o tom' },
    ]);
    const byName = await search(store, 'harmonogram');
    expect(byName.hits).toHaveLength(1);
    expect(byName.hits[0]).toMatchObject({
      subject: 'EBC-PE',
      textSaved: 'no, matched by name only',
      modified: '24. 11. 2026',
    });
    expect(byName.searched).toMatch(/1 file with saved text.*1 without searchable text/);
    expect((await search(store, 'ekonomika organizace')).found).toBe(1); // subject name + folder
    expect((await search(store, '"24. 11. 2026"')).found).toBe(1); // modified date
    expect((await search(store, 'harmonogram', 'EBC-PS')).found).toBe(0); // subject filter
    expect((await search(store, 'sit', 'ebc-ps')).found).toBe(1);
  });

  it('tells the model to read the unread files when nothing fits', async () => {
    const store = open();
    await seed(store, [{ code: 'EBC-PE', file: 'conditions.pdf' }]);
    const r = await search(store, 'zapocet');
    expect(r.found).toBe(0);
    expect(r.note).toMatch(/no searchable text.*mendelu_read_file/);
  });

  it('caps the answer and says how many more', async () => {
    const store = open();
    await seed(
      store,
      Array.from({ length: 27 }, (_, i) => ({
        code: 'EBC-PE',
        file: `f${String(i).padStart(2, '0')}.txt`,
        text: `test číslo ${i}`,
      }))
    );
    const r = await search(store, 'test');
    expect(r.found).toBe(27);
    expect(r.hits).toHaveLength(MAX_HITS);
    expect(r.note).toBe('7 more, narrow the query (more words, a phrase or a subject).');
  });

  it('keeps a long answer compact', async () => {
    const store = open();
    const text = `${'slovo '.repeat(500)}test${' slovo'.repeat(500)}`;
    await seed(
      store,
      Array.from({ length: 30 }, (_, i) => ({ code: 'EBC-PE', file: `f${i}.txt`, text }))
    );
    const r = await search(store, 'test');
    expect(JSON.stringify(r).length).toBeLessThan(20_000);
  });

  it('flags a file replaced in IS after its text was saved, and hides nothing', async () => {
    const store = open();
    await seed(store, [
      {
        code: 'EBC-PE',
        file: 'a.txt',
        modified: '25. 11. 2026',
        readStamp: 'modified 24. 11. 2026',
        text: 'zápočet 9. 12.',
      },
      { code: 'EBC-PE', file: 'b.txt', modified: '24. 11. 2026', text: 'zápočet 9. 12.' },
    ]);
    const hits = (await search(store, 'zapocet')).hits;
    expect(hits).toHaveLength(2);
    const a = hits.find((x) => x.file === 'a.txt')!;
    expect(a.stale).toMatch(/may be out of date.*modified 25\. 11\. 2026.*modified 24\. 11\. 2026/);
    expect(hits.find((x) => x.file === 'b.txt')!.stale).toBeUndefined();
  });

  it('never writes: the folder is the same after a search', async () => {
    const store = open();
    await seed(store, [{ code: 'EBC-PE', file: 'a.txt', text: 'zápočet' }]);
    const before = await store.list();
    await search(store, 'zapocet');
    await search(store, 'nic');
    expect(await store.list()).toEqual(before);
  });

  it('reads what another process on the same folder wrote, while it keeps writing', async () => {
    const writer = open();
    const reader = createStore({ dir: h.dir });
    await seed(writer, [{ code: 'EBC-PE', file: 'a.txt', text: 'první: zápočet' }]);
    expect((await search(reader, 'zapocet')).found).toBe(1);
    const busy = Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        seed(writer, [{ code: 'EBC-PS', file: `n${i}.txt`, text: `další zápočet ${i}` }])
      )
    );
    const during = await Promise.all([search(reader, 'zapocet'), search(reader, 'zapocet')]);
    await busy;
    for (const r of during) expect(r.found).toBeGreaterThanOrEqual(1);
    expect((await search(reader, 'zapocet')).found).toBe(11);
  });

  it('says nothing is listed when only the subject list is stored', async () => {
    const store = open();
    await store.write('subjects.json', JSON.stringify({ subjects: [{ subjectCode: 'EBC-PE' }] }));
    const r = await search(store, 'zapocet');
    expect(r.note).toMatch(/Nothing is stored yet.*no file is listed or read/);
  });

  it('counts a scanned file (saved, no text) as unsearchable and says so', async () => {
    const store = open();
    await seed(store, [{ code: 'EBC-PE', file: 'sken.pdf', text: '  ' }]);
    const r = await search(store, 'zapocet');
    expect(r.searched).toMatch(/1 without searchable text.*no text in the file/);
  });

  it('prefers words that sit together over words scattered through a long text', async () => {
    const store = open();
    // five times as many occurrences, but never within 3,000 characters of each other
    const far = `${`zápočet ${'slovo '.repeat(500)}`.repeat(5)}písemka`;
    await seed(store, [
      { code: 'EBC-PE', file: 'skripta.pdf', text: far },
      { code: 'EBC-PE', file: 'harmonogram.pdf', text: 'Zápočet: 9. 12. písemka' },
    ]);
    expect((await search(store, 'zapocet pisemka')).hits.map((x) => x.file)).toEqual([
      'harmonogram.pdf',
      'skripta.pdf',
    ]);
  });

  it('lets a subject, folder or date match admit a file but never lift it above a body hit', async () => {
    const store = open();
    await seed(store, [
      { code: 'EBC-PE', folder: 'Zápočet', file: 'a.txt', text: 'test' },
      { code: 'EBC-PE', file: 'b.txt', text: 'test a zápočet' },
    ]);
    expect((await search(store, 'test zapocet')).hits.map((x) => x.file)).toEqual([
      'b.txt',
      'a.txt',
    ]);
  });

  it('stays inside the size limit, as markdown and as parseable JSON, with long rows', async () => {
    const store = open();
    const text = `zápočet${' slovo'.repeat(90)} písemka`;
    await seed(
      store,
      Array.from({ length: 30 }, (_, i) => ({
        code: 'EBC-PE',
        name: 'Podniková ekonomika a management výrobních podniků',
        folder: 'Přednášky a materiály ke zkoušce a zápočtu',
        file: `soubor-s-dlouhym-nazvem-${i}.pdf`,
        modified: '25. 11. 2026',
        readStamp: 'modified 24. 11. 2026',
        text,
      }))
    );
    const r = await runSearch(store, { query: 'zapocet pisemka' });
    expect(JSON.stringify(r, null, 2).length).toBeLessThan(21_000);
    const out = toResult(r, 'json');
    expect(out.content[0]!.text).not.toMatch(/truncated at/);
    expect(() => JSON.parse(out.content[0]!.text)).not.toThrow();
    expect(toResult(r, 'markdown').content[0]!.text).not.toMatch(/truncated at/);
    expect((r as unknown as SearchResult).found).toBe(30);
  });

  it('rejects a query with no usable word', async () => {
    await expect(runSearch(open(), { query: '" - "' })).rejects.toThrow(/at least one word/);
  });
});
