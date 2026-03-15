import { useMemo, useState, useCallback, useRef } from 'react';
import { EUROPE_PATHS, EUROPE_VIEWBOX } from '@/constants/europePaths';
import { ERASMUS_COUNTRIES } from '@/constants/erasmusCountries';
import { ERASMUS_COUNTRY_STATS } from '@/constants/erasmusCountryStats';
import { useTranslation } from '@/hooks/useTranslation';

interface EuropeMapProps {
  selectedCountryId: string;
  onSelectCountry: (id: string) => void;
  lang: 'cs' | 'en';
}

function priceLevelColor(pli: number | null): string {
  if (pli == null) return 'oklch(var(--b3))';
  const t = Math.max(0, Math.min(1, (pli - 40) / 120));
  const lightness = 85 - t * 30;
  const chroma = 0.04 + t * 0.08;
  return `oklch(${lightness}% ${chroma} 250)`;
}

function ratingStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

interface TooltipData {
  name: string;
  countryId: string;
  x: number;
  y: number;
}

export function EuropeMap({ selectedCountryId, onSelectCountry, lang }: EuropeMapProps) {
  const { t } = useTranslation();
  const erasmusIds = useMemo(() => new Set(ERASMUS_COUNTRIES.map(c => c.id)), []);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback((id: string, e: React.MouseEvent) => {
    const country = ERASMUS_COUNTRIES.find(c => c.id === id);
    if (!country || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({
      name: country[lang],
      countryId: id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, [lang]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!tooltip || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip(prev => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  }, [tooltip]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const stats = tooltip ? ERASMUS_COUNTRY_STATS[tooltip.countryId] : null;

  return (
    <div ref={containerRef} className="relative" onMouseMove={handleMouseMove}>
      <svg
        viewBox={EUROPE_VIEWBOX}
        className="w-3/5 mx-auto"
        role="img"
        aria-label="Europe map"
      >
        <style>{`
          .erasmus-country { transition: opacity 0.15s; }
          .erasmus-country:hover { opacity: 0.75; }
        `}</style>
        {EUROPE_PATHS.map(({ id, d }) => {
          const isBackground = id.startsWith('BG_');
          const isErasmus = erasmusIds.has(id);
          const pathStats = ERASMUS_COUNTRY_STATS[id];
          const isSelected = id === selectedCountryId;

          if (isBackground) {
            return (
              <path
                key={id}
                d={d}
                fill="none"
                stroke="oklch(var(--b1))"
                strokeWidth={0.3}
                fillRule="evenodd"
              />
            );
          }

          const fill = isErasmus && pathStats
            ? priceLevelColor(pathStats.priceLevelIndex)
            : 'oklch(var(--b3))';

          return (
            <path
              key={id}
              d={d}
              fill={fill}
              stroke={isSelected ? 'oklch(var(--p))' : 'oklch(var(--b1))'}
              strokeWidth={isSelected ? 2.5 : 0.5}
              fillRule="evenodd"
              className={isErasmus ? 'erasmus-country cursor-pointer' : ''}
              onClick={isErasmus ? () => onSelectCountry(id) : undefined}
              onMouseEnter={isErasmus ? (e) => handleMouseEnter(id, e) : undefined}
              onMouseLeave={isErasmus ? handleMouseLeave : undefined}
              aria-label={isErasmus ? ERASMUS_COUNTRIES.find(c => c.id === id)?.[lang] : undefined}
            />
          );
        })}
      </svg>

      {tooltip && stats && (
        <div
          className="absolute z-50 pointer-events-none bg-base-100 border border-base-300 rounded-lg shadow-lg px-3 py-2.5 w-52 text-xs"
          style={{
            left: Math.min(tooltip.x + 12, (containerRef.current?.offsetWidth ?? 300) - 220),
            top: tooltip.y - 8,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-bold text-sm mb-1.5">{tooltip.name}</div>

          <div className="flex items-center gap-1 text-warning mb-1">
            <span>{ratingStars(stats.avgRating)}</span>
            <span className="text-base-content/60 ml-1">{stats.avgRating}</span>
          </div>

          {stats.priceLevelIndex != null && (
            <div className="text-base-content/70">
              {t('erasmus.priceLevel')}: <span className="font-semibold text-base-content">{stats.priceLevelIndex}</span> <span className="text-base-content/50">EU=100</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
