import { ExternalLink } from 'lucide-react';

export interface PageGroupItem {
    id: string;
    label: string;
    href: string;
}

export interface PageGroup {
    id: string;
    label: string;
    items: PageGroupItem[];
}

interface PageGroupListProps {
    groups: PageGroup[];
    onOpen: (href: string) => void;
}

/**
 * Category-headed list of IS pages. Drives both the browse state (all of
 * `pagesData`) and the filtered search state (only the matching categories/
 * items) — the caller decides which groups to pass in, this component only
 * renders them.
 */
export function PageGroupList({ groups, onOpen }: PageGroupListProps) {
    return (
        <div className="flex flex-col">
            {groups.map((group) => (
                <div key={group.id}>
                    <div className="px-4 pb-0.5 pt-3 text-2xs font-bold uppercase tracking-wider text-base-content/60">
                        {group.label}
                    </div>
                    {group.items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onOpen(item.href)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                        >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                            <ExternalLink size={14} className="flex-shrink-0 text-base-content/40" />
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
}
