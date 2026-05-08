import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { VtTestAttempt } from '../../../types/zaznamnik';

function scoreChipClass(pct: number): string {
    if (pct >= 60) return 'badge-success';
    if (pct >= 40) return 'badge-warning';
    return 'badge-error';
}

interface Props {
    name: string;
    attempts: VtTestAttempt[];
}

export function VtTestGroup({ name, attempts }: Props) {
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
