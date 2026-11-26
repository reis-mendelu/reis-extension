import { useTranslation } from '../../hooks/useTranslation';

/**
 * A term's action slot in the seconds after its registration opens, before IS
 * has shown the register link: neutral, so it is neither blank nor "UZAVŘENO",
 * and nothing in it can register.
 */
export function OpeningNow({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1.5 text-warning">
      <span className={`loading loading-spinner ${compact ? 'loading-xs' : 'loading-sm'}`} />
      <span
        className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase tracking-wider whitespace-nowrap`}
      >
        {t('exams.opening')}
      </span>
    </span>
  );
}
