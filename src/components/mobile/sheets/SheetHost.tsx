import { useAppStore } from '../../../store/useAppStore';
import { SubjectDrawerSheet } from './SubjectDrawerSheet';
import { EventDetailSheet } from './EventDetailSheet';
import { StudyPlanSheet } from './StudyPlanSheet';
import { NotificationsSheet } from './NotificationsSheet';
import { ProfileSheet } from './ProfileSheet';
import { PersonSheet } from './PersonSheet';
import { EduroamSheet } from './EduroamSheet';
import { DocsSheet } from './DocsSheet';
import { ErasmusSheet } from './ErasmusSheet';

/**
 * Renders the phone UI's sheet stack, in order, each in its own `Sheet`.
 * Mounted once in `MobileApp`, after `<BottomNav />` — every future sheet
 * kind registers here via the `switch` below rather than mounting itself.
 *
 * Unknown/unimplemented `kind`s render nothing rather than throwing: the
 * `MobileSheet` union still lists `confirm`, which self-mounts inside
 * `ExamsScreen` instead of going through this host.
 */
export function SheetHost() {
    const sheets = useAppStore((s) => s.mobileSheets);
    const popSheet = useAppStore((s) => s.popSheet);

    return (
        <>
            {sheets.map((sheet, index) => {
                switch (sheet.kind) {
                    case 'subjectDrawer':
                        return <SubjectDrawerSheet key={index} sheet={sheet} onClose={popSheet} />;
                    case 'eventDetail':
                        return <EventDetailSheet key={index} sheet={sheet} onClose={popSheet} />;
                    case 'studyPlan':
                        return <StudyPlanSheet key={index} onClose={popSheet} />;
                    case 'notifications':
                        return <NotificationsSheet key={index} onClose={popSheet} />;
                    case 'profile':
                        return <ProfileSheet key={index} onClose={popSheet} />;
                    case 'person':
                        return <PersonSheet key={index} sheet={sheet} onClose={popSheet} />;
                    case 'eduroam':
                        return <EduroamSheet key={index} onClose={popSheet} />;
                    case 'docs':
                        return <DocsSheet key={index} onClose={popSheet} />;
                    case 'erasmus':
                        return <ErasmusSheet key={index} onClose={popSheet} />;
                    default:
                        return null;
                }
            })}
        </>
    );
}
