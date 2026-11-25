import { useState } from 'react';
import { toast } from 'sonner';
import { registerExam, unregisterExam } from '../../api/exams';
import { useAppStore } from '../../store/useAppStore';
import { updateExamOptimistically } from './actions/optimisticUpdates';
import type { ExamSubject, ExamSection, ExamTerm } from '../../types/exams';
import { logError } from '../../utils/reportError';
import { useTranslation } from '../../hooks/useTranslation';
import { reportToastOptions } from '../Feedback/reportPrefill';
import { maybeAskForStoreReview } from '../../mobile/storeReview';
import { isFirstAttemptRegistration } from '../../utils/exams/isFirstAttemptRegistration';
import { switchExamTerm } from './switchExamTerm';

interface PendingAction {
  type: 'register' | 'unregister';
  section: ExamSection;
  termId?: string;
}

export function useExamActions({
  exams,
  setExpandedSectionId,
}: {
  exams: ExamSubject[];
  setExpandedSectionId: (id: string | null) => void;
}) {
  const { t: tr } = useTranslation();
  // Every failure toast here offers "Nahlásit". The prefill is our own
  // title; the toast text may still show IS's own message.
  const report = () => reportToastOptions(tr, 'examActionFailed');
  const [procId, setProcId] = useState<string | null>(null),
    [pending, setPending] = useState<PendingAction | null>(null);
  const setExams = useAppStore((s) => s.setExams);

  const applyRegistered = (sec: ExamSection, tid: string) => {
    toast.success(tr('exams.actionRegistered'));
    const t = sec.terms.find((x: ExamTerm) => x.id === tid),
      updated = updateExamOptimistically(exams, sec.id, {
        status: 'registered',
        registeredTerm: t
          ? {
              id: t.id,
              date: t.date,
              time: t.time,
              room: t.room,
              teacher: t.teacher,
              teacherId: t.teacherId,
              deregistrationDeadline: t.deregistrationDeadline,
            }
          : undefined,
      });
    setExams(updated);
    setExpandedSectionId(null);
    useAppStore.getState().triggerExamsRefresh();
    // The store-rating moment: a zkouška, first attempts only, never a resit.
    // A no-op in the extension; the helper decides if the install is ready.
    const { gradeHistory, subjects } = useAppStore.getState();
    const subjectCode = exams.find((x) => x.sections.some((y) => y.id === sec.id))?.code ?? '';
    if (
      sec.type === 'exam' &&
      isFirstAttemptRegistration({
        attemptTypes: t?.attemptTypes,
        grades: gradeHistory?.grades ?? null,
        courseCode: subjectCode,
        predmetId: subjects?.data[subjectCode]?.subjectId,
      })
    )
      void maybeAskForStoreReview('exam_registered');
  };

  // IS swaps the term itself; see switchExamTerm for why the outcome is read
  // back from a fresh list.
  const handleSwitch = async (sec: ExamSection, tid: string, previousTermId: string) => {
    const out = await switchExamTerm(previousTermId, tid);
    if (out.kind === 'registered') return applyRegistered(sec, tid);
    const refresh = () => useAppStore.getState().triggerExamsRefresh();
    if (out.kind === 'refused') {
      toast.error(tr(`exams.actionSwitchRefused.${out.reason}`), report());
    } else {
      const key = { kept: 'Kept', lost: 'Lost', unknown: 'Unknown' }[out.seat];
      toast.error(tr(`exams.actionSwitchFailed${key}`), report());
    }
    // Always re-read: after a failed switch the list on screen may show a term
    // the student no longer holds.
    refresh();
  };

  const handleRegister = async (sec: ExamSection, tid: string) => {
    setProcId(sec.id);
    setPending(null);
    try {
      const previousTermId = sec.status === 'registered' ? sec.registeredTerm?.id : undefined;
      if (previousTermId) return await handleSwitch(sec, tid, previousTermId);
      const res = await registerExam(tid);
      if (res.success) applyRegistered(sec, tid);
      else toast.error(res.error || tr('exams.actionFailed'), report());
    } catch (e) {
      logError('useExamActions.handleRegister', e);
      toast.error(tr('exams.actionGenericError'), report());
      useAppStore.getState().triggerExamsRefresh();
    } finally {
      setProcId(null);
    }
  };

  const handleUnregister = async (sec: ExamSection) => {
    if (!sec.registeredTerm?.id) return toast.error(tr('exams.actionMissingId'), report());
    setProcId(sec.id);
    setPending(null);
    try {
      const res = await unregisterExam(sec.registeredTerm.id);
      if (res.success) {
        toast.success(tr('exams.actionUnregistered'));
        const updated = updateExamOptimistically(exams, sec.id, {
          status: 'available',
          registeredTerm: undefined,
        });
        setExams(updated);
        useAppStore.getState().triggerExamsRefresh();
      } else toast.error(res.error || tr('exams.actionFailed'), report());
    } catch (e) {
      logError('useExamActions.handleUnregister', e);
      toast.error(tr('exams.actionGenericError'), report());
    } finally {
      setProcId(null);
    }
  };

  return {
    processingSectionId: procId,
    pendingAction: pending,
    setPendingAction: setPending,
    handleRegisterRequest: (s: ExamSection, t: string) =>
      setPending({ type: 'register', section: s, termId: t }),
    handleUnregisterRequest: (s: ExamSection) => setPending({ type: 'unregister', section: s }),
    handleConfirmAction: () => {
      if (!pending) return;
      if (pending.type === 'register' && pending.termId)
        handleRegister(pending.section, pending.termId);
      else if (pending.type === 'unregister') handleUnregister(pending.section);
    },
    handleRegisterDirect: handleRegister,
  };
}
