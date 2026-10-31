import type { ExamSubject } from '../types/exams';
import type { SubjectsData } from '../types/documents';
import type { SubjectZaznamnik } from '../types/zaznamnik';
import type { Odevzdavarna, OdevzdavarnyResult } from '../api/odevzdavarny';
import type { NewExamTerm } from '../utils/newExamTerms';
import type { NewPointsBySubject } from '../services/sync/zaznamnikNewPoints';
import type { ZaznamnikSyncInput } from '../services/sync/syncZaznamnik';
import { boxCourseCode } from '../utils/submissionBoxes';
import {
  composeBackgroundNotifications,
  type BackgroundNotification,
} from '../utils/backgroundNotifications';

/** Everything the check touches outside itself, so the order of steps is testable. */
export interface BackgroundDeps {
  hasSession(): Promise<boolean>;
  params(): Promise<{ studium?: string; obdobi?: string } | null>;
  language(): Promise<string>;
  /** Runs `job` unless a sync already holds the lock; resolves false then. */
  withSyncLock(job: () => Promise<void>): Promise<boolean>;
  fetchSubjects(studium: string, obdobi: string): Promise<SubjectsData | null>;
  fetchExams(): Promise<ExamSubject[]>;
  persistExamTerms(exams: ExamSubject[]): Promise<NewExamTerm[]>;
  syncBoxes(studium: string, obdobi: string): Promise<OdevzdavarnyResult | null>;
  persistBoxes(
    boxes: Odevzdavarna[],
    obdobi: string
  ): Promise<{ found: string[]; unseen: string[] }>;
  boxKey(box: Odevzdavarna): string;
  syncZaznamnik(
    studium: string,
    obdobi: string,
    inputs: ZaznamnikSyncInput[]
  ): Promise<Record<string, SubjectZaznamnik | null>>;
  persistZaznamnik(
    batch: Record<string, SubjectZaznamnik | null>
  ): Promise<{ found: NewPointsBySubject }>;
  notify(list: BackgroundNotification[]): void;
  logError(context: string, err: unknown): void;
}

export type BackgroundStatus = 'signed-out' | 'no-params' | 'busy' | 'done';

/**
 * One background look at IS: the three things only IS knows (a new exam term, a
 * new submission box, new záznamník points), compared with what this device has
 * already seen, and one notification per kind for what is new.
 *
 * Each step stands alone: IS answering for one and not another must not cost the
 * rest. The same persist functions as the foreground app run here, so whichever
 * of the two sees an item first marks it seen for the other, and it is announced
 * once. Nothing here leaves the device except the requests to IS.
 */
export async function runBackgroundCheck(d: BackgroundDeps): Promise<BackgroundStatus> {
  if (!(await d.hasSession())) return 'signed-out';
  const p = await d.params();
  if (!p?.studium || !p.obdobi) return 'no-params';
  const { studium, obdobi } = p;

  const terms: NewExamTerm[] = [];
  const newBoxes: Odevzdavarna[] = [];
  let points: NewPointsBySubject = {};
  let subjects: SubjectsData['data'] = {};

  const ran = await d.withSyncLock(async () => {
    try {
      subjects = (await d.fetchSubjects(studium, obdobi))?.data ?? {};
    } catch (err) {
      d.logError('Background.subjects', err);
    }
    try {
      terms.push(...(await d.persistExamTerms(await d.fetchExams())));
    } catch (err) {
      d.logError('Background.exams', err);
    }
    try {
      const result = await d.syncBoxes(studium, obdobi);
      if (result) {
        const { found } = await d.persistBoxes(result.assignments, obdobi);
        const wanted = new Set(found);
        newBoxes.push(...result.assignments.filter((b) => wanted.has(d.boxKey(b))));
      }
    } catch (err) {
      d.logError('Background.boxes', err);
    }
    try {
      const inputs = Object.entries(subjects).map(([courseCode, s]) => ({
        courseCode,
        subjectId: s.subjectId ?? '',
        hasPrubezne: s.hasPrubezne,
        hasTest: s.hasTest,
      }));
      points = (await d.persistZaznamnik(await d.syncZaznamnik(studium, obdobi, inputs))).found;
    } catch (err) {
      d.logError('Background.zaznamnik', err);
    }
  });
  if (!ran) return 'busy';

  const language = await d.language();
  const boxCourseNames = new Map(newBoxes.map((b) => [b.courseId, b.courseNameCs]));
  const nameOf = (code: string) => {
    const s = subjects[code];
    return (
      (language === 'en' ? s?.nameEn : s?.nameCs) ||
      s?.displayName ||
      boxCourseNames.get(code) ||
      code
    );
  };
  const list = composeBackgroundNotifications(
    {
      terms,
      boxes: newBoxes.map((b) => ({
        courseCode: boxCourseCode(b, subjects) ?? b.courseId,
        name: b.name,
      })),
      points,
    },
    language,
    nameOf
  );
  if (list.length > 0) d.notify(list);
  return 'done';
}
