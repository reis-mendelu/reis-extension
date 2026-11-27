// A fake IS the overview tests can change between two looks: two subjects, each with
// a folder, points, an assignment box, an exam term and a lesson tomorrow. The test
// file declares the vi.mock calls (see mapPersistence.test.ts); this module fills in
// what they replace. It builds on mapKit, which supplies `boot` and the download.
import { beforeEach, vi } from 'vitest';
// First, so its beforeEach runs before the ones below and these fakes win.
import './mapKit';
import { fetchDualLanguageSubjects } from '../../src/api/subjects';
import { fetchFolderListing } from '../../src/api/documents/service';
import { fetchSubjectZaznamnik } from '../../src/api/zaznamnik';
import { fetchOdevzdavarny } from '../../src/api/odevzdavarny';
import { fetchDualLanguageExams } from '../../src/api/exams';
import { fetchFullSemesterSchedule } from '../../src/injector/dataFetchers';
import { isoDay } from '../shape';

export type F = { id: number; file: string; modified: string };
export type Row = { name: string; value: string };

const CODES = ['EBC-PS', 'EBC-PE'];

export const link = (id: number) =>
  `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${id};id=1;z=1`;

/** What IS shows right now; every test starts from the same one and changes it. */
export const world = {
  files: {} as Record<string, F[]>,
  points: {} as Record<string, Row[]>,
  boxes: [] as { name: string; deadline: string }[],
  terms: [] as { id: string; date: string; time: string }[],
  subjects: [] as string[],
  /** A listing that throws, by subject code. */
  broken: new Set<string>(),
  /** Holds every folder listing open until released. */
  hold: null as null | Promise<void>,
  listings: 0,
};

beforeEach(() => {
  Object.assign(world, {
    files: {
      'EBC-PS': [{ id: 1, file: 'sit.pdf', modified: '24. 11. 2025' }],
      'EBC-PE': [{ id: 2, file: 'harmonogram.pdf', modified: '1. 10. 2026' }],
    },
    points: {
      'EBC-PS': [{ name: 'Test 1', value: '12' }],
      'EBC-PE': [],
    },
    boxes: [{ name: 'Projekt', deadline: '31.12.2099 23:59' }],
    terms: [{ id: 't1', date: '12.01.2027', time: '09:00' }],
    subjects: [...CODES],
    hold: null,
    listings: 0,
  });
  world.broken.clear();

  const subject = (code: string, n: number) => ({
    code,
    name: `Předmět ${code}`,
    subjectId: String(n),
    folderUrl: `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${code}`,
  });
  vi.mocked(fetchDualLanguageSubjects).mockImplementation((async () => ({
    subjects: {
      data: Object.fromEntries(world.subjects.map((c, i) => [c, subject(c, i + 1)])),
    },
  })) as never);

  vi.mocked(fetchFolderListing).mockImplementation((async (url: string) => {
    world.listings++;
    if (world.hold) await world.hold;
    const code = new URL(url).searchParams.get('id')!;
    if (world.broken.has(code)) throw new Error('IS is busy');
    return {
      complete: true,
      files: (world.files[code] ?? []).map((f) => ({
        subfolder: '',
        file_name: f.file.replace(/\.\w+$/, ''),
        file_comment: '',
        author: 'A',
        date: '1. 10. 2026',
        modified: f.modified,
        files: [{ name: 'x', type: 'pdf', link: link(f.id), filename: f.file }],
      })),
    };
  }) as never);

  vi.mocked(fetchSubjectZaznamnik).mockImplementation((async (
    _s: string,
    _o: string,
    id: string
  ) => {
    const rows = world.points[world.subjects[Number(id) - 1] ?? ''] ?? [];
    return {
      ph: {
        fetchedAt: 1,
        sections: rows.length
          ? [
              {
                label: 'Průběžné hodnocení',
                arches: rows.map((r) => ({
                  name: r.name,
                  empty: false,
                  columns: ['Body'],
                  values: [r.value],
                })),
              },
            ]
          : [],
      },
      vt: { fetchedAt: 1, tests: [] },
    };
  }) as never);

  vi.mocked(fetchOdevzdavarny).mockImplementation((async () => ({
    lastFetched: Date.now(),
    periods: [],
    assignments: world.boxes.map((b, i) => ({
      courseId: '1',
      courseCode: 'EBC-PS',
      courseNameCs: 'x',
      courseNameEn: 'x',
      name: b.name,
      type: 'x',
      deadline: b.deadline,
      odevzdavarnaId: String(i),
      fileCount: 0,
      uploadUrl: '',
      section: 'open',
      isOpen: true,
    })),
  })) as never);

  vi.mocked(fetchDualLanguageExams).mockImplementation((async () => [
    {
      version: 1,
      id: '1',
      name: 'x',
      code: 'EBC-PS',
      sections: [
        {
          id: 's1',
          name: 'zkouška',
          type: 'z',
          status: 'open',
          terms: world.terms.map((t) => ({
            ...t,
            room: 'Q01',
            capacity: { occupied: 3, total: 20, raw: '3/20' },
          })),
        },
      ],
    },
  ]) as never);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  vi.mocked(fetchFullSemesterSchedule).mockImplementation((async () => [
    {
      date: isoDay(tomorrow).replaceAll('-', ''),
      startTime: '09:00',
      endTime: '10:40',
      courseCode: 'EBC-PS',
      courseName: 'x',
      isSeminar: true,
      room: 'Q02',
      campus: 'A',
      teachers: [],
    },
  ]) as never);
});
