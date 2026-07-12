import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toISO, parseISO, monthMatrix, addMonths } from './calendar';

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
  const containerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    // dropdown-open is required: DaisyUI 5 display:none's .dropdown-content
    // unless the container is :focus-within or .dropdown-open, and focus is
    // unreliable inside the extension iframe — state must drive visibility.
    <div className={`dropdown w-full ${open ? 'dropdown-open' : ''}`} ref={containerRef}>
      <button
        type="button"
        // No tabIndex: a <button> is already focusable, and marking it
        // [tabindex] makes DaisyUI's `.dropdown:focus-within > [tabindex]:first-child`
        // rule set pointer-events:none on it the instant mousedown focuses it —
        // the click then lands on the parent .dropdown instead of the button, so
        // onClick never fires and the picker never opens (only physical clicks hit
        // this; a synthetic .click() dispatches straight to the element).
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
      {open && (
        <div
          tabIndex={0}
          className="dropdown-content z-[70] mt-1 w-64 rounded-box border border-base-300 bg-base-100 p-3 shadow-popover-heavy"
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
        </div>
      )}
    </div>
  );
}
