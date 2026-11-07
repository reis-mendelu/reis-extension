import { useEffect, useRef, useState } from 'react';
import { BriefcaseBusiness, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useEscapeLayer } from '../../hooks/ui/useEscapeLayer';
import { usePartnerInternships } from '../../hooks/usePartnerInternships';
import { InternshipList } from './InternshipList';

/**
 * Stáže in the extension: a pill beside the vývěska's, opening the same list
 * the phone's sheet shows. Nothing at all for a student whose field has no
 * partner programme, as on the phone.
 */
export function InternshipsMenu() {
  const { t } = useTranslation();
  const items = usePartnerInternships();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  useEscapeLayer(open, () => setOpen(false));

  if (items.length === 0) return null;

  return (
    <div className="relative flex items-center" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-lg border border-base-300 bg-base-100 px-3 py-1.5 transition-colors hover:bg-base-200 ${
          open ? 'border-primary/40 bg-base-200/80' : ''
        }`}
      >
        <BriefcaseBusiness className="h-3 w-3 flex-shrink-0 text-[var(--tone-primary)]" />
        <span className="whitespace-nowrap text-xs font-semibold text-base-content">
          {t('internships.title')}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-xl">
          <div className="flex items-center justify-between border-b border-base-300/80 bg-base-200/40 px-4 py-2.5">
            <span className="text-xs font-bold text-base-content">{t('internships.title')}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('internships.close')}
              className="rounded-lg p-1 text-base-content/40 transition-colors hover:bg-base-300 hover:text-base-content/85"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex max-h-96 flex-col gap-3 overflow-y-auto p-4">
            <p className="text-xs text-base-content/60">{t('internships.intro')}</p>
            <InternshipList items={items} />
          </div>
        </div>
      )}
    </div>
  );
}
