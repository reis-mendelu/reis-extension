import { useState } from 'react';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { useZaznamnik } from '../../hooks/data/useZaznamnik';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { VtTestAttempt } from '../../types/zaznamnik';

interface ZaznamnikTabProps {
    courseCode: string;
}

function scoreChipClass(pct: number): string {
    if (pct >= 60) return 'badge-success';
    if (pct >= 40) return 'badge-warning';
    return 'badge-error';
}

function VtTestGroup({ name, attempts }: { name: string; attempts: VtTestAttempt[] }) {
    const [expanded, setExpanded] = useState(false);
    const best = attempts.reduce((a, b) => b.successPct > a.successPct ? b : a, attempts[0]);
    const showToggle = attempts.length > 1;

    return (
        <div className="bg-base-200/60 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 gap-2">
                <span className="text-[12px] font-semibold text-base-content/80 flex-1 min-w-0 truncate">{name}</span>
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge badge-sm ${scoreChipClass(best.successPct)}`}>
                        {best.score}/{best.maxScore} ({best.successPct}%)
                    </span>
                    {showToggle && (
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="btn btn-ghost btn-xs gap-1 text-base-content/50 hover:text-base-content/80 normal-case font-normal"
                        >
                            {attempts.length}×
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}
                </div>
            </div>
            {(expanded || !showToggle) && (
                <div className="border-t border-base-300 divide-y divide-base-300">
                    {attempts.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                            <span className={`badge badge-xs ${scoreChipClass(a.successPct)}`}>
                                {a.score}/{a.maxScore}
                            </span>
                            <span className="text-[11px] text-base-content/60">{a.submittedAt}</span>
                            {a.teacher && <span className="text-[11px] text-base-content/40 ml-auto truncate max-w-[120px]">{a.teacher}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ZaznamnikTab({ courseCode }: ZaznamnikTabProps) {
    const { data, isLoading } = useZaznamnik(courseCode);
    const subjectInfo = useAppStore(s => courseCode ? s.subjects?.data[courseCode] : undefined);
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <div className="p-4 space-y-3 animate-pulse">
                <div className="h-4 bg-base-300 rounded w-1/3" />
                <div className="h-10 bg-base-300 rounded" />
                <div className="h-10 bg-base-300 rounded" />
                <div className="h-4 bg-base-300 rounded w-1/4 mt-4" />
                <div className="h-10 bg-base-300 rounded" />
            </div>
        );
    }

    if (!data || (!data.ph.sections.length && !data.vt.tests.length)) {
        const hasFlags = subjectInfo?.hasPrubezne || subjectInfo?.hasTest;
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 opacity-40 text-center">
                <ClipboardList className="w-12 h-12 mb-3" />
                <p className="text-sm">{hasFlags ? t('zaznamnik.noData') : t('zaznamnik.noAssessment')}</p>
            </div>
        );
    }

    const nonEmptyArches = data.ph.sections.flatMap(s => s.arches.filter(a => !a.empty));
    const vtTests = data.vt.tests;

    // Group VT tests by name
    const vtGroups: { name: string; attempts: VtTestAttempt[] }[] = [];
    for (const test of vtTests) {
        const existing = vtGroups.find(g => g.name === test.name);
        if (existing) {
            existing.attempts.push(test);
        } else {
            vtGroups.push({ name: test.name, attempts: [test] });
        }
    }

    return (
        <div className="h-full overflow-y-auto p-4 space-y-5 text-[13px]">
            {data.ph.sections.some(s => s.arches.some(a => !a.empty)) && (
                <div className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-base-content/40">
                        {t('zaznamnik.phSection')}
                    </p>
                    {data.ph.sections.map((section, si) => (
                        <div key={si} className="space-y-2">
                            {section.label && (
                                <p className="text-[11px] text-base-content/50 font-medium">{section.label}</p>
                            )}
                            {section.arches.map((arch, ai) => (
                                <div key={ai} className="bg-base-200/60 rounded-lg px-3 py-2">
                                    <p className="text-[11px] font-semibold text-base-content/60 mb-1">{arch.name}</p>
                                    {arch.empty ? (
                                        <p className="text-[12px] text-base-content/30">—</p>
                                    ) : arch.columns.length === 1 ? (
                                        <p className="text-[12px] font-medium text-base-content">
                                            <span className="text-base-content/50">{arch.columns[0]}: </span>
                                            {arch.values[0]}
                                        </p>
                                    ) : (
                                        <div className="grid gap-x-4 gap-y-0.5" style={{ gridTemplateColumns: `repeat(${arch.columns.length}, minmax(0, 1fr))` }}>
                                            {arch.columns.map((col, ci) => (
                                                <p key={ci} className="text-[10px] text-base-content/40 truncate">{col}</p>
                                            ))}
                                            {arch.values.map((val, vi) => (
                                                <p key={vi} className="text-[12px] font-medium text-base-content truncate">{val}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {vtGroups.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-base-content/40">
                        {t('zaznamnik.vtSection')} · {vtTests.length}
                    </p>
                    {vtGroups.map((group, i) => (
                        <VtTestGroup key={i} name={group.name} attempts={group.attempts} />
                    ))}
                </div>
            )}

            {nonEmptyArches.length === 0 && vtGroups.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full p-6 opacity-40 text-center">
                    <ClipboardList className="w-12 h-12 mb-3" />
                    <p className="text-sm">{t('zaznamnik.noData')}</p>
                </div>
            )}
        </div>
    );
}
