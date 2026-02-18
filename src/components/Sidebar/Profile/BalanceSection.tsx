import { CreditCard } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

interface BalanceSectionProps {
  onTopUp?: () => void;
  isTopUpOpen?: boolean;
}

export function BalanceSection({ onTopUp, isTopUpOpen }: BalanceSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 text-base-content/60">
      <CreditCard size={16} className="text-base-content/30" />
      <span className="opacity-70">{t('settings.isicBalance')}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onTopUp?.(); }}
        className="font-mono text-xs bg-success/20 text-success px-2.5 py-1 rounded-lg border border-success/30 ml-auto hover:bg-success/30 transition-colors"
      >
        {isTopUpOpen
          ? <span className="loading loading-spinner loading-xs" />
          : `${t('settings.topUp')} →`}
      </button>
    </div>
  );
}
