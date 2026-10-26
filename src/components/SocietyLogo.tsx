import { useState } from 'react';
import type { Society } from '../types/events';
import { readableTextColor } from '../utils/readableTextColor';

interface SocietyLogoProps {
  society: Society;
  /** Size, shape and glyph text size, e.g. "h-11 w-11 rounded-full text-sm". */
  className: string;
  fit?: 'cover' | 'contain';
}

const FIT = { cover: 'object-cover', contain: 'object-contain' } as const;

/**
 * A society's logo, or its glyph on its colour when there is no logo or the
 * logo fails to load. Logos now come from Supabase Storage over the network, so
 * a failed load is ordinary; the tile keeps the slot the same size either way.
 */
export function SocietyLogo({ society, className, fit = 'cover' }: SocietyLogoProps) {
  // Keyed on the URL: a replaced logo gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(society.logo) && failedUrl !== society.logo;
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={
        showImage
          ? undefined
          : { backgroundColor: society.color, color: readableTextColor(society.color) }
      }
    >
      {showImage ? (
        <img
          src={society.logo}
          alt=""
          className={`h-full w-full ${FIT[fit]}`}
          onError={() => setFailedUrl(society.logo ?? null)}
        />
      ) : (
        // Four-letter glyphs (USAF, reIS) shrink so they fit the smallest tiles
        // (24px chip, 32px list row) instead of being clipped by overflow-hidden.
        <span
          className={`font-extrabold leading-none ${society.glyph.length > 3 ? 'text-[0.75em]' : ''}`}
        >
          {society.glyph}
        </span>
      )}
    </span>
  );
}
