import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { GardenPlace } from '../../types/campusMap';

/** Where the full photos live. `@main` is cached mutably by jsDelivr, which is
 *  why `photo` carries a content hash instead of a bare name. */
const PHOTO_CDN = 'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/garden';

export interface GardenPlaceCardProps {
  place: GardenPlace;
  /** The rail and sheet frame their own content, so the card renders flush. */
  flush?: boolean;
}

/**
 * One of the botanical garden's places, opened.
 *
 * The photo is two images stacked: the bundled 96px thumb, blurred and scaled,
 * paints immediately with no network — then the full one fades in over it. A
 * student standing in the garden on one bar of signal sees the place either
 * way, and never a grey box or a bare spinner. There is no fetch and no cache
 * here on purpose: an <img> is what the browser already caches well.
 */
export function GardenPlaceCard({ place, flush = false }: GardenPlaceCardProps) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.language);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={flush ? 'space-y-2' : 'space-y-2 rounded-lg border border-base-300 bg-base-100 p-4'}>
      <div className="relative aspect-[5/3] w-full overflow-hidden rounded-box bg-base-200">
        <img
          src={`/garden/${place.id}.webp`}
          alt=""
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-sm transition-opacity duration-300 ${
            loaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {place.photo && (
          <img
            src={`${PHOTO_CDN}/${place.photo}`}
            alt={place.name[lang]}
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>

      <h3 className="font-bold text-base-content">{place.name[lang]}</h3>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="badge badge-sm badge-primary">
          {t(`map.gardenSection${place.section}`)}
        </span>
        <span className="badge badge-sm badge-ghost">{place.number}</span>
      </div>

      <p className="text-sm text-base-content/70">{place.why[lang]}</p>

      <p className="border-t border-base-300 pt-2 text-xs text-base-content/70">
        {t('map.gardenHours')}
      </p>

      {place.credit && <p className="text-[11px] text-base-content/70">{place.credit}</p>}
    </div>
  );
}
