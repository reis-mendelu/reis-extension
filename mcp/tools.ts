import { z } from 'zod';
import { getUserParams } from '../src/utils/userParams';
import { fetchFullSemesterSchedule } from '../src/injector/dataFetchers';
import { fetchDualLanguageExams } from '../src/api/exams';
import { fetchDualLanguageSubjects } from '../src/api/subjects';
import { fetchDualLanguageStudyPlan } from '../src/api/studyPlan';
import { fetchSyllabus, SYLLABUS_FETCH_FAILED } from '../src/api/syllabus';
import { fetchSubjectSuccessRates } from '../src/api/successRate';
import { fetchGradeHistory } from '../src/api/gradeHistory';
import { fetchOdevzdavarny, type Odevzdavarna } from '../src/api/odevzdavarny';
import { boxState } from '../src/utils/submissionBoxes';
import { listFolderFiles, readDokServerFile } from './files';
// Aliased to ./documentHandover in the plugin build, like the import in files.ts.
import { DOCUMENT_DESCRIPTION } from './documentText';
import { scheduleRows, defaultRange, compactStudyPlan } from './shape';

const UNCONFIRMED_NOTE =
  'Files are uploaded but the submission is NOT confirmed in IS, so the teacher does not see it as handed in. The student must open the box in IS and confirm it.';

/** Spell out the two-step IS submission so a model cannot read an upload as a hand-in. */
function submissionOf(box: Odevzdavarna) {
  switch (boxState(box)) {
    case 'confirmed':
      return { submission: 'handed_in' };
    case 'unconfirmed':
      return { submission: 'uploaded_not_confirmed', submissionNote: UNCONFIRMED_NOTE };
    case 'empty':
      return { submission: 'nothing_uploaded' };
  }
}

export type ToolCtx = {
  fetch: typeof fetch;
  /** Set while the server cannot reach IS at all (no login): every tool answers this. */
  unavailable?: string;
};
export type ToolDef = {
  name: string;
  title: string;
  description: string;
  input: z.ZodRawShape;
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown>;
};

const lang = z
  .enum(['cz', 'en'])
  .default('cz')
  .describe('Language of names and texts: "cz" (default) or "en".');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');

async function study(): Promise<{ studium: string; obdobi: string }> {
  const p = await getUserParams();
  if (!p?.studium || !p.obdobi)
    throw new Error('Could not find an active study on this IS account.');
  return { studium: p.studium, obdobi: p.obdobi };
}

/** reIS fetchers return { cz, en } for dual-language data; give the model one. */
function pickLang(value: unknown, l: unknown): unknown {
  if (value && typeof value === 'object' && 'cz' in value && 'en' in value) {
    return (value as Record<string, unknown>)[l === 'en' ? 'en' : 'cz'];
  }
  return value;
}

function omit(row: object, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
}

type SubjectsLite = { subjects?: { data?: Record<string, Record<string, unknown>> } } | null;

async function subjectsData(): Promise<Record<string, Record<string, unknown>>> {
  const { studium, obdobi } = await study();
  const res = (await fetchDualLanguageSubjects(studium, obdobi)) as SubjectsLite;
  // null is a failed fetch, not an empty enrolment: never report it as one.
  if (!res?.subjects?.data) throw new Error('IS Mendelu did not return your subjects. Try again.');
  return res.subjects.data;
}

