import { FileText, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

export type ShortcutSheetKind = 'eduroam' | 'docs';

interface ShortcutGridProps {
  onOpenSheet: (kind: ShortcutSheetKind) => void;
}

const cardClassName =
  'flex flex-col items-start gap-2 rounded-xl border border-base-300 bg-base-100 p-3.5 text-left';

/**
 * The Student-hub shortcut cards: Dokumenty, which opens a sheet, and ISKAM.
 *
 * ISKAM is deliberately a plain `<a>` rather than a sheet trigger: it is a
 * separate host integration with its own store/IndexedDB namespace, and its
 * data only ever refreshes while the user is actually on webiskam.mendelu.cz —
 * a sheet here would just show a stale cache. The document-level external-link
 * handler routes it through the in-app browser.
 *
 * Two cards that used to be here are gone. eduroam moved to the settings sheet:
 * it is one-time device setup, not an everyday shortcut, and it competed for
 * attention here. `ShortcutSheetKind` keeps its 'eduroam' member — SheetHost
 * still renders that sheet, it is just opened from settings.
 *
 * Erasmus was removed from the phone entirely. It hosted the desktop panel
 * wholesale, whose Learning Agreement tables and Europe map do not survive a
 * narrow screen, and it offered every student a shortcut to something only
 * exchange students use. It remains on desktop, where it works.
 */
export function ShortcutGrid({ onOpenSheet }: ShortcutGridProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-2.5 px-4 pb-1 pt-0.5">
      <button type="button" onClick={() => onOpenSheet('docs')} className={cardClassName}>
        <FileText size={20} className="text-primary" />
        <span>
          <span className="block text-md font-semibold">{t('mobile.student.documents')}</span>
          <span className="block text-2sm text-base-content/60">
            {t('mobile.student.documentsSub')}
          </span>
        </span>
      </button>
      <a
        href="https://webiskam.mendelu.cz/"
        target="_blank"
        rel="noopener noreferrer"
        className={cardClassName}
      >
        <UtensilsCrossed size={20} className="text-primary" />
        <span>
          <span className="block text-md font-semibold">{t('mobile.student.iskam')}</span>
          <span className="block text-2sm text-base-content/60">
            {t('mobile.student.iskamSub')}
          </span>
        </span>
      </a>
    </div>
  );
}
