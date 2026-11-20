import { Mail } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { REIS_CONTACT_EMAIL } from '../../../utils/reisContact';

/**
 * "Nahlásit chybu / napsat nám" in the profile popup, where the school has no
 * report form: a build for another school (VŠE) sends reIS nothing, so a bug
 * report is an e-mail the student writes and sends themselves. Styled like the
 * "Nahlásit chybu" row it stands in for.
 */
export function ContactLink() {
  const { t } = useTranslation();
  return (
    <a
      href={`mailto:${REIS_CONTACT_EMAIL}`}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full flex items-center gap-3 px-1 py-1.5 hover:bg-base-200 rounded-lg transition-colors"
    >
      <Mail size={16} className="text-base-content/50" />
      <span className="text-xs font-medium opacity-70">{t('settings.contactUs')}</span>
    </a>
  );
}
