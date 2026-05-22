import { useState } from 'react';
import { Pin, ExternalLink, X } from 'lucide-react';

const MOCK_POSTS = [
    {
        id: 1,
        title: 'Dlouhodobý pronájem pokoje v domě se zahradou – Rostlinná 5, Brno',
        category: 'Ubytování',
        tag: 'Nabízím',
        url: '#',
    },
    {
        id: 2,
        title: 'Hledá se parťák / partačka NA TURISTIKU DO RAXŮ',
        category: 'Ostatní',
        tag: 'Nabízím',
        url: '#',
    },
    {
        id: 3,
        title: 'Pokoj k pronájmu – Černá Pole, Brno-sever',
        category: 'Ubytování',
        tag: 'Nabízím',
        url: '#',
    },
    {
        id: 4,
        title: 'Rezervuj si bydlení na příští semestr už teď',
        category: 'Ubytování',
        tag: 'Nabízím',
        url: '#',
    },
    {
        id: 5,
        title: '🌱 Prodej rostlin Eukalyptu 🌱',
        category: 'Inzerce',
        tag: 'Nabízím',
        url: '#',
    },
];

const CATEGORY_STYLES: Record<string, string> = {
    'Ubytování':  'bg-info/10 text-info border-info/20',
    'Ostatní':    'bg-base-content/5 text-base-content/50 border-base-300',
    'Inzerce':    'bg-primary/10 text-primary border-primary/20',
    'Nabízím':    'bg-success/10 text-success border-success/20',
    'Hledám':     'bg-warning/10 text-warning border-warning/20',
};

function categoryStyle(cat: string): string {
    return CATEGORY_STYLES[cat] ?? 'bg-base-content/5 text-base-content/50 border-base-300';
}

export function BulletinBanner({ inline = false }: { inline?: boolean }) {
    const [dismissed, setDismissed] = useState(false);
    const [expanded, setExpanded] = useState(false);

    if (dismissed) return inline ? <div className="flex-1" /> : null;

    if (inline && !expanded) {
        return (
            <div className="flex-1 flex items-center min-w-0 px-3">
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-base-100/60 border border-base-300 rounded-lg hover:bg-base-200/60 transition-colors"
                >
                    <Pin className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="text-xs font-semibold text-base-content whitespace-nowrap">Vývěska</span>
                </button>
            </div>
        );
    }

    if (inline) {
        return (
            <div className="flex-1 flex items-stretch min-w-0 px-3">
                <div className="flex w-full bg-base-100/60 border border-base-300 rounded-lg overflow-hidden">
                    {/* Label — click to collapse */}
                    <button
                        type="button"
                        onClick={() => setExpanded(false)}
                        className="flex items-center gap-1.5 px-3 flex-shrink-0 border-r border-base-300 hover:bg-base-200/60 transition-colors"
                    >
                        <Pin className="w-3 h-3 text-primary flex-shrink-0" />
                        <span className="text-xs font-semibold text-base-content whitespace-nowrap">Vývěska</span>
                    </button>

                    {/* Vertical posts */}
                    <div className="flex-1 flex flex-col overflow-y-auto min-w-0" style={{ maxHeight: '96px' }}>
                        {MOCK_POSTS.map((post, i) => (
                            <a
                                key={post.id}
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 px-3 py-1.5 hover:bg-base-200/60 transition-colors group/post ${
                                    i < MOCK_POSTS.length - 1 ? 'border-b border-base-300/50' : ''
                                }`}
                            >
                                <span className="w-1 h-1 rounded-full bg-primary/40 group-hover/post:bg-primary flex-shrink-0 transition-colors" />
                                <span className="flex-1 text-xs text-base-content/70 group-hover/post:text-base-content transition-colors truncate">
                                    {post.title}
                                </span>
                                <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${categoryStyle(post.category)}`}>
                                    {post.category}
                                </span>
                            </a>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 px-2 flex-shrink-0 border-l border-base-300">
                        <a
                            href="https://is.mendelu.cz/auth/vyveska/index.pl"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-base-content/40 hover:text-primary transition-colors whitespace-nowrap"
                        >
                            Zobrazit vše
                            <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                            type="button"
                            onClick={() => setDismissed(true)}
                            className="flex items-center justify-center w-6 h-6 rounded-md text-base-content/30 hover:text-base-content/70 hover:bg-base-300/60 transition-colors"
                            aria-label="Zavřít"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-4 mt-3 bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-base-300 bg-base-200/40">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
                    <Pin className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-base-content tracking-tight flex-1">
                    Vývěska
                </span>
                <a
                    href="https://is.mendelu.cz/auth/vyveska/index.pl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-base-content/40 hover:text-primary transition-colors"
                >
                    Zobrazit vše
                    <ExternalLink className="w-3 h-3" />
                </a>
                <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    className="ml-1 flex items-center justify-center w-6 h-6 rounded-md text-base-content/30 hover:text-base-content/70 hover:bg-base-300/60 transition-colors"
                    aria-label="Zavřít"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: '108px' }}>
                {MOCK_POSTS.map((post, i) => (
                    <a
                        key={post.id}
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 px-4 py-2 hover:bg-base-200/50 transition-colors group ${
                            i < MOCK_POSTS.length - 1 ? 'border-b border-base-300/50' : ''
                        }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary flex-shrink-0 transition-colors" />
                        <span className="flex-1 text-sm text-base-content/75 truncate group-hover:text-base-content transition-colors">
                            {post.title}
                        </span>
                        <span className={`flex-shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded border ${categoryStyle(post.category)}`}>
                            {post.category}
                        </span>
                    </a>
                ))}
            </div>
        </div>
    );
}
