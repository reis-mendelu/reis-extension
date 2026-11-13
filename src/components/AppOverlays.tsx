import { WelcomeModal } from './Onboarding/WelcomeModal';
import { SubjectFileDrawer } from './SubjectFileDrawer';
import { FeedbackModalHost } from './Feedback/FeedbackModalHost';
import { EduroamDrawer } from './Eduroam/EduroamDrawer';
import { SuggestionsToast } from './AdminConsole/SuggestionsToast';
import { DocumentsDrawer } from './StudyDocuments/DocumentsDrawer';
import { ImpersonationDrawer } from './Impersonation/ImpersonationDrawer';
import { ImpersonationBanner } from './Impersonation/ImpersonationBanner';
import type { SelectedSubject } from '../types/app';
import { IS_OTHER_SCHOOL } from '../utils/otherSchool';
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
      {/* MENDELU's welcome (eduroam set-up) means nothing to another school. */}
      {!IS_OTHER_SCHOOL && <WelcomeModal />}
      <FeedbackModalHost />
      {!IS_OTHER_SCHOOL && <EduroamDrawer />}
      {!IS_OTHER_SCHOOL && <SuggestionsToast />}
      {!IS_OTHER_SCHOOL && <DocumentsDrawer />}
      {/* reIS admins only. The phone tree mounts its own sheet and a banner row. */}
      {!IS_OTHER_SCHOOL && <ImpersonationDrawer />}
      {!IS_OTHER_SCHOOL && <ImpersonationBanner variant="floating" />}
    </>
  );
}
