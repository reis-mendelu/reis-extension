import { LifeBuoy } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { openExternal } from '../../../../mobile/openExternal';
import { logError } from '../../../../utils/reportError';
import { currentSchool } from '../../../../utils/school';
import { guidesIndexUrl } from '../../../../utils/guideUrl';
import { NavRow } from '../../primitives/NavRow';

/**
 * Nápověda: the reisapp.cz guides, from Profil. Directly above "Nahlásit
 * chybu" — read how it works before reporting that it does not. One line, no
 * second label: at 375×667 Profil's rows are budgeted to fit without scrolling,
 * and this row is paid for out of the slack measured there (2026-11-16, with
 * the ISIC row: 43px to spare after it). That budget is a preference, not a
 * guarantee — Profil scrolls, with a fade while more is below — and a society
 * admin's Správa row puts the last row 33px under the nav there (2026-11-27).
 * The extension's twin is Sidebar/Profile/HelpLink.tsx.
 */
export function HelpRow() {
  const { t, language } = useTranslation();
  if (!currentSchool.has('guides')) return null;
  return (
    <NavRow
      icon={LifeBuoy}
      label={t('guides.help')}
      external
      onClick={() =>
        void openExternal(guidesIndexUrl(language)).catch((e) => logError('HelpRow.openGuides', e))
      }
    />
  );
}
