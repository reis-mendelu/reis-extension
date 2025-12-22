import { useState, useEffect } from 'react';
import { useSuccessRate } from '../hooks/data/useSuccessRate';
import { Users, TrendingUp, Clock, AlertTriangle, LineChart, ExternalLink } from 'lucide-react';
import type { GradeStats } from '../types/documents';

interface SuccessRateTabProps {
    courseCode: string;
}

// Grade order for consistent styling
const GRADE_ORDER: (keyof GradeStats)[] = ['A', 'B', 'C', 'D', 'E', 'F', 'FN'];

// Helper: Get grade color from CSS variables
const getGradeColor = (grade: keyof GradeStats) => {
    // Fallback static colors in case CSS variables fail
    const fallbacks: Record<keyof GradeStats, string> = {
        A: '#10b981', B: '#34d399', C: '#84cc16', D: '#facc15', E: '#fb923c', F: '#ef4444', FN: '#dc2626'
    };
    return `var(--color-grade-${grade.toLowerCase()}, ${fallbacks[grade]})`;
};

// SVG Bar Chart for Grade Distribution
function GradeBarChart({ grades }: { grades: GradeStats }) {
    const data = GRADE_ORDER.map(grade => [grade, grades[grade] || 0] as [keyof GradeStats, number]);
    const max = Math.max(...data.map(([, val]) => val), 1);
    
    return (
        <div className="flex items-end justify-between h-40 gap-1.5 mt-8 px-1 pb-6 pt-8 bg-base-content/[0.02] rounded-xl relative">
            {data.map(([grade, value]) => {
                const height = (value / max) * 100;
                return (
                    <div key={grade} className="flex-1 flex flex-col items-center h-full justify-end relative">
                        {/* Student Count Label - pinned to bar top */}
                        {value > 0 && (
                            <span 
                                className="absolute text-[10px] font-black opacity-30 mb-1 transition-all duration-500 ease-out"
                                style={{ bottom: `calc(${height}% + 2px)` }}
                            >
                                {value}
                            </span>
                        )}
                        
                        {/* The Bar */}
                        <div 
                            className="w-full rounded-t-sm transition-all duration-500 ease-out hover:opacity-100"
                            style={{ 
                                height: `${height}%`, 
                                backgroundColor: getGradeColor(grade),
                                opacity: value === 0 ? 0.05 : 0.7
                            }}
                        />

                        {/* Grade Label */}
                        <span className="absolute -bottom-6 text-[10px] font-bold opacity-40">{grade}</span>
                    </div>
                );
            })}
        </div>
    );
}


