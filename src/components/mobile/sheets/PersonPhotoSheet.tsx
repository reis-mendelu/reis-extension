import { useEffect } from 'react';
import { X } from 'lucide-react';
import { usePersonPhoto } from '../../../hooks/data/usePersonPhoto';
import { useTranslation } from '../../../hooks/useTranslation';
import type { MobileSheet } from '../../../store/types';

type PersonPhotoSheetData = Extract<MobileSheet, { kind: 'personPhoto' }>;

export interface PersonPhotoSheetProps {
  sheet: PersonPhotoSheetData;
  onClose: () => void;
}

/**
 * The person's photo, as large as the screen allows.
 *
 * A lightbox rather than a bottom sheet — a face is the whole content, so the
 * vocabulary of a panel sliding over the page is wrong. It still lives in the
 * sheet STACK, which is what makes Android's back button close the photo and
 * return to the person, instead of dismissing both at once.
 *
 * IS's own images are small (roughly 180px wide), so `object-contain` inside a
 * generous box is deliberate: it scales up to fill the screen but never crops
 * the face to do it.
 */
export function PersonPhotoSheet({ sheet, onClose }: PersonPhotoSheetProps) {
  const { t } = useTranslation();
  const photo = usePersonPhoto(sheet.personId);

  // The avatar that opened this had already resolved a photo, and the hook
  // caches per session — so a null here means the entry was evicted or the
  // fetch failed, and there is nothing to maximise. Close rather than present
  // an empty black screen the student has to dismiss.
  useEffect(() => {
    if (!photo) onClose();
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div
      data-testid="person-photo-overlay"
      onClick={onClose}
      className="absolute inset-0 z-[70] flex items-center justify-center bg-black/90 p-6 animate-[fadeIn_0.2s_ease-out]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('mobile.sheet.close')}
        className="absolute right-4 top-[calc(1rem+var(--safe-top,0px))] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <X className="h-5 w-5" />
      </button>
      {/* w-full, not max-w-full: IS serves these at 154×192, and a max-* rule
          alone leaves the photo at that size — a 154px card floating in a 411px
          screen, barely larger than the avatar that opened it. Width drives,
          height follows the aspect ratio, with max-h as the guard for the rare
          landscape scan. */}
      <img
        src={photo}
        alt={sheet.name}
        className="h-auto max-h-full w-full max-w-sm rounded-2xl object-contain shadow-drawer"
      />
    </div>
  );
}
