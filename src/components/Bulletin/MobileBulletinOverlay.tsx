import { useEffect } from 'react';
import { ArrowLeft, ExternalLink, Pin } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../hooks/useTranslation';
import type { BulletinPost } from '../../types/bulletin';
import { BulletinList } from './BulletinList';

const VYVESKA_URL = 'https://is.mendelu.cz/auth/vyveska/nove_prispevky.pl?zalozka=2';

interface MobileBulletinOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  posts: BulletinPost[];
  loading: boolean;
  error: boolean;
}

export function MobileBulletinOverlay({
  isOpen,
  onClose,
  posts,
  loading,
  error,
}: MobileBulletinOverlayProps) {
  const { t } = useTranslation();

  // Mirror the desktop dropdown's Escape-to-close + lock the page underneath so
  // background scrolling and rubber-banding don't bleed through the overlay.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <div
      // No `md:hidden` here. Both callers have already decided this is the
      // mobile surface in JS — BulletinBanner only renders it under `isNarrow`
      // (max-width: 767px), and CalendarScreen sits in the phone tree, which
      // the native app renders at ANY width. A width-based second gate did
      // nothing in the extension and made this `display: none` on iPad, where
      // tapping the pin mounted a 0x0 overlay and looked like a dead button.
      className="fixed inset-0 z-50 bg-base-100 flex flex-col"
      // Full-screen and top-anchored: at targetSdk 36 the WebView draws under
      // the status bar and camera cutout, so this surface must inset itself.
      // --safe-top is 0 off-device, making this a no-op on desktop.
      style={{ paddingTop: 'var(--safe-top, 0px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-base-200 rounded-lg transition-colors"
            aria-label={t('bulletin.collapse')}
          >
            <ArrowLeft className="w-5 h-5 text-base-content/70" />
          </button>
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-primary" />
            <h1 className="text-base font-bold text-base-content">{t('bulletin.title')}</h1>
          </div>
        </div>
        <a
          href={VYVESKA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 hover:bg-base-200 rounded-lg text-base-content/70 hover:text-primary transition-colors"
          aria-label={t('bulletin.showAll')}
          title={t('bulletin.showAll')}
        >
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>

      {/* Body List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <BulletinList posts={posts} loading={loading} error={error} />
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
