import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { SportIcon } from './SportIcon';
import { SPORT_PLACES } from './sportPlaces';

/**
 * "Sport" under the map's search: turns the Sportera pins on and fits the map
 * to them (they all sit outside the campus frame the map opens on), or off
 * again with its ×.
 *
 * `floating` matches the phone's search bar, which is drawn dark over the
 * basemap in both themes; the desktop map's chrome uses the theme's surface.
 */
export function SportChip({ floating = false }: { floating?: boolean }) {
  const { t } = useTranslation();
  const on = useAppStore((s) => s.sportPlacesOn);
  const show = useAppStore((s) => s.showSportPlaces);
  const hide = useAppStore((s) => s.hideSportPlaces);
  const surface = floating
    ? 'backdrop-blur-md'
    : 'border border-base-300 bg-base-100 text-base-content shadow';
  const style = floating
    ? {
        background: 'rgba(31,41,55,.94)',
        border: '1px solid rgba(243,244,246,.1)',
        color: '#f3f4f6',
      }
    : undefined;

  return (
    <div
      data-testid="sport-chip"
      className={`inline-flex h-9 items-center rounded-full text-sm font-semibold ${surface}`}
      style={style}
    >
      <button
        type="button"
        onClick={show}
        aria-label={t('map.sport.chipAria')}
        aria-pressed={on}
        className={`flex h-full items-center gap-1.5 rounded-full pl-3 ${on ? 'pr-1' : 'pr-3.5'}`}
      >
        <span
          style={{ color: floating ? '#5DCAA5' : undefined }}
          className={floating ? '' : 'text-success'}
        >
          <SportIcon sport="basketball" size={16} />
        </span>
        {on ? `${t('map.sport.chip')} · ${SPORT_PLACES.length}` : t('map.sport.chip')}
      </button>
      {on && (
        <button
          type="button"
          onClick={hide}
          aria-label={t('map.sport.hideAria')}
          className="flex h-full items-center rounded-full pl-1 pr-2.5 opacity-70 hover:opacity-100"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
