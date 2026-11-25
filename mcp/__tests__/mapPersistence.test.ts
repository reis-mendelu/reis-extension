// S2 of docs/superpowers/specs/2026-11-25-reis-for-claude-map-design.md: what the
// tools read survives a restart, and only the cheap listings go back to IS.
// A "restart" is a second store and a second server on the same folder.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

import { fetchDualLanguageSubjects } from '../../src/api/subjects';
import { fetchFolderListing } from '../../src/api/documents/service';
import { registerTools } from '../register';
import { createStore } from '../store';
import { NO_LOGIN_MESSAGE } from '../session';

const DL = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=2';
const FOLDER = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1';
const TEXT = 'Zápočtový test: 12. 1. 2027 v 9:00, místnost Q01.';

type Result = { isError?: boolean; content: { type: string; text?: string }[] };
type Handler = (args: Record<string, unknown>) => Promise<Result>;

/** The fake IS: counts what reaches it, and what it answers can be changed per test. */
const is = {
  subjects: 0,
  listings: 0,
  downloads: [] as string[],
  modified: '24. 11. 2026',
  body: TEXT,
  /** Holds a download open until released. */
  hold: null as null | Promise<void>,
};

beforeEach(() => {
  Object.assign(is, {
    subjects: 0,
    listings: 0,
    downloads: [],
    modified: '24. 11. 2026',
    body: TEXT,
  });
  is.hold = null;
  vi.mocked(fetchDualLanguageSubjects).mockImplementation((async () => {
    is.subjects++;
    return {
      subjects: {
        data: {
          'EBC-PS': {
            code: 'EBC-PS',
            name: 'Počítačové sítě',
            subjectId: '164074',
            folderUrl: FOLDER,
            fetchedAt: 1,
          },
        },
      },
    };
  }) as never);
  vi.mocked(fetchFolderListing).mockImplementation((async () => {
    is.listings++;
    return {
      complete: true,
      files: [
        {
          subfolder: '',
          file_name: 'Harmonogram',
          file_comment: '',
          author: 'A',
          date: '1. 10. 2026',
          modified: is.modified,
          files: [{ name: 'x', type: 'txt', link: DL, filename: 'harmonogram.txt' }],
        },
      ],
    };
  }) as never);
});

const fetchFromIs = (async (url: RequestInfo | URL) => {
  is.downloads.push(String(url));
  if (is.hold) await is.hold;
  const bytes = new TextEncoder().encode(is.body);
  return {
    ok: true,
    status: 200,
    headers: {
      get: (n: string) =>
        ({
          'content-type': 'text/plain',
          'content-disposition': 'attachment; filename="harmonogram.txt"',
        })[n.toLowerCase()] ?? null,
    },
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}) as unknown as typeof fetch;

async function tempDir() {
  const root = await mkdtemp(join(tmpdir(), 'reis-map-'));
  return { root, dir: join(root, 'reIS for Claude') };
}

/** One server process on `dir`: its own store, its own memory. */
function boot(dir: string, extra: { unavailable?: string } = {}) {
  const handlers = new Map<string, Handler>();
  const metas = new Map<string, Record<string, unknown>>();
  const server = {
    registerTool: (name: string, meta: Record<string, unknown>, h: Handler) => {
      handlers.set(name, h);
      metas.set(name, meta);
    },
  } as unknown as McpServer;
  const store = createStore({ dir });
  registerTools(server, { fetch: fetchFromIs, ...extra }, store);
  const call = (name: string, args: Record<string, unknown> = {}) => handlers.get(name)!(args);
  return { call, store, metas, handlers };
}

/** The question every test asks: subjects, the folder, then the file. */
async function ask(s: ReturnType<typeof boot>) {
  await s.call('mendelu_subjects');
  await s.call('mendelu_subject_files', { code: 'EBC-PS' });
  return s.call('mendelu_read_file', { url: DL });
}
const textOf = (r: Result) => r.content[0]!.text!;

async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (abs: string, rel: string) => {
    for (const e of await readdir(abs, { withFileTypes: true }).catch(() => [])) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(join(abs, e.name), r);
      else if (e.name !== '.generation') out.push(r);
    }
  };
  await walk(dir, '');
  return out.sort();
}

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
    is.modified = '25. 11. 2026';
    is.body = 'Nový termín: 19. 1. 2027.';
    const changed = await ask(boot(dir));
    expect(is.downloads).toHaveLength(2);
    expect(textOf(changed)).toContain('19. 1. 2027');

    const again = await ask(boot(dir)); // the new copy is what the store holds now
    expect(is.downloads).toHaveLength(2);
    expect(textOf(again)).toContain('19. 1. 2027');
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

  it('keeps subjects, the listing and the profile, and never a name or a login', async () => {
    const { root, dir } = await tempDir();
    await ask(boot(dir));
    const kept = await files(dir);
    expect(kept.filter((f) => !f.startsWith('text/'))).toEqual([
      'index.json',
      'listings/EBC-PS.json',
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
    expect(listing.files[0]).toMatchObject({ downloadUrl: DL, modified: '24. 11. 2026' });
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

describe('forget everything', () => {
  it('is registered even without an IS login, and marked destructive', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir, { unavailable: NO_LOGIN_MESSAGE });
    expect(s.metas.get('mendelu_forget_everything')).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    });
    const r = await s.call('mendelu_forget_everything');
    expect(r.isError).toBeUndefined();
    await rm(root, { recursive: true, force: true });
  });

  it('removes everything, says what it removed, and the next run starts from nothing', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await ask(s);
    const r = await s.call('mendelu_forget_everything', { response_format: 'json' });
    const report = JSON.parse(textOf(r));
    expect(report).toMatchObject({ forgotten: true, filesRemoved: 4 }); // subjects, listing, profile, one text
    expect(report.folder).toBe(dir);
    expect(await files(dir)).toEqual([]);

    await ask(s); // same process: its memory was forgotten too, so IS is asked again
    expect(is.downloads).toHaveLength(2);
    await rm(root, { recursive: true, force: true });
  });

  it('a download still running when it is called does not reappear', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await s.call('mendelu_subjects');
    await s.call('mendelu_subject_files', { code: 'EBC-PS' });
    let release!: () => void;
    is.hold = new Promise<void>((r) => (release = r));
    const reading = s.call('mendelu_read_file', { url: DL });
    await vi.waitFor(() => expect(is.downloads).toHaveLength(1));
    await s.call('mendelu_forget_everything');
    release();
    await reading;
    // Let any write the read queued finish, then look at the folder.
    await s.store.list();
    expect(await files(dir)).toEqual([]);
    await rm(root, { recursive: true, force: true });
  });
});