export function SuccessRateTab({ courseCode }: SuccessRateTabProps) {
    const { stats: data, loading } = useSuccessRate(courseCode);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Auto-select latest semester
    useEffect(() => {
        if (data?.stats.length && !activeId) {
            const sortedByYear = [...data.stats].sort((a, b) => {
                if (b.year !== a.year) return b.year - a.year;
                return b.semesterName.localeCompare(a.semesterName);
            });
            // Use semesterId or semesterName as the unique identifier
            setActiveId(sortedByYear[0].semesterId || sortedByYear[0].semesterName);
        }
    }, [data, activeId]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-50">
            <span className="loading loading-spinner loading-md text-primary"></span>
            <span className="text-xs font-bold animate-pulse">Načítání statistik...</span>
        </div>
    );

    if (!data || !data.stats.length) return (
        <div className="flex flex-col items-center justify-center h-64 p-8 text-center glass-card rounded-2xl mx-4 my-8">
            <AlertTriangle className="w-12 h-12 text-warning mb-4 opacity-20" />
            <h3 className="text-lg font-black mb-2 opacity-80">Data nejsou k dispozici</h3>
            <p className="text-sm opacity-50 max-w-[240px]">Zatím jsme pro tento předmět nenashromáždili dostatek údajů o úspěšnosti.</p>
        </div>
    );

    // Reliable lookup using semesterId or semesterName
    const activeSemester = data.stats.find(s => (s.semesterId || s.semesterName) === activeId) || data.stats[0];
    const passRate = Math.round((activeSemester.totalPass / (activeSemester.totalPass + activeSemester.totalFail)) * 100) || 0;

    // Aggregate grades from all terms in active semester
    const activeGrades = activeSemester.terms.reduce((acc, term) => {
        Object.entries(term.grades).forEach(([grade, count]) => {
            const g = grade as keyof GradeStats;
            acc[g] = (acc[g] || 0) + count;
        });
        return acc;
    }, {} as GradeStats);

    const sortedStats = [...data.stats].sort((a, b) => {
        // Sort by year descending first
        if (a.year !== b.year) return b.year - a.year;
        // Within the same year, ZS (Winter) comes before LS (Summer) in descending order 
        // because ZS starts the academic year (e.g., ZS 24 vs LS 24)
        const isWinterA = a.semesterName.startsWith('ZS');
        const isWinterB = b.semesterName.startsWith('ZS');
        if (isWinterA && !isWinterB) return -1;
        if (!isWinterA && isWinterB) return 1;
        return 0;
    });

    return (
        <div className="flex flex-col gap-6 px-4 py-6 select-none animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Horizontal Gauges Row */}
            <div className="glass-card rounded-2xl p-6 shadow-xl overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                        <LineChart className="w-3 h-3" /> Historie úspěšnosti
                    </h3>
                </div>
                <div className="flex gap-6 overflow-x-auto py-5 -my-4 scrollbar-hide snap-x">
                    {sortedStats.map(s => {
                        const sid = s.semesterId || s.semesterName;
                        const total = s.totalPass + s.totalFail;
                        const sRate = Math.round((s.totalPass / total) * 100) || 0;
                        const isActive = sid === activeId;
                        
                        return (
                            <button 
                                key={sid}
                                onClick={() => setActiveId(sid)}
                                className={`flex flex-col items-center gap-2 snap-center transition-all ${isActive ? 'scale-110 opacity-100' : 'opacity-40 hover:opacity-70'}`}
                            >
                                <div className="relative w-12 h-12 flex items-center justify-center">
                                    <svg className="w-full h-full -rotate-90">
                                        <circle cx="24" cy="24" r="20" className="fill-none stroke-base-content/10" strokeWidth="4" />
                                        <circle 
                                            cx="24" cy="24" r="20" 
                                            className="fill-none stroke-primary transition-all duration-1000" 
                                            strokeWidth="4" 
                                            strokeDasharray={2 * Math.PI * 20}
                                            strokeDashoffset={2 * Math.PI * 20 * (1 - sRate / 100)}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <span className="absolute text-[10px] font-black">{sRate}%</span>
                                </div>
                                <div className="flex flex-col items-center -gap-1">
                                    <span className={`text-[10px] font-bold whitespace-nowrap ${isActive ? 'text-primary' : ''}`}>
                                        {s.semesterName.split(' ')[0]} {s.year.toString().slice(2)}
                                    </span>
                                    <span className="text-[8px] opacity-40 font-black tracking-tighter">{total}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Selected Semester Details */}
            <div className="glass-card rounded-2xl p-6 shadow-xl border-l-4 border-l-primary/50 relative overflow-hidden group">
                <div className="flex items-start justify-between relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="badge badge-primary badge-sm font-black rounded-sm">{activeSemester.year} {activeSemester.semesterName}</span>
                            {activeSemester.sourceUrl ? (
                                <a 
                                    href={activeSemester.sourceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 opacity-40 hover:opacity-100 hover:text-primary transition-all group/link"
                                    title="Zobrazit v IS MENDELU"
                                >
                                    <span className="text-[10px] font-bold uppercase tracking-tighter">Detaily období</span>
                                    <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                                </a>
                            ) : (
                                <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Detaily období</span>
                            )}
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">{passRate}% <span className="text-sm font-medium opacity-50">Úspěšnost</span></h2>
                    </div>
                    <div className="flex flex-col items-end gap-1 opacity-50">
                        <div className="flex items-center gap-1 text-xs">
                            <Users className="w-3 h-3" />
                            <span className="font-bold">{activeSemester.totalPass + activeSemester.totalFail}</span>
                        </div>
                        <span className="text-[9px] uppercase font-black">Studentů</span>
                    </div>
                </div>

                <div className="mt-8">
                    <div className="flex items-baseline justify-between mb-2">
                        <h3 className="text-xs font-bold opacity-40">Rozložení známek</h3>
                        <div className="flex gap-4">
                             <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                                <span className="text-[10px] font-bold opacity-40">Prospělo: {activeSemester.totalPass}</span>
                             </div>
                             <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                                <span className="text-[10px] font-bold opacity-40">Neprospělo: {activeSemester.totalFail}</span>
                             </div>
                        </div>
                    </div>
                    <GradeBarChart grades={activeGrades} />
                </div>

                {/* Subtle Background Icon */}
                <TrendingUp className="absolute -bottom-4 -right-4 w-32 h-32 opacity-[0.03] rotate-12" />
            </div>

            {/* Footer with Timestamp */}
            <div className="flex items-center justify-center gap-1.5 opacity-20 hover:opacity-40 transition-opacity">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-medium italic">Data aktualizována: {new Date(data.lastUpdated).toLocaleDateString('cs-CZ')}</span>
            </div>
        </div>
    );
}
