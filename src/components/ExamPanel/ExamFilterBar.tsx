import { Check, X } from 'lucide-react';

export type StatusFilter = 'registered' | 'available' | 'opening';

interface FilterCounts {
    registered: number;
    available: number;
    opening: number;
}

interface SubjectOption {
    code: string;
    name: string;
}

interface ExamFilterBarProps {
    statusFilter: StatusFilter[];
    selectedSubjects: string[];
    filterCounts: FilterCounts;
    subjectOptions: SubjectOption[];
    onToggleStatus: (status: StatusFilter) => void;
    onToggleSubject: (code: string) => void;
    onClearFilters: () => void;
}

export function ExamFilterBar({
    statusFilter,
    selectedSubjects,
    filterCounts,
    subjectOptions,
    onToggleStatus,
    onToggleSubject,
    onClearFilters
}: ExamFilterBarProps) {
    const hasActiveFilters = statusFilter.length > 0 || selectedSubjects.length > 0;

    return (
        <div className="px-6 py-1.5 border-b border-base-200 space-y-1.5 bg-base-50/30">
            {/* Status Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/40 mr-1">Status:</span>
                <FilterChip
                    active={statusFilter.includes('registered')}
                    onClick={() => onToggleStatus('registered')}
                    label="Přihlášen"
                    count={filterCounts.registered}
                />
                <FilterChip
                    active={statusFilter.includes('available')}
                    onClick={() => onToggleStatus('available')}
                    label="Volné"
                    count={filterCounts.available}
                />
                <FilterChip
                    active={statusFilter.includes('opening')}
                    onClick={() => onToggleStatus('opening')}
                    label="Otevírá se"
                    count={filterCounts.opening}
                />
            </div>

            {/* Subject Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/40 mr-1">Předmět:</span>
                {subjectOptions.map(({ code, name }) => (
                    <FilterChip
                        key={code}
                        active={selectedSubjects.includes(code)}
                        onClick={() => onToggleSubject(code)}
                        label={name}
                    />
                ))}
                
                {hasActiveFilters && (
                    <button
                        onClick={onClearFilters}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-error/70 hover:text-error hover:bg-error/5 transition-colors ml-1"
                    >
                        <X size={14} />
                        Vymazat vše
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * Reusable Minimalist Filter Chip
 */
interface FilterChipProps {
    active: boolean;
    onClick: () => void;
    label: string;
    count?: number;
}

function FilterChip({ active, onClick, label, count }: FilterChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer
                ${active 
                    ? 'bg-primary text-primary-content shadow-sm' 
                    : 'bg-base-200/50 text-base-content/60 hover:bg-base-200 hover:text-base-content'
                }
            `}
        >
            <div className="flex items-center gap-1.5 pointer-events-none">
                {active && <Check size={14} className="animate-in zoom-in duration-300" />}
                <span>{label}</span>
                {count !== undefined && (
                    <span className={`
                        ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold
                        ${active ? 'bg-primary-content/20 text-primary-content' : 'bg-base-300/50 text-base-content/40'}
                    `}>
                        {count}
                    </span>
                )}
            </div>
        </button>
    );
}
