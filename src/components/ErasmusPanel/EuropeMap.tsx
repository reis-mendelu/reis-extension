import { useMemo, useState, useCallback, useRef } from 'react';
import { EUROPE_PATHS } from '@/constants/europePaths';
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

const BASE = [120, 0, 680, 519]; // Stage 3: Clipped left part (Atlantic)
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export function EuropeMap({ selectedCountryId, onSelectCountry, lang }: EuropeMapProps) {
  const { t } = useTranslation();
  const erasmusIds = useMemo(() => new Set(ERASMUS_COUNTRIES.map(c => c.id)), []);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom/pan state: viewBox origin + size
  const [vb, setVb] = useState({ x: BASE[0], y: BASE[1], w: BASE[2], h: BASE[3] });
  const dragRef = useRef<{ startX: number; startY: number; vb: typeof vb } | null>(null);
  const didDragRef = useRef(false);

  const clampVb = useCallback((nx: number, ny: number, nw: number) => {
    const w = Math.max(BASE[2] / MAX_ZOOM, Math.min(BASE[2] / MIN_ZOOM, nw));
    const h = w * (BASE[3] / BASE[2]);
    const x = Math.max(BASE[0], Math.min(BASE[0] + BASE[2] - w, nx));
    const y = Math.max(BASE[1], Math.min(BASE[1] + BASE[3] - h, ny));
    return { x, y, w, h };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Mouse position as fraction of SVG element
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    const step = 1 + Math.min(Math.abs(e.deltaY), 100) * 0.0008;
    const factor = e.deltaY > 0 ? step : 1 / step;
    setVb(prev => {
      const nw = prev.w * factor;
      // Zoom toward mouse position
      // Clamp size first, then adjust origin proportionally
      const cw = Math.max(BASE[2] / MAX_ZOOM, Math.min(BASE[2], nw));
      const ch = cw * (BASE[3] / BASE[2]);
      const cx = prev.x + (prev.w - cw) * mx;
      const cy = prev.y + (prev.h - ch) * my;
      return {
        w: cw, h: ch,
        x: Math.max(BASE[0], Math.min(BASE[0] + BASE[2] - cw, cx)),
        y: Math.max(BASE[1], Math.min(BASE[1] + BASE[3] - ch, cy)),
      };
    });
    setTooltip(null);
  }, [clampVb]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, vb: { ...vb } };
    didDragRef.current = false;
  }, [vb]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragRef.current.startX) / rect.width * dragRef.current.vb.w;
    const dy = (e.clientY - dragRef.current.startY) / rect.height * dragRef.current.vb.h;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDragRef.current = true;
    setVb(clampVb(
      dragRef.current.vb.x - dx,
      dragRef.current.vb.y - dy,
      dragRef.current.vb.w
    ));
    setTooltip(null);
  }, [clampVb]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleMouseEnter = useCallback((id: string, e: React.MouseEvent) => {
    const country = ERASMUS_COUNTRIES.find(c => c.id === id);
    if (!country || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({ name: country[lang], countryId: id, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [lang]);

  const handleMouseMoveTooltip = useCallback((e: React.MouseEvent) => {
    if (!tooltip || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip(prev => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  }, [tooltip]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const handleCountryClick = useCallback((id: string) => {
    if (!didDragRef.current) onSelectCountry(id);
  }, [onSelectCountry]);

  const isZoomed = vb.w < BASE[2] - 1;

  const stats = tooltip ? ERASMUS_COUNTRY_STATS[tooltip.countryId] : null;

  const top3 = useMemo(() => {
    return Object.entries(ERASMUS_COUNTRY_STATS)
      .map(([id, s]) => ({ id, count: s.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => {
        const country = ERASMUS_COUNTRIES.find(c => c.id === item.id);
        return {
          id: item.id,
          name: country ? country[lang] : item.id,
          count: item.count
        };
      });
  }, [lang]);

  return (
    <div className="flex h-full gap-4 p-1 overflow-hidden">
      {/* Map column */}
      <div ref={containerRef} className="relative flex-1" onMouseMove={handleMouseMoveTooltip}>
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="w-full h-full"
          role="img"
          aria-label="Europe map"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
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
            const opacity = selectedCountryId ? (isSelected ? 0 : 0.4) : 1;

            if (isBackground) {
              return (
                <path 
                  key={id} 
                  d={d} 
                  fill="none" 
                  stroke="oklch(var(--b1))" 
                  strokeWidth={0.3} 
                  fillRule="evenodd" 
                  opacity={opacity}
                  style={{ transition: 'opacity 0.3s' }}
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
                onClick={isErasmus ? () => handleCountryClick(id) : undefined}
                onMouseEnter={isErasmus ? (e) => handleMouseEnter(id, e) : undefined}
                onMouseLeave={isErasmus ? handleMouseLeave : undefined}
                aria-label={isErasmus ? ERASMUS_COUNTRIES.find(c => c.id === id)?.[lang] : undefined}
                opacity={opacity}
                style={{ transition: 'opacity 0.3s' }}
              />
            );
          })}

          {/* Special effects for selected country (Stage 1) - Rendered on TOP */}
          {selectedCountryId && (
            (() => {
              const path = EUROPE_PATHS.find(p => p.id === selectedCountryId);
              if (!path) return null;
              const s = ERASMUS_COUNTRY_STATS[path.id];
              const fill = s ? priceLevelColor(s.priceLevelIndex) : 'oklch(var(--b3))';
              
              return (
                <g className="pointer-events-none">
                  {/* Outer glow layer */}
                  <path
                    d={path.d}
                    fill="none"
                    stroke="oklch(var(--p) / 0.3)"
                    strokeWidth={12}
                    fillRule="evenodd"
                    style={{ filter: 'blur(10px)' }}
                  />
                  {/* Clean sharp layer with glow */}
                  <path
                    d={path.d}
                    fill={fill}
                    stroke="oklch(var(--p))"
                    strokeWidth={3}
                    fillRule="evenodd"
                    style={{ filter: 'drop-shadow(0 0 12px oklch(var(--p) / 0.8))' }}
                  />
                </g>
              );
            })()
          )}

        {/* Vertical separator line (Stage 3) */}
        <line x1="120" y1="0" x2="120" y2="519" stroke="oklch(var(--b3))" strokeWidth="1" />
        </svg>

        {/* Reset zoom button */}
        {isZoomed && (
          <button
            onClick={() => setVb({ x: BASE[0], y: BASE[1], w: BASE[2], h: BASE[3] })}
            className="absolute top-2 right-2 btn btn-xs btn-ghost bg-base-100/80 border border-base-300"
          >
            Reset
          </button>
        )}

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

      {/* Legend & Stats column (Stage 2) */}
      <div className="w-44 shrink-0 flex flex-col gap-6 py-2 pr-2">
        {/* Price Level Legend */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{t('erasmus.legend')}</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full ring-1 ring-base-content/10 shadow-sm" style={{ backgroundColor: priceLevelColor(160) }} />
              <span className="text-xs font-medium text-base-content/80">{t('erasmus.higherPrices')}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full ring-1 ring-base-content/10 shadow-sm" style={{ backgroundColor: priceLevelColor(40) }} />
              <span className="text-xs font-medium text-base-content/80">{t('erasmus.lowerPrices')}</span>
            </div>
          </div>
        </div>

        {/* Top 3 Stats */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{t('erasmus.topDestinations')}</h3>
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {top3.map((item) => (
              <li key={item.id} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xs font-bold truncate max-w-[100px]">{item.name}</span>
                  <span className="text-[10px] opacity-60 font-mono whitespace-nowrap">({item.count} {t('erasmus.reports')})</span>
                </div>
                {/* Visual indicator (optional bar) */}
                <div className="w-full h-1 bg-base-300 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary/40" 
                    style={{ width: `${(item.count / top3[0].count) * 100}%` }} 
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
