import { X } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

export interface SheetHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onClose?: () => void;
}

/** Drag handle + title block, shared by every sheet. */
export function SheetHeader({ title, subtitle, eyebrow, onClose }: SheetHeaderProps) {
  const { t } = useTranslation();
  return (
    // touch-none is what makes the drag pill below more than decoration. Sheet
    // owns the pointer handlers and these events bubble up to it, but with the
    // default touch-action the browser claims the gesture as a pan partway
    // through and fires pointercancel — measured on device, the drag was cut off
    // after ~20px of a 350px swipe, so it never met the dismiss threshold.
    // Scoped to the header so the content below keeps scrolling normally.
    <div className="flex-shrink-0 touch-none">
      <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-base-300" />
      <div className="flex items-start gap-3 px-4 pb-3 pt-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {eyebrow && (
            <span className="font-mono text-xs font-semibold tracking-wider text-primary">
              {eyebrow}
            </span>
          )}
          <span className="font-display text-lg font-bold tracking-tight">{title}</span>
          {subtitle && <span className="text-sm text-base-content/60">{subtitle}</span>}
        </div>
        {onClose && (
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
