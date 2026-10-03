import type { ReactNode } from 'react';
import { ChevronLeft, ExternalLink, X } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

export interface SheetHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onClose?: () => void;
  /**
   * Screen presentation: a back chevron in place of the close X, and no drag
   * pill — a screen is left by going back, and the pill would be advertising a
   * gesture `Sheet variant="screen"` deliberately does not have.
   */
  onBack?: () => void;
  /** Sits left of the title block in the same row — a person's avatar. */
  leading?: ReactNode;
  /**
   * Makes the title a link to this sheet's page in IS. Opt-in: most sheets
   * have no such page. `target="_blank"` hands it to the external-link
   * handler, which opens IS in the in-app browser with the session.
   */
  titleHref?: string;
}

/** Drag handle + title block, shared by every sheet. */
export function SheetHeader({
  title,
  subtitle,
  eyebrow,
  onClose,
  onBack,
  leading,
  titleHref,
}: SheetHeaderProps) {
  const { t } = useTranslation();
  return (
    // touch-none is what makes the drag pill below more than decoration. Sheet
    // owns the pointer handlers and these events bubble up to it, but with the
    // default touch-action the browser claims the gesture as a pan partway
    // through and fires pointercancel — measured on device, the drag was cut off
    // after ~20px of a 350px swipe, so it never met the dismiss threshold.
    // Scoped to the header so the content below keeps scrolling normally.
    <div className="flex-shrink-0 touch-none">
      {!onBack && <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-base-300" />}
      <div className="flex items-start gap-3 px-4 pb-3 pt-2">
        {onBack && (
          <button
            onClick={onBack}
            aria-label={t('mobile.sheet.back')}
            className="btn btn-circle btn-ghost btn-sm -ml-1 flex-shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {eyebrow && (
            <span className="font-mono text-xs font-semibold tracking-wider text-primary">
              {eyebrow}
            </span>
          )}
          {/* Inside the touch-none header, and that is fine: touch-action only
              stops the browser panning, a tap still clicks. On a sheet that
              drags, useSheetDrag swallows the click a drag ends in. */}
          {titleHref ? (
            <a
              href={titleHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-lg font-bold tracking-tight"
            >
              {title}
              {/* Inline after the last word, so a long name wraps with the icon
                  rather than leaving it stranded in a column of its own. */}
              <ExternalLink
                aria-hidden="true"
                className="ml-1.5 inline h-4 w-4 align-[-0.125em] text-base-content/60"
              />
            </a>
          ) : (
            <span className="font-display text-lg font-bold tracking-tight">{title}</span>
          )}
          {subtitle && <span className="text-sm text-base-content/60">{subtitle}</span>}
        </div>
        {/* Back and close are alternatives, not a pair: a screen is left by
            going back, a sheet by being closed. onBack wins so a caller passing
            both cannot end up with two competing controls in one header. */}
        {onClose && !onBack && (
          <button
            onClick={onClose}
            aria-label={t('mobile.sheet.close')}
            className="btn btn-circle btn-ghost btn-sm flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
