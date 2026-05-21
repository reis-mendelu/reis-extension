import { ClipboardList, ExternalLink } from 'lucide-react';
import { useZaznamnik } from '../../hooks/data/useZaznamnik';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { VtTestAttempt } from '../../types/zaznamnik';
import { VtTestGroup } from './Zaznamnik/VtTestGroup';
import { PhArchView } from './Zaznamnik/PhArchView';

const IS_BASE = 'https://is.mendelu.cz';

interface ZaznamnikTabProps {
    courseCode: string;
}

export function ZaznamnikTab({ courseCode }: ZaznamnikTabProps) {
    const { data, isLoading } = useZaznamnik(courseCode);
    const subjectInfo = useAppStore(s => courseCode ? s.subjects?.data[courseCode] : undefined);
    const studium = useAppStore(s => s.studiumId);
    const obdobi = useAppStore(s => s.obdobiId);
    const { t, language } = useTranslation();
    const lang = language === 'cz' ? 'cz' : 'en';
    const subjectId = subjectInfo?.subjectId;

    const buildUrl = (extra: string) =>
        `${IS_BASE}/auth/student/list.pl?studium=${studium};obdobi=${obdobi};predmet=${subjectId};${extra};lang=${lang}`;

    const backlinks = (subjectInfo?.hasPrubezne || subjectInfo?.hasTest) && studium && obdobi && subjectId ? (
        <div className="flex justify-center gap-2 pt-2 pb-2">
            {subjectInfo!.hasPrubezne && (
                <a href={buildUrl('prubezne=1')} target="_blank" rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm gap-2 text-base-content/50 hover:text-primary normal-case font-bold">
                    <span>IS (průběžné hodnocení)</span><ExternalLink size={14} />
                </a>
            )}
            {subjectInfo!.hasTest && (
                <a href={buildUrl('test=1')} target="_blank" rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm gap-2 text-base-content/50 hover:text-primary normal-case font-bold">
                    <span>IS (výsledky testů)</span><ExternalLink size={14} />
                </a>
            )}
        </div>
    ) : null;

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
            <div className="flex flex-col h-full">
                <div className="flex flex-col items-center justify-center flex-1 p-6 opacity-40 text-center">
                    <ClipboardList className="w-12 h-12 mb-3" />
                    <p className="text-sm">{hasFlags ? t('zaznamnik.noData') : t('zaznamnik.noAssessment')}</p>
                </div>
                {backlinks}
            </div>
        );
    }

    const nonEmptyArches = data.ph.sections.flatMap(s => s.arches.filter(a => !a.empty));
    const vtTests = data.vt.tests;

    const vtGroups: { name: string; attempts: VtTestAttempt[] }[] = [];
    for (const test of vtTests) {
        const existing = vtGroups.find(g => g.name === test.name);
        if (existing) existing.attempts.push(test);
        else vtGroups.push({ name: test.name, attempts: [test] });
    }

    return (
        <div className="h-full overflow-y-auto p-4 space-y-5 text-[13px]">
            <PhArchView sections={data.ph.sections} />

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

            {backlinks}
        </div>
    );
}
