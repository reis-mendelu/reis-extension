// The cheap look at IS the overview starts from: the subject list once, then each
// subject's folder listing and points, the assignments, the exams and the week
// ahead, a few requests at a time. It downloads no file. Each piece is read on
// its own and a piece that fails is reported, never replaced by "nothing": the
// diff then leaves that part of the record as it was.
import { TOOLS, assignmentsData, pointsFor, subjectsData, type ToolCtx } from './tools';
import { listFolderFiles, type SubjectFile } from './files';
import { boxRows, examRows, pointRows, weekRows, type BoxRow, type ExamRow } from './overviewShape';
import { isoDay } from './shape';
import type { FileLite, World } from './overviewRecord';

/** The same shape cache.run takes: the tool's name and arguments are its key. */
export type Run = (
  tool: string,
  args: Record<string, unknown>,
  fn: () => Promise<unknown>
) => Promise<unknown>;

export type SubjectRow = { code: string; name: string; subjectId?: string; folderUrl?: string };
export type Gathered = {
  subjects: SubjectRow[];
  /** The listings as IS gave them; undefined where this piece could not be read. */
  listings: Record<string, SubjectFile[] | undefined>;
  world: World;
  boxes?: BoxRow[];
  exams?: ExamRow[];
  week?: ReturnType<typeof weekRows>;
  problems: string[];
};

const CONCURRENCY = 4;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** A file's date as the diff compares it: Modifikace when IS shows one, else the upload date. */
export const modifiedOf = (f: SubjectFile) => f.modified || f.date || '';
export const labelOf = (f: SubjectFile) => f.file || f.name;

async function pool(tasks: (() => Promise<void>)[]) {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) await tasks[next++]!();
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));
}

export async function gather(run: Run, ctx: ToolCtx, now: Date): Promise<Gathered> {
  const data = await subjectsData(ctx);
  const subjects: SubjectRow[] = Object.entries(data).map(([code, s]) => ({
    code,
    name: text(s.nameCs) || text(s.displayName) || text(s.name) || text(s.fullName),
    ...(typeof s.subjectId === 'string' ? { subjectId: s.subjectId } : {}),
    ...(typeof s.folderUrl === 'string' ? { folderUrl: s.folderUrl } : {}),
  }));
  const problems: string[] = [];
  const g: Gathered = {
    subjects,
    listings: {},
    world: { subjects: subjects.map(({ code, name }) => ({ code, name })), files: {}, points: {} },
    problems,
  };
  const attempt = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      const m = (e instanceof Error ? e.message : String(e)).split('\n')[0]!.slice(0, 120);
      problems.push(`${label}: ${m}`);
    }
  };
  const viaTool = (name: string, args: Record<string, unknown>) => {
    const tool = TOOLS.find((t) => t.name === name)!;
    return run(name, args, () => tool.run(args, ctx));
  };

  const tasks: (() => Promise<void>)[] = [];
  for (const s of subjects) {
    const { code, folderUrl, subjectId } = s;
    if (folderUrl) {
      tasks.push(() =>
        attempt(`files of ${code}`, async () => {
          // Through the cache, like mendelu_subject_files: that notes each file's date
          // (so a later read can be served from the store) and saves the listing.
          const files = (await run('mendelu_subject_files', { code }, () =>
            listFolderFiles(folderUrl)
          )) as SubjectFile[];
          g.listings[code] = files;
          g.world.files[code] = files.map((f): FileLite => ({
            url: f.downloadUrl,
            label: labelOf(f),
            modified: modifiedOf(f),
          }));
        })
      );
    }
    if (subjectId) {
      tasks.push(() =>
        attempt(`points of ${code}`, async () => {
          const z = await run('mendelu_points', { code }, () => pointsFor(subjectId, ctx));
          g.world.points[code] = pointRows(z);
        })
      );
    }
  }
  tasks.push(() =>
    attempt('assignments', async () => {
      // Not cached under the tool's name: this answer carries IS's box ids, the tool's never does.
      g.boxes = boxRows(
        await run('overview_assignments', {}, () => assignmentsData(ctx, true)),
        now.getTime()
      );
      g.world.boxes = g.boxes;
    })
  );
  tasks.push(() =>
    attempt('exams', async () => {
      g.exams = examRows(await viaTool('mendelu_exams', {}));
      g.world.exams = g.exams;
    })
  );
  tasks.push(() =>
    attempt('timetable', async () => {
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      const from = isoDay(now);
      const to = isoDay(end);
      const lessons = await viaTool('mendelu_schedule', { from, to });
      g.week = weekRows(Array.isArray(lessons) ? (lessons as Record<string, string>[]) : []);
    })
  );
  await pool(tasks);
  return g;
}
