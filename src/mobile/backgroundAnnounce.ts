import type { ExamSubject } from '../types/exams';
import type { Odevzdavarna } from '../api/odevzdavarny';
import type { SubjectsData } from '../types/documents';
import type { Language } from '../store/types';
import type { DualLanguageStudyPlan } from '../types/studyPlan';
import { IndexedDBService } from '../services/storage/IndexedDBService';
import { withKnownStateLock } from '../services/sync/knownStateLock';
import { NEW_POINTS_META_KEY, type NewPointsBySubject } from '../services/sync/zaznamnikNewPoints';
import { NEW_BOXES_META_KEY } from '../services/sync/newSubmissionBoxes';
import { NEW_TERMS_META_KEY } from '../services/sync/examTermsUnseen';
import { translate } from '../i18n/translate';
import { buildDeadlineAlerts, isAlertSeen } from '../utils/novinky/buildDeadlineAlerts';
import { pushRowsOf, pushText } from '../utils/novinky/pushText';
import { planRun } from '../utils/novinky/planRun';
import type { PushKind } from '../utils/novinky/pushPlan';
import { readRecord, saveRecord } from './novinkyRecord';

/** What BackgroundNotifier.java posts: one per kind, on its `reis-bg-<kind>` channel. */
export interface NativeNotification {
  kind: 'exams' | 'boxes' | 'points';
  title: string;
  body: string;
  courseCode: string | null;
}

const NATIVE_KIND: Partial<Record<PushKind, NativeNotification['kind']>> = {
  terms: 'exams',
  boxes: 'boxes',
  points: 'points',
};

const meta = async <T>(key: string, fallback: T): Promise<T> =>
  ((await IndexedDBService.get('meta', key)) as T | undefined) ?? fallback;

/**
 * The Android background check's announcement: the Novinky rows the app would
 * show, built by the same builders from this run's fresh exams and boxes plus
 * what IndexedDB holds (the unseen points, boxes and terms the persists just
 * wrote, the plan, the nicknames, what was seen), planned by the same planRun
 * against the same record as the foreground. So a row is announced once, in
 * Novinky's words, whichever side sees it first. Only the alert rows: society
 * events and IS notices come from Supabase and the IS home page, which this
 * run does not read, and their part of the record is left as it is.
 */
export async function announceNovinky(
  fresh: { exams: ExamSubject[]; boxes: Odevzdavarna[]; subjects: SubjectsData['data'] },
  language: Language,
  notify: (list: NativeNotification[]) => void,
  now = new Date()
): Promise<void> {
  const [plan, nicknames, newPoints, newBoxes, newTerms, seenIds] = await Promise.all([
    IndexedDBService.get('study_plan', 'current'),
    meta<Record<string, string>>('course_nicknames', {}),
    meta<NewPointsBySubject>(NEW_POINTS_META_KEY, {}),
    meta<string[]>(NEW_BOXES_META_KEY, []),
    meta<string[]>(NEW_TERMS_META_KEY, []),
    meta<string[]>('seen_deadline_alerts', []),
  ]);
  const alerts = buildDeadlineAlerts({
    exams: fresh.exams,
    odevzdavarny: fresh.boxes,
    subjects: fresh.subjects,
    nicknames,
    language,
    pulseNow: now,
    newPoints,
    newBoxes,
    newTerms,
    studyPlan: (plan as DualLanguageStudyPlan | undefined) ?? null,
  });
  const seenSet = new Set(seenIds);
  const seen = new Set(alerts.filter((a) => isAlertSeen(a, seenSet)).map((a) => a.id));
  const t = (key: string, p?: Record<string, string>) => translate(language, key, p);

  await withKnownStateLock(async () => {
    const before = await readRecord();
    const { toPost, full } = planRun({
      news: pushRowsOf(alerts, [], () => ''),
      events: [],
      notices: [],
      ready: { alerts: true, feed: false, notices: false },
      seen,
      before,
      notifySocieties: false,
    });
    const list = toPost.flatMap((g): NativeNotification[] => {
      const kind = NATIVE_KIND[g.kind];
      if (!kind) return [];
      const codes = [...new Set(g.rows.map((r) => r.courseCode).filter(Boolean))];
      return [{ kind, ...pushText(g, t), courseCode: codes.length === 1 ? codes[0]! : null }];
    });
    // Posted natively and at once (the native side posts nothing while
    // notifications are off, the same as the foreground's recording then).
    if (list.length > 0) notify(list);
    await saveRecord(full);
  });
}
