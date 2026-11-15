import { useEffect, useRef } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEscapeLayer } from '../../hooks/ui/useEscapeLayer';
import { useTranslation } from '../../hooks/useTranslation';

interface PersonPhotoLightboxProps {
  /** The data: URL already on screen in the avatar; null renders nothing. */
  src: string | null;
  alt: string;
  onClose: () => void;
}

/**
 * The extension's half of the phone's `PersonPhotoSheet`: a person's photo, as
 * large as the window allows. Same look (black/90 scrim, `max-w-sm`), but not
 * the same component — the phone's lives in the sheet stack (`absolute` inside
 * SheetHost, closed by Android back), and the extension needs Escape and a
 * layer above the drawers instead.
 *
 * Escape goes through `useEscapeLayer`, so it closes the photo and only the
 * photo: the classmate drawer and the subject drawer under it stay. Portalled
 * to `body` with `fixed`, because the drawer it opens from animates in with a
 * transform, which would make `fixed` relative to the drawer.
 */
export function PersonPhotoLightbox({ src, alt, onClose }: PersonPhotoLightboxProps) {
  const { t } = useTranslation();
  const open = !!src;
  useEscapeLayer(open, onClose);

  // Modal for the keyboard too: focus moves to the X (the only control), and
  // goes back to whatever opened the photo once it closes, if that is still
  // on screen (the hover card has stepped aside by then).
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!src || typeof document === 'undefined') return null;

  // React events cross portals along the component tree: without this, a
  // click here reaches the hover card's anchor, which toggles the card.
  const close = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return createPortal(
    <div
      data-testid="person-photo-lightbox"
      role="dialog"
      aria-modal="true"
      // A dialog needs a name; a profile that failed to load leaves alt empty.
      aria-label={alt || t('common.photo')}
      onClick={close}
      // One control, so Tab has nowhere to go but out, behind the scrim.
      onKeyDown={(e) => e.key === 'Tab' && e.preventDefault()}
      className="fixed inset-0 z-[10000] flex cursor-zoom-out items-center justify-center bg-black/90 p-6 animate-in fade-in"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={close}
        aria-label={t('common.close')}
        className="btn btn-circle btn-ghost absolute right-4 top-4 bg-white/10 text-white hover:bg-white/20"
      >
        <X size={20} />
      </button>
      {/* w-full, not max-w-full: IS serves these at 154×192 and a max-* rule
          alone leaves them at that size. Width drives, the aspect ratio sets
          the height, and max-h guards a short window. */}
      <img
        src={src}
        alt={alt}
        className="h-auto max-h-full w-full max-w-sm rounded-2xl object-contain shadow-drawer"
      />
    </div>,
    document.body
  );
}
