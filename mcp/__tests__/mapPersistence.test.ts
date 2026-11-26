// S2 of docs/superpowers/specs/2026-11-25-reis-for-claude-map-design.md: what the tools read survives a restart, and only the cheap listings go back to IS.
// A "restart" is a second store and a second server on the same folder.
import { it, describe, expect, vi } from 'vitest';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { registerTools } from '../register';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

vi.mock('../../src/utils/userParams', () => ({
  getUserParams: vi.fn().mockResolvedValue({
    studium: 'S',
    obdobi: 'O',
    studyForm: 'P',
    studyProgram: 'PI',
    studyCode: 'PEF PI P [sem 3, roč 2]',
    facultyLabel: 'PEF',
    studySemester: 3,
    studyYear: 2,
    periodLabel: 'ZS 2026/2027',
    username: 'xtest',
    fullName: 'Test Student',
    studentId: '12345',
    email: 'xtest@mendelu.cz',
  }),
}));
vi.mock('../../src/injector/dataFetchers', () => ({ fetchFullSemesterSchedule: vi.fn() }));
vi.mock('../../src/api/exams', () => ({ fetchDualLanguageExams: vi.fn() }));
vi.mock('../../src/api/subjects', () => ({ fetchDualLanguageSubjects: vi.fn() }));
vi.mock('../../src/api/studyPlan', () => ({ fetchDualLanguageStudyPlan: vi.fn() }));
vi.mock('../../src/api/syllabus', async (orig) => ({
  ...(await orig<typeof import('../../src/api/syllabus')>()),
  fetchSyllabus: vi.fn(),
}));
vi.mock('../../src/api/successRate', () => ({ fetchSubjectSuccessRates: vi.fn() }));
vi.mock('../../src/api/gradeHistory', () => ({ fetchGradeHistory: vi.fn() }));
vi.mock('../../src/api/odevzdavarny', () => ({ fetchOdevzdavarny: vi.fn() }));
vi.mock('../../src/api/zaznamnik', () => ({ fetchSubjectZaznamnik: vi.fn() }));
vi.mock('../../src/api/documents/service', () => ({ fetchFolderListing: vi.fn() }));

import {
  DL,
  TEXT as _TEXT,
  is,
  tempDir,
  boot,
  ask,
  textOf,
  files,
  fetchFromIs,
  type Result,
} from './mapKit';
import { createStore } from '../store';

type Handler = (args: Record<string, unknown>) => Promise<Result>;

