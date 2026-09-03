import { Pin } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { BulletinPost } from '../../types/bulletin';

const DOT_COLOR: Record<string, string> = {
  Ubytování: 'bg-info',
  Housing: 'bg-info',
  Inzerce: 'bg-primary',
  Notice: 'bg-primary',
  Nabízím: 'bg-success',
  Offered: 'bg-success',
  Prodám: 'bg-success',
  Hledám: 'bg-warning',
  Wanted: 'bg-warning',
  Koupím: 'bg-warning',
  Ostatní: 'bg-base-content/40',
  Other: 'bg-base-content/40',
};

function dotColor(cat: string | undefined): string {
  if (!cat) return 'bg-base-content/40';
  return DOT_COLOR[cat] ?? 'bg-base-content/40';
}

export interface BulletinListProps {
  posts: BulletinPost[];
  loading: boolean;
  error: boolean;
}

/**
 * The noticeboard's posts, with its loading, error and empty states.
 *
 * Extracted so the two surfaces that show it share one list rather than one
 * copying the other. It is rendered by `BulletinSheet` on the phone, which is
 * in the app's shared sheet stack, and by `MobileBulletinOverlay` for the
 * extension's narrow window, which is not a sheet at all.
 *
 * The links stay plain `target="_blank"` anchors: `installExternalLinkHandler`
 * intercepts them app-wide and routes IS pages through the in-app browser with
 * the student's session attached, so a post opens already signed in. Handling
 * the click here would bypass that and reintroduce, per surface, the very thing
 * the document-level handler exists to make impossible.
 */
export function BulletinList({ posts, loading, error }: BulletinListProps) {
  const { t } = useTranslation();
  return (
    <>
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
        <div
          className="alert alert-error shadow-sm rounded-xl text-sm"
          data-testid="bulletin-error"
        >
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
    </>
  );
}
