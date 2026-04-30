import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { SubjectAttendance } from '../../types/documents';

function countPresent(groups: SubjectAttendance[]): { present: number; total: number } {
    let present = 0, total = 0;
    for (const g of groups) {
        for (const r of g.records) {
            total++;
            if (r.status === 'present' || r.status === 'elsewhere') present++;
        }
    }
    return { present, total };
}

function shortDate(d: string): string {
    const match = d.match(/^(\d+)\.\s*(\d+)\./);
    return match ? `${match[1]}.${match[2]}.` : d;
}

export function AttendanceSection({ courseCode }: { courseCode: string }) {
    const { t } = useTranslation();
    const groups = useAppStore(state => state.attendance[courseCode] ?? state.pastAttendance[courseCode]);

    if (!groups || groups.length === 0) return null;

    const { present, total } = countPresent(groups);
    const allRecords = groups.flatMap(g => g.records);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 px-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/40">
                    {t('course.attendance')} ({present}/{total})
                </h3>
            </div>
            <div className="flex items-center gap-3 px-3 flex-wrap">
                {allRecords.map((rec, i) => {
                    const ok = rec.status === 'present' || rec.status === 'elsewhere';
                    return (
                        <span key={i} className={`text-xs ${ok ? 'text-success' : 'text-error/70'}`} title={rec.date}>
                            {shortDate(rec.date)}{ok ? ' ✓' : ' ✗'}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
