import { useAppStore } from '../../store/useAppStore';
import { FeedbackModal } from './FeedbackModal';

/**
 * The one report form per tree. Keyed on `reportSeq` so every open mounts a
 * fresh form: the prefill is read as initial state, and a draft from an
 * earlier open never leaks into a report about something else.
 */
export function FeedbackModalHost() {
  const reportOpen = useAppStore((s) => s.reportOpen);
  const reportSeq = useAppStore((s) => s.reportSeq);
  const reportPrefill = useAppStore((s) => s.reportPrefill);
  const closeReport = useAppStore((s) => s.closeReport);
  return (
    <FeedbackModal
      key={reportSeq}
      isOpen={reportOpen}
      onClose={closeReport}
      initialTitle={reportPrefill?.title}
    />
  );
}
