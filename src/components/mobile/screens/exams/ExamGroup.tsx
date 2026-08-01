import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface ExamGroupProps {
  title: string;
  count: number;
  children: ReactNode;
}

/** Collapsible section header ("Nadcházející" / "Ostatní") wrapping a list of ExamCards. */
export function ExamGroup({ title, count, children }: ExamGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 px-0.5 text-left"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
          {title}
        </span>
        <span className="rounded-full bg-base-300 px-1.5 py-0.5 text-xs font-semibold text-base-content/60">
          {count}
        </span>
        <span className="flex-1 border-b border-base-300" />
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