describe('what the tools read survives a restart', () => {
  it('serves an unchanged file from the store: no download, only listings reach IS', async () => {
    const { root, dir } = await tempDir();
    const first = await ask(boot(dir));
    expect(is.downloads).toHaveLength(1);

    const asked = { subjects: is.subjects, listings: is.listings };
    is.subjects = is.listings = 0;
    const second = await ask(boot(dir)); // "restart"
    expect(is.downloads).toHaveLength(1); // still the first one
    // The cheap listings go to IS again, exactly as on the first run.
    expect({ subjects: is.subjects, listings: is.listings }).toEqual(asked);
    expect(is.listings).toBeGreaterThan(0);
    expect(textOf(second)).toBe(textOf(first));
    expect(textOf(second)).toContain('12. 1. 2027');
    await rm(root, { recursive: true, force: true });
  });

  it('downloads again when the listing shows another modified date', async () => {
    const { root, dir } = await tempDir();
    await ask(boot(dir));
    is.modified = '25. 11. 2025';
    is.body = 'Nový termín: 19. 1. 2027.';
    const changed = await ask(boot(dir));
    expect(is.downloads).toHaveLength(2);
    expect(textOf(changed)).toContain('19. 1. 2027');

    const again = await ask(boot(dir)); // the new copy is what the store holds now
    expect(is.downloads).toHaveLength(2);
    expect(textOf(again)).toContain('19. 1. 2027');
    await rm(root, { recursive: true, force: true });
  });

  it('does not trust a date it cannot tell from an edit made later the same day', async () => {
    const { root, dir } = await tempDir();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' }).split('-');
    is.modified = `${Number(today[2])}. ${Number(today[1])}. ${today[0]}`;
    await ask(boot(dir)); // read on the day the file shows
    is.body = 'Opraveno odpoledne.';
    const again = await ask(boot(dir)); // same date, so only a download can tell
    expect(is.downloads).toHaveLength(2);
    expect(textOf(again)).toContain('Opraveno');
    await rm(root, { recursive: true, force: true });
  });

  it('downloads when no listing was seen first: it cannot vouch for the stored copy', async () => {
    const { root, dir } = await tempDir();
    await ask(boot(dir));
    await boot(dir).call('mendelu_read_file', { url: DL });
    expect(is.downloads).toHaveLength(2);
    await rm(root, { recursive: true, force: true });
  });

  it('stores the whole text, and cuts only what is handed back', async () => {
    const { root, dir } = await tempDir();
    is.body = `${'Přednáška o sítích. '.repeat(3000)}KONEC`; // about 60,000 characters
    const r = await ask(boot(dir));
    expect(textOf(r)).toContain('[truncated at 25000 chars');
    expect(textOf(r)).not.toContain('KONEC');

    const store = createStore({ dir });
    const entry = (await store.list()).find((e) => e.path.startsWith('text/'))!;
    const kept = JSON.parse((await store.readText(entry.path))!);
    expect(kept.file.text.endsWith('KONEC')).toBe(true);
    expect(kept.url).toBe(DL);
    await rm(root, { recursive: true, force: true });
  });

  it('keeps subjects, the listing, the profile and the original, and never a name or a login', async () => {
    const { root, dir } = await tempDir();
    await ask(boot(dir));
    const kept = await files(dir);
    expect(kept.filter((f) => !f.startsWith('text/'))).toEqual([
      'index.json',
      'listings/EBC-PS.json',
      expect.stringMatching(/^originals\/[0-9a-f]{32}\/\.reis-original\.json$/),
      expect.stringMatching(/^originals\/[0-9a-f]{32}\/harmonogram\.txt$/),
      'profile.json',
      'subjects.json',
    ]);
    expect(kept.filter((f) => f.startsWith('text/'))).toEqual([
      expect.stringMatching(/^text\/[0-9a-f]{32}\.json$/),
    ]);
    const profile = await readFile(join(dir, 'profile.json'), 'utf8');
    expect(JSON.parse(profile)).toMatchObject({ studyForm: 'P', studyProgram: 'PI', studyYear: 2 });
    for (const secret of ['xtest', 'Test Student', '12345', '@mendelu.cz']) {
      expect(profile).not.toContain(secret);
    }
    const listing = JSON.parse(await readFile(join(dir, 'listings/EBC-PS.json'), 'utf8'));
    expect(listing.files[0]).toMatchObject({ downloadUrl: DL, modified: '24. 11. 2025' });
    await rm(root, { recursive: true, force: true });
  });

  it('answers a student with an empty store exactly as a server with no store at all', async () => {
    const { root, dir } = await tempDir();
    const withStore = await ask(boot(dir));
    const handlers = new Map<string, Handler>();
    registerTools(
      {
        registerTool: (n: string, _m: unknown, h: Handler) => handlers.set(n, h),
      } as unknown as McpServer,
      { fetch: fetchFromIs }
    );
    await handlers.get('mendelu_subjects')!({});
    await handlers.get('mendelu_subject_files')!({ code: 'EBC-PS' });
    const without = await handlers.get('mendelu_read_file')!({ url: DL });
    expect(textOf(withStore)).toBe(textOf(without));
    await rm(root, { recursive: true, force: true });
  });
});

describe('an unwritable folder', () => {
  it('falls back to memory, the tools still answer, and the student is told once', async () => {
    const { root } = await tempDir();
    const blocker = join(root, 'a-file');
    await writeFile(blocker, 'not a folder');
    const s = boot(join(blocker, 'reIS for Claude'));
    const results = [
      await s.call('mendelu_subjects'),
      await s.call('mendelu_subject_files', { code: 'EBC-PS' }),
      await s.call('mendelu_read_file', { url: DL }),
      await s.call('mendelu_subjects'),
    ];
    expect(textOf(results[2]!)).toContain('12. 1. 2027');
    expect(s.store.persistent).toBe(false);
    const notices = results
      .flatMap((x) => x.content.map((c) => c.text ?? ''))
      .filter((t) => /working from memory/.test(t));
    expect(notices).toHaveLength(1);
    await rm(root, { recursive: true, force: true });
  });
});
