import { LifeBuoy } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { guidesIndexUrl } from '../../../utils/guideUrl';

/**
 * "Nápověda" in the profile popup's support block, above "Nahlásit chybu":
 * the reisapp.cz guide index in a new tab, styled like the rows beside it.
 * The phone's twin is mobile/screens/profile/HelpRow.tsx.
 */
export function HelpLink() {
  const { t, language } = useTranslation();
  return (
    <a
      href={guidesIndexUrl(language)}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full flex items-center gap-3 px-1 py-1.5 hover:bg-base-200 rounded-lg transition-colors"
    >
      <LifeBuoy size={16} className="text-base-content/50" />
      <span className="text-xs font-medium opacity-70">{t('guides.help')}</span>
    </a>
  );
}
