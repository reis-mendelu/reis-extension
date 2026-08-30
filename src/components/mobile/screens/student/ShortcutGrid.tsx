import { FileText } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

export type ShortcutSheetKind = 'eduroam' | 'docs';

interface ShortcutGridProps {
  onOpenSheet: (kind: ShortcutSheetKind) => void;
}

const cardClassName =
  'flex flex-col items-start gap-2 rounded-xl border border-base-300 bg-base-100 p-3.5 text-left';

/**
 * The Student-hub shortcut cards. Only Dokumenty is left, so the grid is a
 * single full-width column — one card in the old `grid-cols-2` would sit at
 * half width beside an empty cell.
 *
 * Three cards that used to be here are gone. ISKAM went with the WebISKAM
 * integration: the card was the last entry point to a host reIS no longer
 * talks to.
 *
 * eduroam moved to the settings sheet: it is one-time device setup, not an
 * everyday shortcut, and it competed for attention here. `ShortcutSheetKind`
 * keeps its 'eduroam' member — SheetHost still renders that sheet, it is just
 * opened from settings.
 *
 * Erasmus was removed from the phone entirely. It hosted the desktop panel
 * wholesale, whose Learning Agreement tables and Europe map do not survive a
 * narrow screen, and it offered every student a shortcut to something only
 * exchange students use. It remains on desktop, where it works.
 */
export function ShortcutGrid({ onOpenSheet }: ShortcutGridProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-2.5 px-4 pb-1 pt-0.5">
      <button type="button" onClick={() => onOpenSheet('docs')} className={cardClassName}>
        <FileText size={20} className="text-primary" />
        <span>
          <span className="block text-md font-semibold">{t('mobile.student.documents')}</span>
          <span className="block text-2sm text-base-content/60">
            {t('mobile.student.documentsSub')}
          </span>
        </span>
      </button>
    </div>
  );
}
