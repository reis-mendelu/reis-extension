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

const BASE = EUROPE_VIEWBOX.split(' ').map(Number); // [0, 0, 800, 519]
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

  return (
    <div ref={containerRef} className="relative h-full" onMouseMove={handleMouseMoveTooltip}>
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

          if (isBackground) {
            return (
              <path key={id} d={d} fill="none" stroke="oklch(var(--b1))" strokeWidth={0.3} fillRule="evenodd" />
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
            />
          );
        })}
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
  );
}
