import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavRowProps {
  /** Omitted where the row has to read as a sibling of an icon-less header. */
  icon?: LucideIcon;
  label: string;
  /** Optional second line. Truncated: these are one-liners, not descriptions. */
  sublabel?: string;
  onClick: () => void;
}

/**
 * A row that navigates somewhere: icon, label, and a chevron saying so.
 *
 * Written out twice in `ProfileScreen` (eduroam, Dokumenty) before the study
 * plan needed a third. The chevron is the load-bearing part — it is how the
 * phone tree distinguishes "this opens a page" from "this expands in place",
 * and the study plan moved from a header button to one of these precisely
 * because it stopped being a dropdown: "let's put studijni plan under studijni
 * prumer but rather that being a dropdown, it just opens a new page (same as on
 * desktop)".
 */
export function NavRow({ icon: Icon, label, sublabel, onClick }: NavRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      // A single-line row matches the accordion header it sits beside; the
      // two-line variant keeps the tighter padding its second line pays for.
      className={`flex w-full items-center gap-3 px-4 text-left ${sublabel ? 'py-2.5' : 'py-3.5'}`}
    >
      {Icon && <Icon size={16} className="flex-shrink-0 text-base-content/50" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-md font-medium">{label}</span>
        {sublabel && <span className="truncate text-xs text-base-content/60">{sublabel}</span>}
      </div>
      <ChevronRight size={16} className="flex-shrink-0 text-base-content/40" />
    </button>
  );
}
