import { ExternalLink } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { parseRegistrationStart } from '@/utils/termUtils';
import { useMemo } from 'react';

interface ZaznamnikLineProps {
    courseCode: string;
    subjectId?: string;
}

const STATUS_DOT: Record<string, string> = {
    present: 'bg-success',
    elsewhere: 'bg-success',
    absent: 'bg-error',
    excused: 'bg-base-content/30',
    late: 'bg-warning',
    'early-leave': 'bg-warning',
    excluded: 'bg-error',
};

const IS_BASE = 'https://is.mendelu.cz';
const DAY_MS = 1000 * 60 * 60 * 24;

function dayDiff(ts: number): number {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const d = new Date(ts);
    const targetStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.max(0, Math.floor((targetStart - todayStart) / DAY_MS));
}

export function ZaznamnikLine({ courseCode, subjectId }: ZaznamnikLineProps) {
    const { t, language } = useTranslation();
    const lang = language === 'cz' ? 'cz' : 'en';

    const studium = useAppStore(s => s.studiumId);
    const obdobi = useAppStore(s => s.obdobiId);
    const attendanceGroups = useAppStore(s => s.attendance[courseCode]);
    const subjectInfo = useAppStore(s => s.subjects?.data[courseCode]);
    const allTests = useAppStore(s => s.cvicneTests);
    const allAssignments = useAppStore(s => s.odevzdavarny);

    const dots = useMemo(() => {
        if (!attendanceGroups) return [];
        return attendanceGroups.flatMap(g => g.records);
    }, [attendanceGroups]);

    const { visibleDots, presentCount, totalCount } = useMemo(() => {
        const visible = dots.slice(-10);
        let present = 0, total = 0;
        for (const d of dots) {
            if (d.status === 'present' || d.status === 'elsewhere') present++;
            if (d.status !== 'excused' && d.status !== 'excluded') total++;
        }
        return { visibleDots: visible, presentCount: present, totalCount: total };
    }, [dots]);

    const accessibleTests = useMemo(() => {
        if (!subjectId || !allTests) return [];
        return allTests.filter(t => t.courseId === subjectId && t.status === 'accessible');
    }, [subjectId, allTests]);
    const accessibleCount = accessibleTests.length;

    const upcomingDeadlines = useMemo(() => {
        if (!subjectId || !allAssignments) return [];
        const now = Date.now();
        const cutoff = now + 21 * 24 * 60 * 60 * 1000;
        return allAssignments
            .filter(a => a.courseId === subjectId)
            .map(a => ({ a, ts: parseRegistrationStart(a.deadline)?.getTime() ?? 0 }))
            .filter(({ ts }) => ts > now && ts <= cutoff)
            .sort((x, y) => x.ts - y.ts);
    }, [subjectId, allAssignments]);

    const hasPrubezne = subjectInfo?.hasPrubezne;
    const hasTest = subjectInfo?.hasTest;
    const autoHref = subjectInfo?.autoHref;

    const buildUrl = (extra: string) =>
        `${IS_BASE}/auth/student/list.pl?studium=${studium};obdobi=${obdobi};predmet=${subjectId};${extra};lang=${lang}`;

    const hasAnything = visibleDots.length > 0 || hasPrubezne || hasTest || autoHref || accessibleCount > 0 || upcomingDeadlines.length > 0;
    if (!hasAnything) return null;

    const deadlineLabel = (ts: number) => {
        const days = dayDiff(ts);
        return days === 0 ? t('deadlines.today') : days === 1 ? t('deadlines.tomorrow') : t('deadlines.inDays').replace('{n}', String(days));
    };
    const deadlineUrgency = (ts: number) => {
        const days = dayDiff(ts);
        return days === 0 ? 'text-error hover:text-error/80' : days <= 2 ? 'text-warning hover:text-warning/80' : 'text-base-content/50 hover:text-base-content/70';
    };

    return (
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 px-3 pb-2 -mt-1">
            {visibleDots.length > 0 && (
                <span className="flex items-center gap-1 shrink-0">
                    {visibleDots.map((d, i) => (
                        <span key={i} className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[d.status] ?? 'bg-base-content/20'}`} />
                    ))}
                    <span className="text-[10px] text-base-content/40 ml-0.5 font-mono">{presentCount}/{totalCount}</span>
                </span>
            )}
            {hasPrubezne && studium && obdobi && subjectId && (
                <a
                    href={buildUrl('prubezne=1')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-0.5 text-[10px] text-primary/70 hover:text-primary transition-colors shrink-0"
                >
                    PH <ExternalLink size={9} />
                </a>
            )}
            {autoHref && (
                <a
                    href={autoHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-0.5 text-[10px] text-primary/70 hover:text-primary transition-colors shrink-0"
                >
                    AH <ExternalLink size={9} />
                </a>
            )}
            {hasTest && studium && obdobi && subjectId && (
                <a
                    href={buildUrl('test=1')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-0.5 text-[10px] text-primary/70 hover:text-primary transition-colors shrink-0"
                >
                    VT <ExternalLink size={9} />
                </a>
            )}
            {accessibleCount > 0 && (accessibleCount === 1 || studium) && (
                <a
                    href={accessibleCount === 1 ? accessibleTests[0].url : `${IS_BASE}/auth/student/seznam_osnov.pl?studium=${studium};lang=${lang}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="badge badge-xs badge-primary badge-outline text-[9px] shrink-0 hover:badge-primary cursor-pointer"
                >
                    {accessibleCount} {t('deadlines.cvicnyTest')}
                </a>
            )}
            {upcomingDeadlines.map(({ a, ts }, i) => (
                <a
                    key={i}
                    href={a.uploadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className={`flex items-center gap-0.5 text-[10px] shrink-0 transition-colors ${deadlineUrgency(ts)}`}
                >
                    {a.name.length > 20 ? a.name.slice(0, 20) + '…' : a.name}
                    <span className="font-bold ml-0.5">{deadlineLabel(ts)}</span>
                </a>
            ))}
        </div>
    );
}
