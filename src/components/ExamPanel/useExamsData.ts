import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSubject, ExamSection } from '../../types/exams';
import { isGroupSignupSection } from '../../utils/exams/isGroupSignup';

export function useExamsData() {
  const exams = useAppStore((s) => s.exams.data);
  const status = useAppStore((s) => s.exams.status);
  const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore((s) => s.syncStatus.isSyncing);
  const firstSyncSettled = useAppStore((s) => s.firstSyncSettled);
  const examsAnswered = useAppStore((s) => !!s.syncLoaded.exams);
  const refreshing = useAppStore((s) => s.examsRefreshing);

  const sections = useMemo(() => {
    const res: { subject: ExamSubject; section: ExamSection }[] = [];
    exams.forEach((sub: ExamSubject) => {
      sub.sections.forEach((sec: ExamSection) => {
        // Seminar-group signup rides in on the same IS table as exam
        // terms but is not an exam — see utils/exams/isGroupSignup.
        if (isGroupSignupSection(sec)) return;
        if (sec.status !== 'registered') res.push({ subject: sub, section: sec });
      });
    });
    return res;
  }, [exams]);

  // A sync only means "still loading" while exams have no answer yet — the
  // phone's ExamsScreen rule. A bare isSyncing flashed a skeleton over a list
  // IS had already said was empty, on every background sync.
  const waiting =
    exams.length === 0 &&
    (status === 'loading' ||
      status === 'idle' ||
      (!handshakeDone && !handshakeTimedOut) ||
      (isSyncing && !examsAnswered));

  // The phone's ExamsScreen rule: a settled sync that never got an answer about
  // exams, with nothing cached, failed — it did not find "none" (Návrhy #26).
  const unanswered = !waiting && exams.length === 0 && firstSyncSettled && !examsAnswered;
  // The retry is the targeted exams refresh; while it runs, the failure gives
  // way to the loading state. Only then: a routine refresh over a list known
  // to be empty must not flash a skeleton.
  const showSkeleton = waiting || (unanswered && refreshing);
  const showFailed = unanswered && !refreshing;

  return { exams, showSkeleton, showFailed, sections };
}
