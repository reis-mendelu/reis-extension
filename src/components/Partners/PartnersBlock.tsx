import { useTranslation } from '../../hooks/useTranslation';
import { useMatchingPartners } from '../../hooks/useMatchingPartners';
import { PartnerMark } from '../brand/PartnerMark';

/**
 * "Spolupracujeme s firmami" on both trees (spec 2026-10-09): the shared rule,
 * then the marks of the partners of THIS student's field. No partner for the
 * field, no block — an empty slot would read as ad space waiting for a buyer.
 * The phone mounts it in Profil (AboutSection), the extension in its settings
 * popup; `compact` is the popup's smaller type.
 */
export function PartnersBlock({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const partners = useMatchingPartners();
  if (partners.length === 0) return null;

  return (
    <div className={`flex flex-col items-center gap-1 text-center ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
        {t('about.partnersLabel')}
      </span>
      <p
        className={`max-w-[21rem] leading-snug text-base-content/60 md:max-w-[34rem] ${compact ? 'text-xs' : 'text-sm'}`}
      >
        {t('about.partnersBody')}
      </p>
      {/* Set to the cap height of the line above rather than shrunk into a
          footnote: it is a partner's name. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {partners.map((p) => (
          <PartnerMark key={p.id} partner={p} className={compact ? 'h-5' : 'h-7'} />
        ))}
      </div>
    </div>
  );
}