export const TOOLS: ToolDef[] = [
  {
    name: 'mendelu_schedule',
    title: 'My timetable',
    description:
      'Your timetable from IS Mendelu for a date range (default: today and the next 14 days): lectures, seminars and consultations with date, time, subject, room and teachers. Pass from/to to look further ahead or back within this semester. Read-only.',
    input: {
      from: isoDate.optional().describe('First day, YYYY-MM-DD. Default: today.'),
      to: isoDate.optional().describe('Last day, YYYY-MM-DD. Default: 14 days from today.'),
    },
    run: async (a) => {
      const range = defaultRange();
      const from = typeof a.from === 'string' ? a.from : range.from;
      const to = typeof a.to === 'string' ? a.to : range.to;
      const lessons = await fetchFullSemesterSchedule();
      // null means IS failed, which must not read as "no classes".
      if (!Array.isArray(lessons))
        throw new Error('IS Mendelu did not return your timetable. Try again.');
      return scheduleRows(lessons, from, to);
    },
  },
  {
    name: 'mendelu_exams',
    title: 'My exams',
    description:
      'Your exam and credit (zkouška/zápočet) terms from IS Mendelu: the ones you are registered for and the ones still open, with date, room and capacity. Read-only: it never registers you.',
    // No lang option: the exam records already carry both names merged.
    input: {},
    run: () => fetchDualLanguageExams(),
  },
  {
    name: 'mendelu_subjects',
    title: 'My subjects',
    description:
      'The subjects you are enrolled in this semester: code, Czech and English name, IS subject id (use it for mendelu_syllabus), and whether it has ongoing assessment. Read-only.',
    input: {},
    run: async () =>
      Object.values(await subjectsData()).map((s) =>
        omit(s, ['folderUrl', 'autoHref', 'fetchedAt'])
      ),
  },
  {
    name: 'mendelu_study_plan',
    title: 'My study plan',
    description:
      'Your study plan: required subject groups per semester, credits earned and required, and which subjects you have completed. Read-only.',
    input: { lang },
    run: async (a) =>
      compactStudyPlan(pickLang(await fetchDualLanguageStudyPlan((await study()).studium), a.lang)),
  },
  {
    name: 'mendelu_syllabus',
    title: 'Subject syllabus',
    description:
      'The syllabus of one subject: requirements to pass, objectives, content and course info. Takes the numeric IS subject id (subjectId from mendelu_subjects), not the code. Read-only.',
    input: {
      predmet: z.string().regex(/^\d+$/).describe('Numeric IS subject id, e.g. "164074".'),
      lang,
    },
    run: async (a) => {
      const syllabus = await fetchSyllabus(String(a.predmet), a.lang === 'en' ? 'en' : 'cz');
      // The fetcher degrades to a placeholder for the app; here a failure is an error.
      if (syllabus.requirementsText === SYLLABUS_FETCH_FAILED) {
        throw new Error(
          'IS Mendelu did not return this syllabus. Check the subject id or try again.'
        );
      }
      return syllabus;
    },
  },
  {
    name: 'mendelu_subject_files',
    title: 'Subject files',
    description:
      "Lists the files in one enrolled subject's IS document folder (slides, materials): name, author, date and a downloadUrl to pass to mendelu_read_file. Read-only.",
    input: { code: z.string().min(2).describe('Subject code, e.g. "EBC-PS".') },
    run: async (a) => {
      const folderUrl = (await subjectsData())[String(a.code)]?.folderUrl;
      if (typeof folderUrl !== 'string') {
        throw new Error(`${String(a.code)} is not enrolled this semester, or has no file folder.`);
      }
      return listFolderFiles(folderUrl);
    },
  },
  {
    name: 'mendelu_read_file',
    title: 'Read a subject file',
    description: DOCUMENT_DESCRIPTION,
    input: { url: z.string().url().describe('A downloadUrl from mendelu_subject_files.') },
    run: (a, ctx) => readDokServerFile(String(a.url), ctx.fetch),
  },
  {
    name: 'mendelu_success_rates',
    title: 'Subject pass rates',
    description:
      'Historical pass and fail counts per semester for subject codes, from reIS public statistics (not your personal data). Read-only.',
    input: {
      codes: z.array(z.string().min(2)).min(1).max(50).describe('Subject codes, e.g. ["EBC-PS"].'),
    },
    run: (a) => fetchSubjectSuccessRates(a.codes as string[]),
  },
  {
    name: 'mendelu_grades',
    title: 'My grades',
    description:
      'Your grades and credits across all semesters so far (Průchod studiem): subject, grade, credits, attempt and date. Read-only.',
    input: {},
    run: async () => {
      const { studium, obdobi } = await study();
      const grades = await fetchGradeHistory(studium, obdobi);
      if (!grades) throw new Error('IS Mendelu did not return your grades. Try again.');
      return grades;
    },
  },
  {
    name: 'mendelu_assignments',
    title: 'My assignment deadlines',
    description:
      'Your submission boxes (Odevzdávárny): subject, assignment, deadline, whether it is still open, files uploaded, points, and the teacher `instructions` (IS "Pokyny": what to hand in and how) when the box has any. Pass the instructions on when the student asks what to submit. IS takes a submission in two steps, upload then confirm, so each box has a `submission` field: only "handed_in" (section "submitted") means it is handed in. "uploaded_not_confirmed" is an open box with files that is NOT confirmed in IS: tell the student to confirm it in IS, never that it is handed in. Read-only: it never submits or confirms anything.',
    input: {},
    run: async () => {
      const { studium, obdobi } = await study();
      const res = await fetchOdevzdavarny(studium, obdobi);
      if (!res) return null;
      return {
        ...res,
        assignments: res.assignments.map((r) => ({
          ...omit(r, ['uploadUrl', 'odevzdavarnaId']),
          ...submissionOf(r),
        })),
      };
    },
  },
];
