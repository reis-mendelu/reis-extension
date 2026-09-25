import { PanelRightOpen } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

/** What the tablet map rail leaves behind when it is closed (see MapRail). */
export function MapRailOpenButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('mobile.map.railOpen')}
      aria-expanded={false}
      // The one thing left behind when the rail is away: a pill at the edge
      // it went into, so the way back is where it left from.
      className="absolute right-4 top-[calc(5rem_+_var(--safe-top,0px))] z-[1000] flex h-11 w-11 items-center justify-center rounded-2xl border border-base-content/10 bg-base-100 shadow-drawer"
    >
      <PanelRightOpen size={18} className="text-base-content/70" />
    </button>
  );
}
