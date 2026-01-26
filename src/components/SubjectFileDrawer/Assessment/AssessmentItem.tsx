import { ExternalLink, Pencil, Check, X } from 'lucide-react';

interface AssessmentItemProps {
    index: number;
    test: any;
    isEditing: boolean;
    editMax: string;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    onEditMaxChange: (val: string) => void;
    values: { score: number; maxScore: number; isAdjusted: boolean };
}

export function AssessmentItem({ index, test, isEditing, editMax, onStartEdit, onCancelEdit, onSaveEdit, onEditMaxChange, values }: AssessmentItemProps) {
    return (
        <div className="px-4 py-3 hover:bg-base-200/30 transition-colors flex items-center gap-3">
            <div className="flex-1 min-w-0">
                <div className="font-medium text-base-content truncate" title={test.name}>{test.name}</div>
                <div className="text-sm text-base-content/50 mt-0.5">{test.submittedDate}{test.teacher && <span className="ml-2">• {test.teacher}</span>}</div>
            </div>
            <div className="text-right flex-shrink-0 min-w-[140px] flex items-center gap-2 justify-end">
                {isEditing ? (
                    <div className="flex items-center gap-1.5">
                        <div className="font-mono text-sm text-base-content/70 min-w-[50px] text-right">
                            {((test.score / test.maxScore) * (parseFloat(editMax) || test.maxScore)).toFixed(2).replace('.', ',')}
                        </div>
                        <span className="text-base-content/60">/</span>
                        <input type="text" inputMode="numeric" className="input input-xs input-bordered w-16 text-right" value={editMax} onChange={e => onEditMaxChange(e.target.value.replace(/[^0-9.]/g, ''))} autoFocus />
                        <button onClick={onSaveEdit} className="btn btn-ghost btn-xs text-success"><Check size={14} /></button>
                        <button onClick={onCancelEdit} className="btn btn-ghost btn-xs text-error"><X size={14} /></button>
                    </div>
                ) : (
                    <>
                        <div className={`font-mono font-semibold ${values.isAdjusted ? 'text-success' : 'text-base-content'}`}>
                            {values.score.toFixed(2).replace('.', ',')}<span className="text-base-content/40 text-sm font-normal"> / {values.maxScore}</span>
                        </div>
                        <button onClick={onStartEdit} className="btn btn-ghost btn-xs opacity-50 hover:opacity-100"><Pencil size={14} /></button>
                    </>
                )}
            </div>
            <div className="flex-shrink-0 min-w-[50px] text-right"><span className="badge badge-sm badge-ghost opacity-70">{Math.round((values.score / values.maxScore) * 100)}%</span></div>
            <div className="flex-shrink-0 w-8 text-right">
                {test.detailUrl ? <a href={`https://is.mendelu.cz/auth/student/list.pl${test.detailUrl}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-focus p-1 rounded hover:bg-primary/10 inline-block"><ExternalLink size={16} /></a> : <span className="text-base-content/10 p-1 inline-block"><ExternalLink size={16} /></span>}
            </div>
        </div>
    );
}
