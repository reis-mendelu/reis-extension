import { useEffect } from 'react';
import { Pin, ExternalLink, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

const VYVESKA_URL = 'https://is.mendelu.cz/auth/vyveska/nove_prispevky.pl?zalozka=2';

const CATEGORY_STYLES: Record<string, string> = {
    'Ubytování':  'bg-info/10 text-info border-info/20',
    'Housing':    'bg-info/10 text-info border-info/20',
    'Ostatní':    'bg-base-content/5 text-base-content/50 border-base-300',
    'Other':      'bg-base-content/5 text-base-content/50 border-base-300',
    'Inzerce':    'bg-primary/10 text-primary border-primary/20',
    'Notice':     'bg-primary/10 text-primary border-primary/20',
    'Nabízím':    'bg-success/10 text-success border-success/20',
    'Offered':    'bg-success/10 text-success border-success/20',
    'Hledám':     'bg-warning/10 text-warning border-warning/20',
    'Wanted':     'bg-warning/10 text-warning border-warning/20',
};

function categoryStyle(cat: string | undefined): string {
    if (!cat) return 'bg-base-content/5 text-base-content/50 border-base-300';
    return CATEGORY_STYLES[cat] ?? 'bg-base-content/5 text-base-content/50 border-base-300';
}

export function BulletinBanner({ inline = false }: { inline?: boolean }) {
    const { t } = useTranslation();
    const posts = useAppStore(s => s.bulletinPosts);
    const expanded = useAppStore(s => s.bulletinExpanded);
    const loading = useAppStore(s => s.bulletinLoading);
    const error = useAppStore(s => s.bulletinError);
    const setExpanded = useAppStore(s => s.setBulletinExpanded);
    const loadIfStale = useAppStore(s => s.loadBulletinIfStale);

    useEffect(() => {
        if (expanded) void loadIfStale();
    }, [expanded, loadIfStale]);

    if (!inline) return null;

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
                <button
                    type="button"
                    onClick={() => { void setExpanded(false); }}
                    aria-label={t('bulletin.collapse')}
                    className="flex items-center gap-1.5 px-3 flex-shrink-0 border-r border-base-300 hover:bg-base-200/60 transition-colors"
                >
                    <Pin className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="text-xs font-semibold text-base-content whitespace-nowrap">{t('bulletin.title')}</span>
                </button>

                <div className="flex-1 flex flex-col overflow-y-auto min-w-0" style={{ maxHeight: '96px' }}>
                    {loading && posts.length === 0 && (
                        <div className="flex items-center px-3 py-1.5 text-xs text-base-content/50">{t('bulletin.loading')}</div>
                    )}
                    {!loading && error && posts.length === 0 && (
                        <div className="flex items-center px-3 py-1.5 text-xs text-error/80">{t('bulletin.error')}</div>
                    )}
                    {!loading && !error && posts.length === 0 && (
                        <div className="flex items-center px-3 py-1.5 text-xs text-base-content/50">{t('bulletin.empty')}</div>
                    )}
                    {posts.map((post, i) => {
                        const cat = post.categories[post.categories.length - 1] ?? post.categories[0];
                        return (
                            <a
                                key={`${post.url}-${i}`}
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 px-3 py-1.5 hover:bg-base-200/60 transition-colors group/post ${
                                    i < posts.length - 1 ? 'border-b border-base-300/50' : ''
                                }`}
                            >
                                <span className="w-1 h-1 rounded-full bg-primary/40 group-hover/post:bg-primary flex-shrink-0 transition-colors" />
                                <span className="flex-1 text-xs text-base-content/70 group-hover/post:text-base-content transition-colors truncate">
                                    {post.title}
                                </span>
                                {cat && (
                                    <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${categoryStyle(cat)}`}>
                                        {cat}
                                    </span>
                                )}
                            </a>
                        );
                    })}
                </div>

                <div className="flex items-center gap-1 px-2 flex-shrink-0 border-l border-base-300">
                    <a
                        href={VYVESKA_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-base-content/40 hover:text-primary transition-colors whitespace-nowrap"
                    >
                        {t('bulletin.showAll')}
                        <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                        type="button"
                        onClick={() => { void setExpanded(false); }}
                        aria-label={t('bulletin.collapse')}
                        className="flex items-center justify-center w-6 h-6 rounded-md text-base-content/30 hover:text-base-content/70 hover:bg-base-300/60 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}
