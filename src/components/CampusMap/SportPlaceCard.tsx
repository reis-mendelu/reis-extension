import { Clock, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { SportIcon } from './SportIcon';
import type { SportPlace } from '../../types/campusMap';

/** Czech counts: 1 koš, 2–4 koše, 5+ košů. English has only one and other. */
function countForm(n: number): 'One' | 'Few' | 'Many' {
  if (n === 1) return 'One';
  return n >= 2 && n <= 4 ? 'Few' : 'Many';
}

/**
 * A Sportera place, opened: its name, how far it is from campus, what is known
 * about it (hours, surface, hoops or tables) and its page on sportera.cz.
 * Nothing more — photos, ratings and finding people to play with live on
 * Sportera, and reIS sends the student there rather than copying them.
 */
export function SportPlaceCard({ place, flush = false }: { place: SportPlace; flush?: boolean }) {
  const { t } = useTranslation();
  const chips: { key: string; label: string; clock?: boolean }[] = [];
  if (place.hours)
    chips.push({
      key: 'hours',
      label: place.hours === 'nonstop' ? t('map.sport.nonstop') : place.hours,
      clock: true,
    });
  if (place.surface) chips.push({ key: 'surface', label: t(`map.sport.surface.${place.surface}`) });
  if (place.count !== null && (place.sport === 'basketball' || place.sport === 'pingpong')) {
    const unit = place.sport === 'basketball' ? 'hoops' : 'tables';
    chips.push({
      key: 'count',
      label: t(`map.sport.${unit}${countForm(place.count)}`, { count: place.count }),
    });
  }

  return (
    <div
      data-testid="sport-place-card"
      className={flush ? '' : 'overflow-hidden rounded-lg border border-base-300 bg-base-100'}
    >
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-base-200 text-base-content">
            <SportIcon sport={place.sport} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-bold leading-tight text-base-content">{place.name}</h3>
            <span className="block min-w-0 truncate text-xs text-base-content/70">
              {t('map.sport.near', { metres: place.near.metres, building: place.near.building })}
            </span>
          </div>
        </div>
        {chips.length > 0 && (
          <div data-testid="sport-place-chips" className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2.5 py-0.5 text-xs text-base-content"
              >
                {c.clock && <Clock size={12} aria-hidden="true" />}
                {c.label}
              </span>
            ))}
          </div>
        )}
        <a
          href={place.url}
          target="_blank"
          rel="noopener noreferrer"
          // As EventDetailCard: on Capacitor the capture-phase external link
          // handler opens target=_blank in the in-app browser.
          className="btn btn-primary btn-sm btn-block"
        >
          {t('map.sport.open')} <ExternalLink size={13} />
        </a>
        <p className="text-xs text-base-content/70">{t('map.sport.note')}</p>
      </div>
    </div>
  );
}
