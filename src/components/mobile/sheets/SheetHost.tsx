import { useAppStore } from '../../../store/useAppStore';
import { SubjectDrawerSheet } from './SubjectDrawerSheet';

/**
 * Renders the phone UI's sheet stack, in order, each in its own `Sheet`.
 * Mounted once in `MobileApp`, after `<BottomNav />` — every future sheet
 * kind registers here via the `switch` below rather than mounting itself.
 *
 * Unknown/unimplemented `kind`s render nothing rather than throwing: the
 * `MobileSheet` union already lists kinds later tasks (event detail, study
 * plan, profile, person, eduroam, docs, erasmus, notifications, confirm)
 * will add renderers for.
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
                    default:
                        return null;
                }
            })}
        </>
    );
}
