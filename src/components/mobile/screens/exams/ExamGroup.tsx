import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type ExamGroupTone = 'registered' | 'notYetOpen' | 'open' | 'blocked';

// The same three colours as the cards' accent bars, so a header and the rows
// under it read as one thing. A dot and a tinted rule rather than coloured
// text: small bold text on a tinted chip is where this screen already failed
// contrast (the "2 přihlášené" pill measured 4.01:1).
const TONE: Record<ExamGroupTone, { dot: string; rule: string }> = {
  registered: { dot: 'bg-success', rule: 'border-success/40' },
  notYetOpen: { dot: 'bg-warning', rule: 'border-warning/40' },
  open: { dot: 'bg-info', rule: 'border-info/40' },
  // Grey: shown, but nothing to act on.
  blocked: { dot: 'bg-base-content/40', rule: 'border-base-content/20' },
};

export interface ExamGroupProps {
  title: string;
  /** Left out where the screen already states it — the registered group's
   *  count is the "2 přihlášené" pill right above it. */
  count?: number;
  tone: ExamGroupTone;
  children: ReactNode;
}

/** Collapsible, colour-coded section header wrapping one group of exam cards. */
export function ExamGroup({ title, count, tone, children }: ExamGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <div data-testid={`exam-group-${tone}`} className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 px-0.5 text-left"
      >
        <span
          className={`h-2 w-2 flex-shrink-0 rounded-full ${TONE[tone].dot}`}
          aria-hidden="true"
        />
        <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
          {title}
        </span>
        {count !== undefined && (
          <span className="rounded-full bg-base-300 px-1.5 py-0.5 text-xs font-semibold text-base-content/60">
            {count}
          </span>
        )}
        <span className={`flex-1 border-b ${TONE[tone].rule}`} />
        {open ? (
          <ChevronUp size={13} className="flex-shrink-0 text-base-content/60" />
        ) : (
          <ChevronDown size={13} className="flex-shrink-0 text-base-content/60" />
        )}
      </button>
      {open && <div className="flex flex-col gap-2">{children}</div>}
    </div>
  );
}
