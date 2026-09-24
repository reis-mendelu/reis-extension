import { WelcomeModal } from './Onboarding/WelcomeModal';
import { SubjectFileDrawer } from './SubjectFileDrawer';
import { FeedbackModalHost } from './Feedback/FeedbackModalHost';
import { EduroamDrawer } from './Eduroam/EduroamDrawer';
import { SuggestionsToast } from './AdminConsole/SuggestionsToast';
import { DocumentsDrawer } from './StudyDocuments/DocumentsDrawer';
import type { SelectedSubject } from '../types/app';
interface AppOverlaysProps {
  selectedSubject: SelectedSubject | null;
  setSelectedSubject: (subject: SelectedSubject | null) => void;
}

export function AppOverlays({ selectedSubject, setSelectedSubject }: AppOverlaysProps) {
  return (
    <>
      <SubjectFileDrawer
        lesson={selectedSubject}
        isOpen={!!selectedSubject}
        onClose={() => setSelectedSubject(null)}
      />
      <WelcomeModal />
      <FeedbackModalHost />
      <EduroamDrawer />
      <SuggestionsToast />
      <DocumentsDrawer />
    </>
  );
}
