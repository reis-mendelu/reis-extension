import { useAppStore } from '../../../store/useAppStore';
import { SubjectDrawerSheet } from './SubjectDrawerSheet';
import { EventDetailSheet } from './EventDetailSheet';
import { StudyPlanSheet } from './StudyPlanSheet';
import { NotificationsSheet } from './NotificationsSheet';

/**
 * Renders the phone UI's sheet stack, in order, each in its own `Sheet`.
 * Mounted once in `MobileApp`, after `<BottomNav />` — every future sheet
 * kind registers here via the `switch` below rather than mounting itself.
 *
 * Unknown/unimplemented `kind`s render nothing rather than throwing: the
 * `MobileSheet` union still lists a few kinds (profile, person, eduroam,
 * docs, erasmus, confirm) that later tasks will add renderers for.
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
                    default:
                        return null;
                }
            })}
        </>
    );
}
