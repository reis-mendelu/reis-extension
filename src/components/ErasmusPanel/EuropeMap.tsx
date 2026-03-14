import { useMemo } from 'react';
import { EUROPE_PATHS, EUROPE_VIEWBOX } from '@/constants/europePaths';
import { ERASMUS_COUNTRIES } from '@/constants/erasmusCountries';
import { ERASMUS_COUNTRY_STATS } from '@/constants/erasmusCountryStats';

interface EuropeMapProps {
  selectedCountryId: string;
  onSelectCountry: (id: string) => void;
  lang: 'cs' | 'en';
}

function satisfactionColor(rating: number): string {
  // Map 3.0–5.0 → light to dark green
  const t = Math.max(0, Math.min(1, (rating - 3.0) / 2.0));
  const lightness = 75 - t * 35; // 75% (light) → 40% (dark)
  return `oklch(${lightness}% 0.15 145)`;
}

function getTooltip(id: string, lang: 'cs' | 'en'): string {
  const country = ERASMUS_COUNTRIES.find(c => c.id === id);
  const stats = ERASMUS_COUNTRY_STATS[id];
  if (!country || !stats) return '';
  const name = country[lang];
  return `${name} — ${stats.count} ${lang === 'cs' ? 'zpráv' : 'reports'}, ★ ${stats.avgRating}`;
}

export function EuropeMap({ selectedCountryId, onSelectCountry, lang }: EuropeMapProps) {
  const erasmusIds = useMemo(() => new Set(ERASMUS_COUNTRIES.map(c => c.id)), []);

  return (
    <svg
      viewBox={EUROPE_VIEWBOX}
      className="w-3/5 mx-auto"
      role="img"
      aria-label="Europe map"
    >
      {EUROPE_PATHS.map(({ id, d }) => {
        const isBackground = id.startsWith('BG_');
        const isErasmus = erasmusIds.has(id);
        const stats = ERASMUS_COUNTRY_STATS[id];
        const isSelected = id === selectedCountryId;

        if (isBackground) {
          return (
            <path
              key={id}
              d={d}
              fill="oklch(var(--b3))"
              stroke="oklch(var(--b1))"
              strokeWidth={0.5}
              fillRule="evenodd"
            />
          );
        }

        const fill = isErasmus && stats?.avgRating
          ? satisfactionColor(stats.avgRating)
          : 'oklch(var(--b3))';

        return (
          <path
            key={id}
            d={d}
            fill={fill}
            stroke={isSelected ? 'oklch(var(--p))' : 'oklch(var(--b1))'}
            strokeWidth={isSelected ? 2.5 : 0.5}
            fillRule="evenodd"
            className={isErasmus ? 'cursor-pointer hover:brightness-110' : ''}
            onClick={isErasmus ? () => onSelectCountry(id) : undefined}
          >
            {isErasmus && <title>{getTooltip(id, lang)}</title>}
          </path>
        );
      })}
    </svg>
  );
}
