import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toISO, parseISO, monthMatrix, addMonths } from './calendar';

// The 7×32px day grid + padding needs this much; narrower and the grid wraps.
const POPOVER_WIDTH = 256;

// Monday-first short weekday names in the caller's locale. 2024-01-01 is a
// Monday, so offsetting from it gives Mon…Sun in whatever language the app is in
// (the old hardcoded Czech row ignored `locale`).
function weekdayNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
}

export function MiniCalendar({
  value,
  onChange,
  placeholder,
  t,
  locale,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  placeholder: string;
  t: (k: string) => string;
  locale: string;
}) {
  const parsed = value ? parseISO(value) : null;
  const [view, setView] = useState(
    () => parsed ?? { y: new Date().getFullYear(), m0: new Date().getMonth() }
  );
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const dow = useMemo(() => weekdayNames(locale), [locale]);
  const label = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : placeholder;
  const monthLabel = new Date(view.y, view.m0, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

  // Anchor the popover under the trigger in viewport coords. It's portalled to
  // <body> so the side-panel's overflow-hidden can't clip it; clamp to the
  // viewport so it never spills off the right edge.
  const updatePos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 8);
    setPos({ top: r.bottom + 4, left: Math.max(8, left) });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    // Reposition while open if anything scrolls/resizes under it (capture=true
    // catches scroll on the panel/map, which don't bubble to window).
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        // No tabIndex: a <button> is already focusable. When this was a DaisyUI
        // `.dropdown` trigger, marking it [tabindex] made
        // `.dropdown:focus-within > [tabindex]:first-child { pointer-events:none }`
        // fire on mousedown-focus, so the click landed on the parent and onClick
        // never ran. The popover is now portalled, but keep it plain regardless.
        className={`input input-bordered flex w-full items-center gap-2 ${value ? '' : 'text-base-content/50'}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Calendar size={16} className="opacity-70" />
        <span className="truncate">{label}</span>
        <ChevronDown
          size={16}
          className={`ml-auto opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="fixed z-[9999] rounded-box border border-base-300 bg-base-100 p-3 shadow-popover-heavy"
            style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                aria-label={t('map.prevMonth')}
                onClick={() => setView((v) => addMonths(v.y, v.m0, -1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold capitalize">{monthLabel}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                aria-label={t('map.nextMonth')}
                onClick={() => setView((v) => addMonths(v.y, v.m0, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-base-content/50">
              {dow.map((d, i) => (
                <span key={i} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {monthMatrix(view.y, view.m0)
                .flat()
                .map((d, i) => {
                  if (d === null) return <span key={i} />;
                  const iso = toISO(view.y, view.m0, d);
                  const sel = iso === value;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`btn btn-ghost btn-xs h-8 w-8 p-0 tabular-nums ${sel ? 'btn-primary' : ''}`}
                      onClick={() => {
                        onChange(iso);
                        setOpen(false);
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
