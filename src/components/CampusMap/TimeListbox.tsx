import type { RefObject } from 'react';
import { createPortal } from 'react-dom';

// The portalled quarter-hour list for ComposerTimeField — split out to keep the
// combobox itself lean. Rendered to <body> so the side panel's overflow can't
// clip it; the parent owns positioning and keyboard state.
export function TimeListbox({
  id,
  options,
  value,
  active,
  pos,
  width,
  popRef,
  onHover,
  onPick,
  emptyLabel,
}: {
  id: string;
  options: string[];
  value: string;
  active: number;
  pos: { top: number; left: number };
  width: number;
  popRef: RefObject<HTMLDivElement | null>;
  onHover: (i: number) => void;
  onPick: (o: string) => void;
  emptyLabel: string;
}) {
  return createPortal(
    <div
      ref={popRef}
      id={id}
      role="listbox"
      className="fixed z-[9999] max-h-[240px] overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1 shadow-popover-heavy"
      style={{ top: pos.top, left: pos.left, width }}
    >
      {options.length === 0 ? (
        <p className="px-2 py-3 text-center text-xs text-base-content/50">{emptyLabel}</p>
      ) : (
        options.map((o, i) => (
          <button
            key={o}
            type="button"
            data-opt={o}
            role="option"
            aria-selected={o === value}
            className={`block w-full rounded-md px-2 py-1.5 text-left text-sm tabular-nums transition-colors ${
              o === value
                ? 'bg-primary font-semibold text-primary-content'
                : i === active
                  ? 'bg-base-content/10 text-base-content'
                  : 'text-base-content hover:bg-base-content/10'
            }`}
            onMouseEnter={() => onHover(i)}
            onClick={() => onPick(o)}
          >
            {o}
          </button>
        ))
      )}
    </div>,
    document.body
  );
}
