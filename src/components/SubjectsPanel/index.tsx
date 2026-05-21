import { useEffect, useMemo } from 'react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { computeFailRate } from './computeFailRate';
import { SemesterSection } from './SemesterSection';
import { SubjectsPanelSkeleton } from './SubjectsPanelSkeleton';
import { HardestUpcomingCard } from './HardestUpcomingCard';
import { ZameraniComparisonCard } from './ZameraniComparisonCard';
import { EnrolledNowSection } from './EnrolledNowSection';
import { topHardestUpcoming, zameraniInsights } from './insights';
import { useOpenSemesters } from './useOpenSemesters';
import { useZameraniPicks } from './useZameraniPicks';
import type { Zamerani } from '@/types/studyPlan';
import { getSemesterState, isRealCredits, isZameraniCode, normalizeZameraniName, buildSubjectSemesters, buildSubjectToZameranis } from './utils';

interface SubjectsPanelProps {
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void;
  onSearchSubject: (name: string) => void;
}

export function SubjectsPanel({ onOpenSubject, onSearchSubject }: SubjectsPanelProps) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const studyPlanLoaded = useAppStore(s => s.studyPlanLoaded);
  const studyStats = useAppStore(s => s.studyStats);
  const successRates = useAppStore(s => s.successRates);
  const handshakeDone = useAppStore(s => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore(s => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore(s => s.syncStatus.isSyncing);

  useEffect(() => {
    if (!plan) return;
    const codes = plan.blocks.flatMap(b => b.groups.flatMap(g => g.subjects.map(s => s.code)));
    if (codes.length > 0) useAppStore.getState().fetchSuccessRateBatch(codes);
  }, [plan]);

  const { openSemesters, currentSemesterRef, handleToggle } = useOpenSemesters(plan);

  const zameraniLookup = useMemo(() => {
    const map = new Map<string, Zamerani>();
    if (!plan?.zameranis) return map;
    for (const z of plan.zameranis) map.set(normalizeZameraniName(z.name), z);
    return map;
  }, [plan]);

  const subjectSemesters = useMemo(() => buildSubjectSemesters(plan), [plan]);
  const subjectToZameranis = useMemo(() => buildSubjectToZameranis(plan), [plan]);

  const zameraniProgress = useMemo(() => {
    const out = new Map<string, { enrolled: number; fulfilled: number; total: number; touched: boolean }>();
    if (!plan?.zameranis) return out;
    const subjectByCode = new Map<string, { isEnrolled: boolean; isFulfilled: boolean }>();
    for (const b of plan.blocks) for (const g of b.groups) for (const s of g.subjects) {
      subjectByCode.set(s.code, { isEnrolled: s.isEnrolled, isFulfilled: s.isFulfilled });
    }
    for (const z of plan.zameranis) {
      let enrolled = 0, fulfilled = 0;
      for (const m of z.subjects) {
        const hit = subjectByCode.get(m.code);
        if (!hit) continue;
        if (hit.isFulfilled) fulfilled++;
        else if (hit.isEnrolled) enrolled++;
      }
      const touched = enrolled + fulfilled > 0;
      out.set(normalizeZameraniName(z.name), { enrolled, fulfilled, total: z.subjects.length, touched });
    }
    return out;
  }, [plan]);

  const failRates = useMemo(() => {
    const map: Record<string, number | null> = {};
    if (!plan) return map;
    for (const block of plan.blocks) for (const group of block.groups) for (const s of group.subjects) {
      map[s.code] = computeFailRate(successRates[s.code]);
    }
    return map;
  }, [plan, successRates]);

  const enrolledCredits = useMemo(() => {
    if (!plan) return 0;
    let total = 0;
    for (const block of plan.blocks) for (const group of block.groups) for (const s of group.subjects) {
      if (s.isEnrolled && isRealCredits(s.credits)) total += s.credits;
    }
    return total;
  }, [plan]);

  const picks = useZameraniPicks();

  const hardest = useMemo(
    () => plan ? topHardestUpcoming(plan, successRates, subjectSemesters, 5) : [],
    [plan, successRates, subjectSemesters],
  );
  const zameraniStats = useMemo(
    () => plan ? zameraniInsights(plan, successRates) : [],
    [plan, successRates],
  );

  if (!plan) {
    if (!studyPlanLoaded || (!handshakeDone && !handshakeTimedOut) || isSyncing) return <SubjectsPanelSkeleton />;
    return <div className="flex items-center justify-center h-full text-base-content/50">{t('subjects.noData')}</div>;
  }

  const firstCurrentIdx = plan.blocks.findIndex((block) => getSemesterState(block) === 'current');

  return (
    <div className="h-full overflow-y-auto">
      <SubjectsPanelHeader
        creditsAcquired={plan.creditsAcquired}
        creditsRequired={plan.creditsRequired}
        studyStats={studyStats}
        plan={plan}
        zameraniProgress={zameraniProgress}
        enrolledCredits={enrolledCredits}
      />

      <>
          <div className="px-4 pt-4 pb-0">
            <EnrolledNowSection
              plan={plan}
              failRates={failRates}
              subjectSemesters={subjectSemesters}
              subjectToZameranis={subjectToZameranis}
              onOpenSubject={onOpenSubject}
              onSearchSubject={onSearchSubject}
            />
          </div>

          {/* Insights Grid */}
          {(hardest.length > 0 || zameraniStats.length >= 2) && (
            <div className={`px-4 pt-3 grid gap-3 items-start ${
              hardest.length > 0 && zameraniStats.length >= 2
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1"
            }`}>
              <HardestUpcomingCard entries={hardest} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />
              <ZameraniComparisonCard
                insights={zameraniStats}
                picks={picks.effectivePicks}
                onTogglePick={picks.togglePick}
                minRequired={plan.zameraniMinimum}
                subjectSemesters={subjectSemesters}
                onOpenSubject={onOpenSubject}
                onSearchSubject={onSearchSubject}
              />
            </div>
          )}

          <div className="px-4 pt-4 pb-4">
            <div className="flex flex-col gap-2">
              {plan.blocks.map((block, bi) => {
                const hasSubjects = block.groups.flatMap(g => g.subjects).some(s => !isZameraniCode(s.code));
                return (
                  <div key={bi} ref={bi === firstCurrentIdx ? currentSemesterRef : undefined}>
                    <SemesterSection
                      block={block}
                      open={openSemesters.has(bi)}
                      dimmed={hasSubjects && openSemesters.size > 0 && !openSemesters.has(bi)}
                      failRates={failRates}
                      zameraniLookup={zameraniLookup}
                      zameraniProgress={zameraniProgress}
                      subjectSemesters={subjectSemesters}
                      subjectToZameranis={subjectToZameranis}
                      pickedZameranis={picks.effectivePicks}
                      onToggle={() => handleToggle(bi)}
                      onOpenSubject={onOpenSubject}
                      onSearchSubject={onSearchSubject}
                    />
                  </div>
                );
              })}
            </div>
          </div>
      </>
    </div>
  );
}
