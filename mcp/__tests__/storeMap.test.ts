import { describe, it, expect } from 'vitest';
import { access } from 'node:fs/promises';
import { createMapPersist } from '../storeMap';
import { textPath } from '../storeText';
import { storeHarness } from './storeTestKit';

const { h, open } = storeHarness();
const URL = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=2';
const FILE = { filename: 'a.txt', kind: 'text', text: 'Made-up lecture text.' };

describe('storeMap', () => {
  it('serves a text only for the date it was read at, and never without a date', async () => {
    const { persist } = createMapPersist(open());
    await persist.save('mendelu_read_file', { url: URL }, FILE, 'modified 24. 11. 2025');
    expect(await persist.load('mendelu_read_file', { url: URL }, 'modified 24. 11. 2025')).toEqual(
      FILE
    );
    expect(
      await persist.load('mendelu_read_file', { url: URL }, 'modified 25. 11. 2025')
    ).toBeUndefined();
    expect(await persist.load('mendelu_read_file', { url: URL }, undefined)).toBeUndefined();
    expect(await persist.load('mendelu_read_file', { url: URL }, '')).toBeUndefined();
  });

  it('keeps a text read before any listing, but cannot vouch for it later', async () => {
    const { persist } = createMapPersist(open());
    await persist.save('mendelu_read_file', { url: URL }, FILE, undefined);
    await access(open().dir + '/' + textPath(URL));
    expect(
      await persist.load('mendelu_read_file', { url: URL }, 'modified 24. 11. 2025')
    ).toBeUndefined();
  });

  it('stores no document handed over whole (the plugin build): originals are step 5', async () => {
    const store = open();
    const { persist } = createMapPersist(store);
    const handover = {
      handover: { filename: 'a.pdf', mimeType: 'application/pdf', base64: 'AAAA', bytes: 3 },
    };
    await persist.save('mendelu_read_file', { url: URL }, handover, 'modified 24. 11. 2025');
    expect(await store.list()).toEqual([]);
  });

  it('does not serve listings or subjects back: those always go to IS', async () => {
    const { persist } = createMapPersist(open());
    await persist.save('mendelu_subjects', {}, [{ code: 'X' }], undefined);
    await persist.save('mendelu_subject_files', { code: 'EBC-PS' }, [], undefined);
    expect(await persist.load('mendelu_subjects', {}, undefined)).toBeUndefined();
    expect(
      await persist.load('mendelu_subject_files', { code: 'EBC-PS' }, undefined)
    ).toBeUndefined();
  });

  it('keeps nothing when a code would leave the folder, and the tool is not affected', async () => {
    const store = open();
    const { persist } = createMapPersist(store);
    await expect(
      persist.save('mendelu_subject_files', { code: '../../x' }, [], undefined)
    ).resolves.toBeUndefined();
    expect(await store.list()).toEqual([]);
  });

  it('writes the profile once per change and only the study fields', async () => {
    const store = open();
    const { saveProfile } = createMapPersist(store);
    const params = {
      studyForm: 'K',
      studyProgram: 'PI',
      username: 'xtest',
      fullName: 'Test',
      email: 'a@b',
    };
    await saveProfile(params);
    await saveProfile(params);
    const entries = await store.list();
    expect(entries.map((e) => e.path)).toEqual(['profile.json']);
    const body = (await store.readText('profile.json'))!;
    expect(JSON.parse(body)).toMatchObject({ studyForm: 'K', studyProgram: 'PI' });
    expect(body).not.toMatch(/xtest|Test|a@b/);
  });
});

const day = (d: string) => () => Date.parse(`${d}T10:00:00Z`);

describe('storeMap trust rules', () => {
  const STAMP = 'modified 24. 11. 2025';

  it('serves a text read the day after the date shown, never the same day', async () => {
    const store = open();
    const sameDay = createMapPersist(store, { now: day('2025-11-24') }).persist;
    await sameDay.save('mendelu_read_file', { url: URL }, FILE, STAMP);
    expect(await sameDay.load('mendelu_read_file', { url: URL }, STAMP)).toBeUndefined();
    const later = createMapPersist(store, { now: day('2025-11-25') }).persist;
    await later.save('mendelu_read_file', { url: URL }, FILE, STAMP);
    expect(await later.load('mendelu_read_file', { url: URL }, STAMP)).toEqual(FILE);
  });

  it('never serves on the document date: only Modifikace shows a replaced file', async () => {
    const { persist } = createMapPersist(open());
    await persist.save('mendelu_read_file', { url: URL }, FILE, 'date 1. 10. 2025');
    expect(
      await persist.load('mendelu_read_file', { url: URL }, 'date 1. 10. 2025')
    ).toBeUndefined();
  });

  it('the plugin build serves and keeps only text-native files', async () => {
    const store = open();
    const mcpb = createMapPersist(store).persist;
    const plugin = createMapPersist(store, { extractsText: false }).persist;
    const pdf = { filename: 'a.pdf', kind: 'pdf', text: 'extracted by the other build' };
    await mcpb.save('mendelu_read_file', { url: URL }, pdf, STAMP);
    expect(await mcpb.load('mendelu_read_file', { url: URL }, STAMP)).toEqual(pdf);
    expect(await plugin.load('mendelu_read_file', { url: URL }, STAMP)).toBeUndefined();
    const other = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=3';
    await plugin.save('mendelu_read_file', { url: other }, pdf, STAMP);
    expect(await plugin.load('mendelu_read_file', { url: other }, STAMP)).toBeUndefined();
    await plugin.save('mendelu_read_file', { url: URL }, FILE, STAMP);
    expect(await plugin.load('mendelu_read_file', { url: URL }, STAMP)).toEqual(FILE);
  });

  it('a download that began before another process forgot cannot land afterwards', async () => {
    const mine = createMapPersist(open());
    const token = await mine.persist.begin();
    await open().forget(); // another process
    await mine.persist.save('mendelu_read_file', { url: URL }, FILE, STAMP, token);
    await mine.saveProfile({ studyForm: 'P' }, token);
    expect(await open().list()).toEqual([]);
  });

  it('writes the profile again once another process has forgotten the folder', async () => {
    const m = createMapPersist(open());
    await m.saveProfile({ studyForm: 'P' }, await m.persist.begin());
    await open().forget(); // another process
    await m.saveProfile({ studyForm: 'P' }, await m.persist.begin());
    expect((await open().list()).map((e) => e.path)).toEqual(['profile.json']);
  });

  it('does not count a cancelled profile write as saved', async () => {
    const m = createMapPersist(open());
    const stale = await m.persist.begin();
    await open().forget();
    await m.saveProfile({ studyForm: 'P' }, stale); // cancelled
    await m.saveProfile({ studyForm: 'P' }, await m.persist.begin());
    expect((await open().list()).map((e) => e.path)).toEqual(['profile.json']);
  });

  it('saves the profile again after a reset', async () => {
    const store = open();
    const m = createMapPersist(store);
    await m.saveProfile({ studyForm: 'P' });
    await store.forget();
    m.reset();
    await m.saveProfile({ studyForm: 'P' });
    expect((await store.list()).map((e) => e.path)).toEqual(['profile.json']);
  });
});

describe('store.rebuild at server start', () => {
  it('leaves a folder that does not exist yet alone', async () => {
    const store = open();
    await store.rebuild();
    await expect(access(h.dir)).rejects.toThrow();
  });
});
