import { useMemo, useState, useEffect } from 'react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { SubjectsPanelToolbar } from './SubjectsPanelToolbar';
import { computeFailRate } from './computeFailRate';
import { SemesterSection } from './SemesterSection';
import { SubjectsPanelSkeleton } from './SubjectsPanelSkeleton';
import { DEFAULT_FILTERS, type SortMode, type SubjectFilters } from './types';
import { useOpenSemesters } from './useOpenSemesters';
import type { Zamerani } from '@/types/studyPlan';
import { getSemesterState, isRealCredits, normalizeZameraniName, buildSubjectSemesters } from './utils';

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

  // Batch-prefetch success rates for all subjects in the plan
  useEffect(() => {
    if (!plan) return;
    const codes = plan.blocks.flatMap(b => b.groups.flatMap(g => g.subjects.map(s => s.code)));
    if (codes.length > 0) useAppStore.getState().fetchSuccessRateBatch(codes);
  }, [plan]);

  const { openSemesters, currentSemesterRef, handleToggle } = useOpenSemesters(plan);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [filters, setFilters] = useState<SubjectFilters>(DEFAULT_FILTERS);

  const zameraniLookup = useMemo(() => {
    const map = new Map<string, Zamerani>();
    if (!plan?.zameranis) return map;
    for (const z of plan.zameranis) map.set(normalizeZameraniName(z.name), z);
    return map;
  }, [plan]);

  const subjectSemesters = useMemo(() => buildSubjectSemesters(plan), [plan]);

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
    for (const block of plan.blocks) {
      for (const group of block.groups) {
        for (const s of group.subjects) {
          map[s.code] = computeFailRate(successRates[s.code]);
        }
      }
    }
    return map;
  }, [plan, successRates]);

  // Compute total enrolled credits for the header
  const enrolledCredits = useMemo(() => {
    if (!plan) return 0;
    let total = 0;
    for (const block of plan.blocks) {
      for (const group of block.groups) {
        for (const s of group.subjects) {
          if (s.isEnrolled && isRealCredits(s.credits)) total += s.credits;
        }
      }
    }
    return total;
  }, [plan]);

  if (!plan) {
    if (!studyPlanLoaded || (!handshakeDone && !handshakeTimedOut) || isSyncing) {
      return <SubjectsPanelSkeleton />;
    }
    return <div className="flex items-center justify-center h-full text-base-content/50">{t('subjects.noData')}</div>;
  }

  // Determine the first current semester index for the scroll ref
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

      <SubjectsPanelToolbar sortMode={sortMode} filters={filters} onSortChange={setSortMode} onFiltersChange={setFilters} />

      <div className="px-4 pb-4">
        <div className="flex flex-col gap-2">
          {plan.blocks.map((block, bi) => {
            const hasSubjects = block.groups.flatMap(g => g.subjects).length > 0;
            const numMatch = block.title.match(/^(\d+)/);
            const num = numMatch ? Number(numMatch[1]) : null;
            const parity: 'ZS' | 'LS' | null = num == null ? null : num % 2 === 1 ? 'ZS' : 'LS';
            if (filters.semesterType !== 'all' && parity && parity !== filters.semesterType) return null;
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
                  sortMode={sortMode}
                  filters={filters}
                  onToggle={() => handleToggle(bi)}
                  onOpenSubject={onOpenSubject}
                  onSearchSubject={onSearchSubject}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
