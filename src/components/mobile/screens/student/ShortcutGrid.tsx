import { FileText, GraduationCap, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

export type ShortcutSheetKind = 'eduroam' | 'docs' | 'erasmus';

interface ShortcutGridProps {
  onOpenSheet: (kind: ShortcutSheetKind) => void;
}

const cardClassName =
  'flex flex-col items-start gap-2 rounded-xl border border-base-300 bg-base-100 p-3.5 text-left';

/**
 * The four Student-hub shortcut cards. Eduroam/Dokumenty/Erasmus open a sheet
 * (Tasks 17-19 will give those `kind`s a renderer in SheetHost). ISKAM is
 * deliberately a plain `<a>` rather than a sheet trigger: ISKAM is a separate
 * host integration with its own store/IndexedDB namespace, and its data only
 * ever refreshes while the user is actually on webiskam.mendelu.cz — a sheet
 * here would just show a stale cache.
 */
export function ShortcutGrid({ onOpenSheet }: ShortcutGridProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-2.5 px-4 pb-1 pt-0.5">
      {/* eduroam moved to the settings sheet: it is one-time device setup, not
          an everyday shortcut. `ShortcutSheetKind` keeps its 'eduroam' member —
          SheetHost still renders that sheet, it is just opened from settings. */}
      <button type="button" onClick={() => onOpenSheet('docs')} className={cardClassName}>
        <FileText size={20} className="text-primary" />
        <span>
          <span className="block text-md font-semibold">{t('mobile.student.documents')}</span>
          <span className="block text-2sm text-base-content/60">
            {t('mobile.student.documentsSub')}
          </span>
        </span>
      </button>
      <button type="button" onClick={() => onOpenSheet('erasmus')} className={cardClassName}>
        <GraduationCap size={20} className="text-primary" />
        <span>
          <span className="block text-md font-semibold">{t('mobile.student.erasmus')}</span>
          <span className="block text-2sm text-base-content/60">
            {t('mobile.student.erasmusSub')}
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
