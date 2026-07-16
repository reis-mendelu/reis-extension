import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Clock, X } from 'lucide-react';
import {
  TIME_OPTIONS,
  EVENING_ANCHOR,
  maskTimeInput,
  isCompleteTime,
  filterTimeOptions,
} from './timeField';
import { TimeListbox } from './TimeListbox';

// reIS-native start-time picker: a type-or-pick combobox. The field is editable
// (type "1930" → 19:30, colon auto-inserted, hours/minutes clamped) and the
// chevron opens a single quarter-hour list to click or arrow through. NOT the OS
// <input type="time"> wheel (off-brand chrome) nor the old two scrollable columns
// (two hunts for one thought). Value is "HH:MM"; empty = no time. Mirrors
// MiniCalendar's portalled popover so the side panel's overflow can't clip it.
const POPOVER_WIDTH = 160;
const POPOVER_EST_HEIGHT = 240;
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
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLLabelElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listId = 'time-listbox';

  // `value` is the source of truth; `text` is the in-progress draft. Reconcile
  // during render on outside changes (list pick, composer reset) — React's
  // sanctioned alternative to a setState effect. Partial drafts never move
  // `value`, so mid-typing ("19:3") won't trip this and get clobbered.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }

  const options = useMemo(() => filterTimeOptions(text), [text]);

  const updatePos = useCallback(() => {
    const el = wrapRef.current;
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

  // Close and revert the draft to the last committed value, so an abandoned
  // partial ("19:3") never lingers in the field.
  const close = useCallback(() => {
    setOpen(false);
    setText(value);
  }, [value]);

  const commit = (v: string) => {
    setText(v);
    onChange(v);
    setOpen(false);
    inputRef.current?.focus();
  };

  // When opening, land the highlight (and scroll) on the value if set, else on
  // the early-evening anchor — the common society start band, one glance in.
  const openList = useCallback(() => {
    const anchor = isCompleteTime(value) ? value : EVENING_ANCHOR;
    const i = TIME_OPTIONS.indexOf(anchor);
    setActive(i);
    setOpen(true);
  }, [value]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || popRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos, close]);

  // Keep the active row scrolled into view for both keyboard nav and first open.
  useLayoutEffect(() => {
    if (!open || active < 0) return;
    popRef.current
      ?.querySelector(`[data-opt="${options[active]}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active, options]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && options[active]) commit(options[active]);
      else if (isCompleteTime(text)) commit(text);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <label
      ref={wrapRef}
      className={`input input-bordered flex w-full items-center gap-2 ${value ? '' : 'text-base-content/50'}`}
      // Open on a field click, but not on the refocus after a pick (else
      // commit()'s focus() would reopen the list). Typing/ArrowDown open too.
      onClick={() => {
        if (!open) openList();
      }}
    >
      <Clock size={16} className={value ? 'text-primary' : 'opacity-70'} />
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={t('map.eventTime')}
        placeholder="--:--"
        value={text}
        className="grow bg-transparent tabular-nums outline-none placeholder:text-base-content/40"
        onChange={(e) => {
          const masked = maskTimeInput(e.target.value);
          setText(masked);
          setActive(-1);
          if (!open) setOpen(true);
          if (masked === '' || isCompleteTime(masked)) onChange(masked);
        }}
        onKeyDown={onKeyDown}
      />
      {value && (
        <button
          type="button"
          aria-label={t('map.clearTime')}
          className="opacity-50 transition-opacity hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            commit('');
          }}
        >
          <X size={15} />
        </button>
      )}
      <button
        type="button"
        aria-label={t('map.eventTime')}
        className="opacity-50"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) close();
          else openList();
        }}
      >
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <TimeListbox
          id={listId}
          options={options}
          value={value}
          active={active}
          pos={pos}
          width={POPOVER_WIDTH}
          popRef={popRef}
          onHover={setActive}
          onPick={commit}
          emptyLabel={t('map.noMatchingTime')}
        />
      )}
    </label>
  );
}
