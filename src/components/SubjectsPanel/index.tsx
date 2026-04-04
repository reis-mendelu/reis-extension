import { useEffect, useMemo, useState } from 'react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { isElectiveGroup } from '@/utils/studyPlanUtils';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { SubjectRow } from './SubjectRow';
import { computeFailRate } from './computeFailRate';
import { SemesterSection } from './SemesterSection';
import { SubjectsPanelSkeleton } from './SubjectsPanelSkeleton';
import type { SubjectStatus } from '@/types/studyPlan';

interface SubjectsPanelProps {
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: string) => void;
  onSearchSubject: (name: string) => void;
}

export function SubjectsPanel({ onOpenSubject, onSearchSubject }: SubjectsPanelProps) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const loading = useAppStore(s => s.studyPlanLoading);
  const loaded = useAppStore(s => s.studyPlanLoaded);
  const isSyncing = useAppStore(s => s.isSyncing);
  const studyStats = useAppStore(s => s.studyStats);
  const successRates = useAppStore(s => s.successRates);

  useEffect(() => {
    useAppStore.getState().fetchStudyPlan();
    useAppStore.getState().fetchStudyStats();
  }, []);

  // Batch-prefetch success rates for all subjects in the plan
  useEffect(() => {
    if (!plan) return;
    const codes = plan.blocks.flatMap(b => b.groups.flatMap(g => g.subjects.map(s => s.code)));
    if (codes.length > 0) useAppStore.getState().fetchSuccessRateBatch(codes);
  }, [plan]);

  const [openSemester, setOpenSemester] = useState<number | null>(null);

  const failRates = useMemo(() => {
    const map: Record<string, number | null> = {};
    if (!plan) return map;
    for (const block of plan.blocks) {
      for (const group of block.groups) {
        for (const s of group.subjects) {
          map[s.code] = computeFailRate(successRates[s.code]);
        }
      }
    }
    return map;
  }, [plan, successRates]);

  // Skeleton while: initial load, any active fetch, or sync in progress with no data yet
  if (loading || !loaded || (isSyncing && !plan)) return <SubjectsPanelSkeleton />;

  if (!plan) {
    return <div className="flex items-center justify-center h-full text-base-content/50">{t('subjects.noData')}</div>;
  }

  const enrolledCore: SubjectStatus[] = [];
  const enrolledElective: SubjectStatus[] = [];
  for (const block of plan.blocks) {
    for (const group of block.groups) {
      const elective = isElectiveGroup(group.name, block.title);
      for (const s of group.subjects) {
        if (!s.isEnrolled) continue;
        if (elective) enrolledElective.push(s);
        else enrolledCore.push(s);
      }
    }
  }
  const sortByFailRate = (a: SubjectStatus, b: SubjectStatus) => (failRates[b.code] ?? -1) - (failRates[a.code] ?? -1);
  enrolledCore.sort(sortByFailRate);
  enrolledElective.sort(sortByFailRate);
  const hasEnrolledSubjects = enrolledCore.length > 0 || enrolledElective.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <SubjectsPanelHeader creditsAcquired={plan.creditsAcquired} creditsRequired={plan.creditsRequired} studyStats={studyStats} />

      {hasEnrolledSubjects && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-semibold text-base-content/50">{t('subjects.enrolled')}</h3>
            <span className="text-[11px] text-base-content/40">
              {enrolledCore.filter(s => s.credits <= 50).reduce((a, s) => a + s.credits, 0) + enrolledElective.filter(s => s.credits <= 50).reduce((a, s) => a + s.credits, 0)} {t('subjects.enrolledCreditsLabel')}
            </span>
          </div>
          <div className="rounded-lg border border-base-300 overflow-hidden">
            {enrolledCore.length > 0 && (
              <div className="p-1.5">
                {enrolledElective.length > 0 && (
                  <div className="text-[10px] text-base-content/40 font-semibold px-2 py-1 uppercase tracking-widest">{t('subjects.compulsory')}</div>
                )}
                {enrolledCore.map(s => (
                  <SubjectRow key={s.code} subject={s} failRate={failRates[s.code]} hideStatus={true} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />
                ))}
              </div>
            )}
            {enrolledElective.length > 0 && (
              <div className={`p-1.5 ${enrolledCore.length > 0 ? 'border-t border-base-300' : ''}`}>
                <div className="text-[10px] text-base-content/40 font-semibold px-2 py-1 uppercase tracking-widest">{t('subjects.elective')}</div>
                {enrolledElective.map(s => (
                  <SubjectRow key={s.code} subject={s} failRate={failRates[s.code]} hideStatus={true} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-4 pt-2 pb-4">
        <h3 className="text-sm font-semibold text-base-content/50 mb-3">{t('subjects.studyPlan')}</h3>
        <div className="flex flex-col gap-2">
          {plan.blocks.map((block, bi) => (
            <SemesterSection
              key={bi}
              block={block}
              open={openSemester === bi}
              dimmed={openSemester !== null && openSemester !== bi}
              failRates={failRates}
              onToggle={() => setOpenSemester(prev => prev === bi ? null : bi)}
              onOpenSubject={onOpenSubject}
              onSearchSubject={onSearchSubject}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
