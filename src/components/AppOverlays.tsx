import { WelcomeModal } from './Onboarding/WelcomeModal';
import { SubjectFileDrawer } from './SubjectFileDrawer';
import { FeedbackModal } from './Feedback/FeedbackModal';
import { EduroamDrawer } from './Eduroam/EduroamDrawer';
import { SuggestionsToast } from './AdminConsole/SuggestionsToast';
import { DocumentsDrawer } from './StudyDocuments/DocumentsDrawer';
import type { SelectedSubject } from '../types/app';
interface AppOverlaysProps {
  selectedSubject: SelectedSubject | null;
  setSelectedSubject: (subject: SelectedSubject | null) => void;
  isFeedbackOpen: boolean;
  setIsFeedbackOpen: (open: boolean) => void;
}

export function AppOverlays({
  selectedSubject,
  setSelectedSubject,
  isFeedbackOpen,
  setIsFeedbackOpen,
}: AppOverlaysProps) {
  return (
    <>
      <SubjectFileDrawer
        lesson={selectedSubject}
        isOpen={!!selectedSubject}
        onClose={() => setSelectedSubject(null)}
      />
      <WelcomeModal />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      <EduroamDrawer />
      <SuggestionsToast />
      <DocumentsDrawer />
    </>
  );
}
