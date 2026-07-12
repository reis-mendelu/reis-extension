import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock } from 'lucide-react';

// reIS-native start-time picker. A trigger styled like the DATUM field opens a
// custom popover with two scrollable columns (hour / minute) — NOT the OS
// <input type="time"> wheel or a native <select>, both of which draw off-brand
// browser chrome (the "double border" when open) and feel cramped. Value is an
// "HH:MM" string; empty = no time. Mirrors MiniCalendar's portalled-popover
// pattern so the side panel's overflow can't clip it.
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const POPOVER_WIDTH = 200;
const POPOVER_EST_HEIGHT = 260;
const MARGIN = 8;

export function ComposerTimeField({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  t: (k: string) => string;
}) {
  const [h, m] = value ? value.split(':') : ['', ''];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // The hour gates the value so an optional time can be cleared back to empty;
  // picking an hour defaults the minute to 00, which the minute column refines.
  const setHour = (nh: string) => onChange(`${nh}:${m || '00'}`);
  const setMinute = (nm: string) => onChange(h ? `${h}:${nm}` : `00:${nm}`);

  const updatePos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - MARGIN));
    const popH = popRef.current?.offsetHeight || POPOVER_EST_HEIGHT;
    const below = r.bottom + 6;
    const above = r.top - 6 - popH;
    const top =
      below + popH > window.innerHeight - MARGIN && above >= MARGIN
        ? above
        : Math.max(MARGIN, Math.min(below, window.innerHeight - popH - MARGIN));
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  const column = (
    label: string,
    values: string[],
    selected: string,
    onPick: (v: string) => void
  ) => (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-base-content/40">
        {label}
      </span>
      <div className="flex max-h-[200px] flex-col gap-0.5 overflow-y-auto pr-1">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === selected}
            className={`rounded-md py-1.5 text-center text-sm tabular-nums transition-colors ${
              v === selected
                ? 'bg-primary font-semibold text-primary-content'
                : 'text-base-content hover:bg-base-content/10'
            }`}
            onClick={() => onPick(v)}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={t('map.eventTime')}
        className={`input input-bordered flex w-full items-center gap-2 ${value ? '' : 'text-base-content/50'}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Clock size={16} className={value ? 'text-primary' : 'opacity-70'} />
        <span className="truncate">{value || '--:--'}</span>
        <ChevronDown
          size={16}
          className={`ml-auto opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="fixed z-[9999] rounded-box border border-base-300 bg-base-100 p-2 shadow-popover-heavy"
            style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
          >
            <div className="flex gap-2">
              {column(t('map.hour'), HOURS, h, setHour)}
              {column(t('map.minute'), MINUTES, m, setMinute)}
            </div>
            {value && (
              <button
                type="button"
                className="mt-1 w-full rounded-md py-1 text-center text-xs text-base-content/60 transition-colors hover:bg-base-content/10"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                {t('map.clearTime')}
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
