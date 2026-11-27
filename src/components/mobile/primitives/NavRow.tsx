import type { ComponentType } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';

export interface NavRowProps {
  /**
   * Omitted where the row has to read as a sibling of an icon-less header.
   * Usually a lucide icon; a brand mark (StudyAidsIcon) takes the same props.
   */
  icon?: ComponentType<{ size?: number; className?: string }>;
  label: string;
  /** Optional second line. Truncated: these are one-liners, not descriptions. */
  sublabel?: string;
  onClick: () => void;
  /** The row leaves the app (a website in the in-app browser): the trailing mark is ExternalLink, not the chevron. */
  external?: boolean;
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
export function NavRow({ icon: Icon, label, sublabel, onClick, external }: NavRowProps) {
  const Trail = external ? ExternalLink : ChevronRight;
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
      <Trail size={16} className="flex-shrink-0 text-base-content/40" />
    </button>
  );
}
