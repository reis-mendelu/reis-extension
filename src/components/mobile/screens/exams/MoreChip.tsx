import { ChevronDown } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * The "Více ⌄" / "Méně ⌃" chip that opens a term's details.
 *
 * A labelled chip, not a bare chevron: on a phone the chevron did not say that
 * a tap gets you the form, the length and the registration deadline.
 *
 * Presentational, so both users can own the tap: in a term row the whole left
 * column is already a button and this sits inside it, while the registered
 * card wraps it in a button of its own.
 */
export function MoreChip({ open }: { open: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-base-200 px-2 py-0.5 text-2sm font-semibold text-base-content/70">
      {t(open ? 'mobile.exams.less' : 'mobile.exams.more')}
      <ChevronDown
        size={12}
        aria-hidden="true"
        className={`transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </span>
  );
}
