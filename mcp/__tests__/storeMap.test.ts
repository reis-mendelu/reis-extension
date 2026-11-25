import { describe, it, expect } from 'vitest';
import { access } from 'node:fs/promises';
import { createMapPersist, textPath } from '../storeMap';
import { storeHarness } from './storeTestKit';

const { h, open } = storeHarness();
const URL = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=2';
const FILE = { filename: 'a.txt', kind: 'text', text: 'Made-up lecture text.' };

describe('storeMap', () => {
  it('serves a text only for the date it was read at, and never without a date', async () => {
    const { persist } = createMapPersist(open());
    await persist.save('mendelu_read_file', { url: URL }, FILE, '24. 11. 2026');
    expect(await persist.load('mendelu_read_file', { url: URL }, '24. 11. 2026')).toEqual(FILE);
    expect(await persist.load('mendelu_read_file', { url: URL }, '25. 11. 2026')).toBeUndefined();
    expect(await persist.load('mendelu_read_file', { url: URL }, undefined)).toBeUndefined();
    expect(await persist.load('mendelu_read_file', { url: URL }, '')).toBeUndefined();
  });

  it('keeps a text read before any listing, but cannot vouch for it later', async () => {
    const { persist } = createMapPersist(open());
    await persist.save('mendelu_read_file', { url: URL }, FILE, undefined);
    await access(open().dir + '/' + textPath(URL));
    expect(await persist.load('mendelu_read_file', { url: URL }, '24. 11. 2026')).toBeUndefined();
  });

  it('stores no document handed over whole (the plugin build): originals are step 5', async () => {
    const store = open();
    const { persist } = createMapPersist(store);
    const handover = {
      handover: { filename: 'a.pdf', mimeType: 'application/pdf', base64: 'AAAA', bytes: 3 },
    };
    await persist.save('mendelu_read_file', { url: URL }, handover, '24. 11. 2026');
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

describe('store.rebuild at server start', () => {
  it('leaves a folder that does not exist yet alone', async () => {
    const store = open();
    await store.rebuild();
    await expect(access(h.dir)).rejects.toThrow();
  });
});
