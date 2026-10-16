import { useAppStore } from '../store/useAppStore';
import { IndexedDBService } from '../services/storage/IndexedDBService';
import type { ExamSubject } from '../types/exams';

/**
 * The app's half of a study switch, run on the first sync push for the study
 * the student switched to (useAppLogic). What that push does not carry is
 * the previous study's on screen and in the database — none of it keyed by
 * study — so it goes rather than stand under the new study's name: if the
 * new crawl then fails, Subjects and the plan show nothing, not the
 * programme the student left. Exams are replaced outright, "none" included,
 * because setExams otherwise keeps a list over an empty answer.
 *
 * Here and not in the switch itself: run there, it could erase the new
 * study's data if its first push had already landed.
 */
export async function forgetPreviousStudy(push: {
  exams?: unknown;
  subjects?: unknown;
  studyPlan?: unknown;
  studyStats?: unknown;
  studyComparison?: unknown;
  pastAttendance?: unknown;
}): Promise<void> {
  useAppStore.getState().setExams((push.exams as ExamSubject[] | undefined) ?? [], {
    replace: true,
  });
  const gone: Promise<void>[] = [];
  if (!push.subjects) {
    useAppStore.setState({ subjects: null });
    gone.push(IndexedDBService.delete('subjects', 'current'));
  }
  if (!push.studyPlan) {
    useAppStore.setState({ studyPlanDual: null });
    gone.push(IndexedDBService.delete('study_plan', 'current'));
  }
  if (!push.studyStats) {
    useAppStore.setState({ studyStats: null });
    gone.push(IndexedDBService.delete('meta', 'study_stats'));
  }
  if (!push.studyComparison) {
    useAppStore.setState({ studyComparison: null });
    gone.push(IndexedDBService.delete('meta', 'study_comparison'));
  }
  if (!push.pastAttendance) {
    useAppStore.getState().setPastAttendance({});
    gone.push(IndexedDBService.delete('meta', 'past_attendance_merged'));
  }
  await Promise.all(gone.map((p) => p.catch(() => {})));
}
