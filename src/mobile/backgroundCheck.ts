import type { ExamSubject } from '../types/exams';
import type { SubjectsData } from '../types/documents';
import type { SubjectZaznamnik } from '../types/zaznamnik';
import type { Odevzdavarna, OdevzdavarnyResult } from '../api/odevzdavarny';
import type { ZaznamnikSyncInput } from '../services/sync/syncZaznamnik';
import type { Language } from '../store/types';

/** Everything the check touches outside itself, so the order of steps is testable. */
export interface BackgroundDeps {
  hasSession(): Promise<boolean>;
  params(): Promise<{ studium?: string; obdobi?: string } | null>;
  language(): Promise<string>;
  /** Runs `job` unless a sync already holds the lock; resolves false then. */
  withSyncLock(job: () => Promise<void>): Promise<boolean>;
  fetchSubjects(studium: string, obdobi: string): Promise<SubjectsData | null>;
  fetchExams(): Promise<ExamSubject[]>;
  /** Remembers the terms and keeps the new ones for Novinky (services/sync/recordExamTerms). */
  recordTerms(exams: ExamSubject[]): Promise<void>;
  syncBoxes(studium: string, obdobi: string): Promise<OdevzdavarnyResult | null>;
  persistBoxes(boxes: Odevzdavarna[], obdobi: string): Promise<unknown>;
  syncZaznamnik(
    studium: string,
    obdobi: string,
    inputs: ZaznamnikSyncInput[]
  ): Promise<Record<string, SubjectZaznamnik | null>>;
  persistZaznamnik(batch: Record<string, SubjectZaznamnik | null>): Promise<unknown>;
  /** Posts what Novinky would show that is not announced yet (mobile/backgroundAnnounce). */
  announce(
    fresh: { exams: ExamSubject[]; boxes: Odevzdavarna[]; subjects: SubjectsData['data'] },
    language: Language
  ): Promise<void>;
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

  let exams: ExamSubject[] = [];
  let boxes: Odevzdavarna[] = [];
  let subjects: SubjectsData['data'] = {};

  const ran = await d.withSyncLock(async () => {
    try {
      subjects = (await d.fetchSubjects(studium, obdobi))?.data ?? {};
    } catch (err) {
      d.logError('Background.subjects', err);
    }
    try {
      exams = await d.fetchExams();
      // An empty read is no baseline here: a half-failed fetch looks the same,
      // and the next full one would announce every term. The app's own sync
      // records a genuinely empty list (services/sync/recordExamTerms).
      if (exams.length > 0) await d.recordTerms(exams);
    } catch (err) {
      d.logError('Background.exams', err);
    }
    try {
      const result = await d.syncBoxes(studium, obdobi);
      if (result) {
        await d.persistBoxes(result.assignments, obdobi);
        boxes = result.assignments;
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
      await d.persistZaznamnik(await d.syncZaznamnik(studium, obdobi, inputs));
    } catch (err) {
      d.logError('Background.zaznamnik', err);
    }
  });
  if (!ran) return 'busy';

  // After the persists have recorded the new items: a failed read of the
  // language must cost only the wording, never the notification.
  const language: Language = (await d.language().catch(() => 'cz')) === 'en' ? 'en' : 'cz';
  try {
    await d.announce({ exams, boxes, subjects }, language);
  } catch (err) {
    d.logError('Background.announce', err);
  }
  return 'done';
}
