import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../../../hooks/useTranslation';

interface BalanceSectionProps {
  balance: string;
  lastSyncTime: string;
  onTopUp?: () => void;
  onRefresh?: () => void;
}

export function BalanceSection({ balance, lastSyncTime, onTopUp, onRefresh }: BalanceSectionProps) {
  const { t } = useTranslation();
  const [showSyncInfo, setShowSyncInfo] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 mt-2 -mx-0.5 overflow-visible">
      {/* Balance Info */}
      <div className="flex items-baseline gap-2 flex-1 min-w-0">
        <span className="text-xs font-semibold opacity-50 shrink-0">ISIC:</span>
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-base font-bold text-base-content">
            {balance}
          </span>
          <span className="text-[10px] font-bold opacity-30 uppercase tracking-tight">Kč</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
         <div className="relative flex items-center">
            <button 
              onMouseEnter={() => setShowSyncInfo(true)}
              onMouseLeave={() => setShowSyncInfo(false)}
              onClick={(e) => {
                e.stopPropagation();
                onRefresh?.();
              }}
              className="p-1.5 hover:bg-base-200 rounded-lg text-base-content/50 hover:text-base-content/80 transition-all active:rotate-180 duration-500"
            >
              <RefreshCw size={15} />
            </button>
            
            <AnimatePresence>
              {showSyncInfo && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                  className="absolute bottom-full right-0 mb-3 whitespace-nowrap bg-base-200 border border-base-300 px-3 py-2 rounded-xl shadow-2xl z-[100] text-xs font-semibold text-base-content/80"
                >
                  {t('sync.lastSync').toString().replace('{time}', lastSyncTime)}
                </motion.div>
              )}
            </AnimatePresence>
         </div>

        <button
          onClick={(e) => {
              e.stopPropagation();
              onTopUp?.();
          }}
          className="btn btn-primary btn-sm h-8 min-h-0 px-4 rounded-xl font-bold border-none transition-all active:scale-95 shadow-md text-xs"
        >
          {t('settings.topUp')}
        </button>
      </div>
    </div>
  );
}
