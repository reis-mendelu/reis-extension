import { Star } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { extensionReviewUrl } from '../../../utils/extensionReviewUrl';

/**
 * "Ohodnotit reIS" in the profile popup's support block: a link to the store's
 * review page, styled like the "Nahlásit chybu" row above it and no louder.
 * Never shown unasked; the phone gets the OS dialog instead (see
 * src/test/guards/storeRatingByTree.test.ts for why the trees differ).
 */
export function RateReisLink() {
  const { t } = useTranslation();
  return (
    <a
      href={extensionReviewUrl(window.location.protocol)}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full flex items-center gap-3 px-1 py-1.5 hover:bg-base-200 rounded-lg transition-colors"
    >
      <Star size={16} className="text-base-content/50" />
      <span className="text-xs font-medium opacity-70">{t('settings.rateReis')}</span>
    </a>
  );
}
