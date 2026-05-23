import { useEffect } from 'react';
import { Pin, ExternalLink, X, ArrowUpRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useIsMobile } from '../ui/use-mobile';
import { MobileBulletinOverlay } from './MobileBulletinOverlay';

const VYVESKA_URL = 'https://is.mendelu.cz/auth/vyveska/nove_prispevky.pl?zalozka=2';

// Dot color keyed by the post's most specific category. Same info the chip
// carried, in ~6px instead of ~80px per row.
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

export function BulletinBanner({ inline = false }: { inline?: boolean }) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const posts = useAppStore(s => s.bulletinPosts);
    const expanded = useAppStore(s => s.bulletinExpanded);
    const loading = useAppStore(s => s.bulletinLoading);
    const error = useAppStore(s => s.bulletinError);
    const hydrated = useAppStore(s => s.bulletinHydrated);
    const setExpanded = useAppStore(s => s.setBulletinExpanded);
    const loadIfStale = useAppStore(s => s.loadBulletinIfStale);

    useEffect(() => {
        // Wait until hydrate finishes before consulting the cache; otherwise a
        // user click during the hydrate microtask fires loadIfStale against
        // default state (fetchedAt=null) and races the IDB-restored values.
        if (expanded && hydrated) void loadIfStale();
    }, [expanded, hydrated, loadIfStale]);

    if (!inline) return null;

    if (isMobile) {
        return (
            <div className="flex-1 flex items-center min-w-0 px-3">
                <button
                    type="button"
                    onClick={() => { void setExpanded(true); }}
                    aria-label={t('bulletin.expand')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-base-100/60 border border-base-300 rounded-lg hover:bg-base-200/60 transition-colors"
                >
                    <Pin className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="text-xs font-semibold text-base-content whitespace-nowrap">{t('bulletin.title')}</span>
                </button>
                <MobileBulletinOverlay
                    isOpen={expanded}
                    onClose={() => { void setExpanded(false); }}
                    posts={posts}
                    loading={loading}
                    error={error}
                />
            </div>
        );
    }

    if (!expanded) {
        return (
            <div className="flex-1 flex items-center min-w-0 px-3">
                <button
                    type="button"
                    onClick={() => { void setExpanded(true); }}
                    aria-label={t('bulletin.expand')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-base-100/60 border border-base-300 rounded-lg hover:bg-base-200/60 transition-colors"
                >
                    <Pin className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="text-xs font-semibold text-base-content whitespace-nowrap">{t('bulletin.title')}</span>
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex items-stretch min-w-0 px-3">
            <div className="flex w-full bg-base-100/60 border border-base-300 rounded-lg overflow-hidden">
                <div className="flex-1 flex flex-col overflow-y-auto min-w-0" style={{ maxHeight: '64px' }}>
                    {loading && posts.length === 0 && (
                        <div className="h-8 flex items-center px-3 text-xs text-base-content/50">{t('bulletin.loading')}</div>
                    )}
                    {!loading && error && posts.length === 0 && (
                        <div className="h-8 flex items-center px-3 text-xs text-error/80">{t('bulletin.error')}</div>
                    )}
                    {!loading && !error && posts.length === 0 && (
                        <div className="h-8 flex items-center px-3 text-xs text-base-content/50">{t('bulletin.empty')}</div>
                    )}
                    {posts.map((post, i) => {
                        const cat = post.categories[post.categories.length - 1] ?? post.categories[0];
                        return (
                            <a
                                key={`${post.url}-${i}`}
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={cat ? `${post.title} · ${cat}` : post.title}
                                className={`h-8 flex items-center justify-between gap-2 px-3 hover:bg-base-200/60 transition-colors group/post ${
                                    i < posts.length - 1 ? 'border-b border-base-300/50' : ''
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all group-hover/post:scale-125 ${dotColor(cat)}`} />
                                    <span className="flex-1 text-xs text-base-content/75 group-hover/post:text-base-content transition-colors truncate">
                                        {post.title}
                                    </span>
                                </div>
                                <ArrowUpRight className="w-3.5 h-3.5 text-base-content/30 opacity-0 group-hover/post:opacity-100 group-hover/post:translate-x-0.5 transition-all duration-200 flex-shrink-0" />
                            </a>
                        );
                    })}
                </div>

                <div className="flex items-stretch flex-shrink-0 border-l border-base-300">
                    <a
                        href={VYVESKA_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('bulletin.showAll')}
                        title={t('bulletin.showAll')}
                        className="flex items-center justify-center w-8 text-base-content/40 hover:text-primary hover:bg-base-200/60 transition-colors"
                    >
                        <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                        type="button"
                        onClick={() => { void setExpanded(false); }}
                        aria-label={t('bulletin.collapse')}
                        title={t('bulletin.collapse')}
                        className="flex items-center justify-center w-8 text-base-content/40 hover:text-base-content/80 hover:bg-base-200/60 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}
