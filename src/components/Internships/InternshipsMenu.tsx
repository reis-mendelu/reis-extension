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
  const pillRef = useRef<HTMLButtonElement>(null);
  // Escape and the X close from inside the dropdown, whose elements then
  // unmount: put keyboard focus back on the pill instead of the page body.
  // A click outside is not one of them; it already put focus where it went.
  const closeToPill = () => {
    setOpen(false);
    pillRef.current?.focus();
  };

  // The field can stop matching while the dropdown is open (an admin switching
  // the impersonated faculty). The component then renders nothing, so the
  // dropdown must also stop being open — or its Escape layer would stay armed,
  // invisible, and swallow the next Escape.
  const shown = open && items.length > 0;
  // Adjusted during render, React's pattern for state derived from props.
  if (open && items.length === 0) setOpen(false);

  useEffect(() => {
    if (!shown) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [shown]);
  useEscapeLayer(shown, closeToPill);

  if (items.length === 0) return null;

  return (
    <div className="relative flex items-center" ref={ref}>
      <button
        ref={pillRef}
        type="button"
        onClick={() => setOpen(!shown)}
        aria-expanded={shown}
        className={`flex items-center gap-1.5 rounded-lg border border-base-300 bg-base-100 px-3 py-1.5 transition-colors hover:bg-base-200 ${
          shown ? 'border-primary/40 bg-base-200/80' : ''
        }`}
      >
        <BriefcaseBusiness className="h-3 w-3 flex-shrink-0 text-[var(--tone-primary)]" />
        <span className="whitespace-nowrap text-xs font-semibold text-base-content">
          {t('internships.title')}
        </span>
      </button>

      {shown && (
        // Anchored under the pill, the 384px panel runs from x≈457 to x≈841, so
        // below an 880px window it would hang off the right side — and the
        // app's own "narrow" switch only flips at 768px, which left 768–860
        // overflowing (measured). Below 880px it spans the window instead.
        <div
          data-internships-panel
          className="fixed inset-x-4 top-16 z-50 flex flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-xl min-[880px]:absolute min-[880px]:inset-x-auto min-[880px]:left-0 min-[880px]:top-11 min-[880px]:w-96"
        >
          <div className="flex items-center justify-between border-b border-base-300/80 bg-base-200/40 px-4 py-2.5">
            <span className="text-xs font-bold text-base-content">{t('internships.title')}</span>
            <button
              type="button"
              onClick={closeToPill}
              aria-label={t('internships.close')}
              className="rounded-lg p-1 text-base-content/40 transition-colors hover:bg-base-300 hover:text-base-content/85"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex max-h-96 flex-col gap-3 overflow-y-auto p-4">
            <InternshipList items={items} />
          </div>
        </div>
      )}
    </div>
  );
}
