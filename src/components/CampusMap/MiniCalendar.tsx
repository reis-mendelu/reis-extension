import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toISO, parseISO, monthMatrix, addMonths } from './calendar';

// Wide enough for seven comfortable circular day cells plus the card padding.
const POPOVER_WIDTH = 288;
// Minimum gap the popover keeps from the viewport edge.
const MARGIN = 8;
// Fallback height (header + weekday row + up to 6 day rows + padding) used only
// until the popover has mounted and its real height can be measured.
const POPOVER_EST_HEIGHT = 340;

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
  isDisabled,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  placeholder: string;
  t: (k: string) => string;
  locale: string;
  // Optional gate: return true for a day that can't be picked (greyed, inert).
  // Omitted → every day is selectable (the original behaviour).
  isDisabled?: (iso: string) => boolean;
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
  const todayISO = useMemo(() => {
    const n = new Date();
    return toISO(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);
  const label = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : placeholder;
  const monthName = new Date(view.y, view.m0, 1).toLocaleDateString(locale, { month: 'long' });

  // Anchor the popover to the trigger in viewport coords. It's portalled to
  // <body> so the side-panel's overflow-hidden can't clip it. Right-align it to
  // the trigger (the popover is wider than the field) so it keeps the panel's
  // own inset from the edge instead of bleeding to the border; clamp into the
  // viewport with a margin as a fallback. Vertically it prefers to sit below the
  // trigger, but flips above (or clamps) when a low trigger would push the card
  // off the bottom of the screen.
  const updatePos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(
      MARGIN,
      Math.min(r.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - MARGIN)
    );
    const popH = popRef.current?.offsetHeight || POPOVER_EST_HEIGHT;
    const below = r.bottom + 6;
    const above = r.top - 6 - popH;
    // Flip above only when below overflows AND above actually has room.
    const top =
      below + popH > window.innerHeight - MARGIN && above >= MARGIN
        ? above
        : Math.max(MARGIN, Math.min(below, window.innerHeight - popH - MARGIN));
    setPos({ top, left });
  }, []);

  // Layout effect (not useEffect): position the popover before the browser
  // paints, so it never flashes at its initial {0,0} for a frame.
  useLayoutEffect(() => {
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
        <Calendar size={16} className={value ? 'text-primary' : 'opacity-70'} />
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
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full text-base-content/70 transition-colors hover:bg-base-content/10"
                aria-label={t('map.prevMonth')}
                onClick={() => setView((v) => addMonths(v.y, v.m0, -1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm">
                <span className="font-semibold capitalize text-base-content">{monthName}</span>{' '}
                <span className="text-base-content/50">{view.y}</span>
              </span>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full text-base-content/70 transition-colors hover:bg-base-content/10"
                aria-label={t('map.nextMonth')}
                onClick={() => setView((v) => addMonths(v.y, v.m0, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider">
              {dow.map((d, i) => (
                // Monday-first: indices 5 and 6 are Sat/Sun — the prime
                // society-event days, faintly brand-tinted rather than plain gray.
                <span key={i} className={i >= 5 ? 'text-primary/60' : 'text-base-content/40'}>
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 justify-items-center gap-1">
              {monthMatrix(view.y, view.m0)
                .flat()
                .map((d, i) => {
                  if (d === null) return <span key={i} />;
                  const iso = toISO(view.y, view.m0, d);
                  const sel = iso === value;
                  const isToday = iso === todayISO;
                  const disabled = isDisabled?.(iso) ?? false;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={disabled}
                      aria-pressed={sel}
                      aria-current={isToday ? 'date' : undefined}
                      className={[
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm tabular-nums transition-colors',
                        disabled
                          ? 'cursor-not-allowed text-base-content/20'
                          : sel
                            ? 'bg-primary font-semibold text-primary-content hover:bg-primary/90'
                            : isToday
                              ? 'font-semibold text-primary ring-1 ring-inset ring-primary/50 hover:bg-primary/10'
                              : 'text-base-content hover:bg-base-content/10',
                      ].join(' ')}
                      onClick={
                        disabled
                          ? undefined
                          : () => {
                              onChange(iso);
                              setOpen(false);
                            }
                      }
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
