import { LifeBuoy } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { openExternal } from '../../../../mobile/openExternal';
import { logError } from '../../../../utils/reportError';
import { currentSchool } from '../../../../utils/school';
import { guideUrl } from '../../../../utils/guideUrl';
import { NavRow } from '../../primitives/NavRow';

/**
 * Nápověda: the reisapp.cz guides, from Profil. Directly above "Nahlásit
 * chybu" — read how it works before reporting that it does not. One line, no
 * second label: at 375×667 Profil must not scroll, and this row is paid for out
 * of the slack measured there (2026-11-16, with the ISIC row: 43px to spare
 * after it). A society admin's Správa row now tips that 4px over.
 * The extension's twin is Sidebar/Profile/HelpLink.tsx.
 */
export function HelpRow() {
  const { t, language } = useTranslation();
  if (!currentSchool.has('guides')) return null;
  return (
    <NavRow
      icon={LifeBuoy}
      label={t('guides.help')}
      onClick={() =>
        void openExternal(guideUrl('index', language)).catch((e) =>
          logError('HelpRow.openGuides', e)
        )
      }
    />
  );
}
