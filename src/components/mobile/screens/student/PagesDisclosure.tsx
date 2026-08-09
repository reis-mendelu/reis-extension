import { ChevronDown, List } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

interface PagesDisclosureProps {
  open: boolean;
  count: number;
  onToggle: () => void;
}

/**
 * The row that reveals the full IS page directory.
 *
 * That directory is 95 links across 13 categories — the whole of IS's own
 * navigation, including its administration, documentation and personalisation
 * sections. Listed outright it buried the two shortcuts a student opens daily
 * under a wall of links nobody scrolls, and made the Student tab read as a
 * site map rather than a hub.
 *
 * The links are kept: an occasional deep link into IS beats a dead end, and
 * the search box above still reaches every one of them without expanding this
 * — searching bypasses the disclosure entirely, which is the point of putting
 * the long tail behind it.
 */
export function PagesDisclosure({ open, count, onToggle }: PagesDisclosureProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="mt-1.5 flex w-full items-center gap-3 px-4 py-3 text-left"
    >
      <List size={17} className="flex-shrink-0 text-base-content/50" />
      <span className="flex-1 text-md font-medium">{t('mobile.student.allPages')}</span>
      <span className="text-sm text-base-content/50">{count}</span>
      <ChevronDown
        size={16}
        className={`flex-shrink-0 text-base-content/40 transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );
}
