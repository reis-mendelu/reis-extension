import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { GardenPlace } from '../../types/campusMap';

export interface GardenPlaceCardProps {
  place: GardenPlace;
  /** The rail and sheet frame their own content, so the card renders flush. */
  flush?: boolean;
}

/**
 * One of the garden's places, opened. **The photograph, and nothing else.**
 *
 * No name, no section, no opening hours: the point of a bubble is that you
 * recognise a place by seeing it, and a caption under the picture is the part
 * nobody reads. The name still exists as the marker's tooltip on the map and as
 * this image's alt text, so the hover and the screen reader both have it.
 *
 * Three sizes, one idea: the bubble is the photo at 28px, this card is the
 * photo at card width, and tapping it is the photo at full screen. Both files
 * are bundled (`public/garden/`) — the 96px thumb paints instantly, blurred,
 * and the 1100px one fades in over it, so a student standing in the garden on
 * one bar of signal never sees a grey box.
 */
export function GardenPlaceCard({ place, flush = false }: GardenPlaceCardProps) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.language);
  const [loaded, setLoaded] = useState(false);
  const [maximized, setMaximized] = useState(false);

  // Escape closes the full-screen photo, the way every image viewer does.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaximized(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximized]);

  if (!place.photo) return null;
  const name = place.name[lang];

  return (
    <div className={flush ? '' : 'overflow-hidden rounded-lg border border-base-300'}>
      {/* A real button, so it is reachable by Tab and announced as something
          you can press — the photo is the only control this card has. */}
      <button
        type="button"
        onClick={() => setMaximized(true)}
        aria-label={name}
        className="relative block aspect-[3/2] w-full cursor-zoom-in overflow-hidden rounded-box bg-base-200"
      >
        <img
          src={`/garden/${place.id}.jpg`}
          alt=""
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-md transition-opacity duration-300 ${
            loaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <img
          src={`/garden/${place.photo}`}
          alt={name}
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </button>

      {/* Attribution is a licence obligation, not a caption — it renders only
          when a photo came from someone else. */}
      {place.credit && <p className="px-1 pt-1 text-[11px] text-base-content/70">{place.credit}</p>}

      {/* Portalled to <body>: the map screen sets `isolate`, which contains
          Leaflet's z-indexes — and would contain this one too, leaving the
          sidebar and header painted over a "full screen" photo. Verified in the
          browser; the overlay measured full-viewport and still sat under the
          shell. */}
      {maximized &&
        createPortal(
          <div className="fixed inset-0 z-[2000] bg-black/90">
            <button
              type="button"
              onClick={() => setMaximized(false)}
              aria-label={t('common.close')}
              className="absolute inset-0 flex cursor-zoom-out items-center justify-center p-[max(1rem,var(--safe-top))]"
            >
              <img
                src={`/garden/${place.photo}`}
                alt={name}
                className="max-h-full max-w-full object-contain"
              />
            </button>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-[calc(0.75rem_+_var(--safe-top,0px))] rounded-full bg-black/50 p-2 text-white"
            >
              <X size={20} />
            </span>
          </div>,
          document.body
        )}
    </div>
  );
}
