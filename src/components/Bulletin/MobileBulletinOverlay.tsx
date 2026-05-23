import { useEffect } from 'react';
import { ArrowLeft, ExternalLink, Pin } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../hooks/useTranslation';
import type { BulletinPost } from '../../types/bulletin';

const VYVESKA_URL = 'https://is.mendelu.cz/auth/vyveska/nove_prispevky.pl?zalozka=2';

const DOT_COLOR: Record<string, string> = {
  'Ubytování': 'bg-info',
  'Housing':   'bg-info',
  'Inzerce':   'bg-primary',
  'Notice':    'bg-primary',
  'Nabízím':   'bg-success',
  'Offered':   'bg-success',
  'Prodám':    'bg-success',
  'Hledám':    'bg-warning',
  'Wanted':    'bg-warning',
  'Koupím':    'bg-warning',
  'Ostatní':   'bg-base-content/40',
  'Other':     'bg-base-content/40',
};

function dotColor(cat: string | undefined): string {
  if (!cat) return 'bg-base-content/40';
  return DOT_COLOR[cat] ?? 'bg-base-content/40';
}

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
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
    <div className="fixed inset-0 z-50 bg-base-100 flex flex-col md:hidden">
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
            <h1 className="text-base font-bold text-base-content">
              {t('bulletin.title')}
            </h1>
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
        {loading && posts.length === 0 && (
          <div className="space-y-3" data-testid="bulletin-loading">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-2 p-4 bg-base-200/40 border border-base-300/50 rounded-xl animate-pulse"
              >
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-base-300 rounded animate-pulse" />
                  <div className="h-5 w-20 bg-base-300 rounded animate-pulse" />
                </div>
                <div className="h-4 bg-base-300 rounded w-5/6 mt-1 animate-pulse" />
                <div className="h-4 bg-base-300 rounded w-2/3 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && posts.length === 0 && (
          <div className="alert alert-error shadow-sm rounded-xl text-sm" data-testid="bulletin-error">
            <span>{t('bulletin.error')}</span>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 text-center text-base-content/50 gap-2"
            data-testid="bulletin-empty"
          >
            <Pin className="w-8 h-8 opacity-40 text-base-content" />
            <p className="text-sm font-medium">{t('bulletin.empty')}</p>
          </div>
        )}

        {posts.map((post, idx) => {
          const mainCategory = post.categories[post.categories.length - 1] ?? post.categories[0];
          return (
            <a
              key={`${post.url}-${idx}`}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2 p-4 bg-base-200/50 hover:bg-base-200 border border-base-300/70 hover:border-base-content/20 rounded-xl transition-all"
            >
              {/* Categories */}
              {post.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(mainCategory)}`} />
                  {post.categories.map((cat, cIdx) => (
                    <span
                      key={cIdx}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        cIdx === post.categories.length - 1
                          ? 'bg-primary/10 text-primary'
                          : 'bg-base-300/80 text-base-content/60'
                      }`}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
              {/* Title */}
              <h2 className="text-sm font-semibold text-base-content/90 group-hover:text-base-content transition-colors leading-snug">
                {post.title}
              </h2>
            </a>
          );
        })}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
