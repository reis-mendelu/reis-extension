import { ArrowUpRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { PartnerMark } from '../brand/PartnerMark';
import type { ShownInternship } from '../../utils/partnerInternships';

/**
 * The Stáže list, shared by the phone's sheet and the extension's popover.
 * Each card is one plain `target="_blank"` link: `installExternalLinkHandler`
 * opens it in the in-app browser on the phone, a new tab in the extension.
 * Nothing about the student goes with it.
 */
export function InternshipList({ items }: { items: ShownInternship[] }) {
  const language = useAppStore((s) => s.language);

  return (
    <ul className="flex flex-col gap-3">
      {items.map(({ internship, partner }) => (
        <li key={`${partner.id}-${internship.url}`}>
          <a
            href={internship.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-4 transition-colors hover:bg-base-200"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <PartnerMark partner={partner} className="h-6 self-start" />
              <span className="font-semibold text-base-content">{internship.title}</span>
              <span className="text-sm leading-snug text-base-content/70">
                {internship.body[language]}
              </span>
            </div>
            <ArrowUpRight className="mt-1 h-4 w-4 flex-shrink-0 text-base-content/40 transition-colors group-hover:text-[var(--tone-primary)]" />
          </a>
        </li>
      ))}
    </ul>
  );
}
