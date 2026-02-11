import type { SemesterStats } from '../../types/documents';

interface SemesterSelectorProps {
    stats: SemesterStats[];
    activeIndex: number;
    onSelect: (index: number) => void;
}

export function SemesterSelector({ stats, activeIndex, onSelect }: SemesterSelectorProps) {
    const format = (y: number, s: string) => `${s.startsWith('ZS') ? 'ZS' : 'LS'} ${y % 100}/${(y % 100) + 1}`;
    return (
        <div className="flex justify-center gap-4 mt-auto">
            {stats.map((s, i) => {
                const total = s.totalPass + s.totalFail, rate = Math.round((s.totalPass / total) * 100) || 0, active = i === activeIndex;
                return (
                    <button key={`${s.year}-${s.semesterName}`} onClick={() => onSelect(i)}
                            className={`flex flex-col items-center gap-2 px-3 py-2 rounded-xl transition-all ${active ? 'bg-primary/10 ring-1 ring-primary/30' : 'text-base-content/40 hover:bg-base-200'}`}>
                        <div className="relative w-12 h-12 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 32 32">
                                <circle cx="16" cy="16" r="13" className="fill-none stroke-base-content/10" strokeWidth="3" />
                                <circle cx="16" cy="16" r="13" className={`fill-none transition-base ${active ? 'stroke-success' : 'stroke-success/40'}`} strokeWidth="3" strokeDasharray={2 * Math.PI * 13} strokeDashoffset={2 * Math.PI * 13 * (1 - rate / 100)} strokeLinecap="round" />
                            </svg>
                            <span className="absolute text-2xs font-black">{rate}%</span>
                        </div>
                        <span className={`text-2xs font-black ${active ? 'text-primary' : ''}`}>{format(s.year, s.semesterName)}</span>
                    </button>
                );
            })}
        </div>
    );
}
