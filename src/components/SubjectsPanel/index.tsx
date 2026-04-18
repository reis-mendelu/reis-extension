import { useMemo, useState, useEffect } from 'react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { isElectiveGroup } from '@/utils/studyPlanUtils';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { SubjectRow } from './SubjectRow';
import { computeFailRate } from './computeFailRate';
import { SemesterSection } from './SemesterSection';
import { SubjectsPanelSkeleton } from './SubjectsPanelSkeleton';
import type { SubjectStatus, Zamerani } from '@/types/studyPlan';

function normalizeZameraniName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^zaměření:\s*/i, '')
    .replace(/^specialization:\s*/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

interface SubjectsPanelProps {
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: string) => void;
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

  const [openSemester, setOpenSemester] = useState<number | null>(null);

  const zameraniLookup = useMemo(() => {
    const map = new Map<string, Zamerani>();
    if (!plan?.zameranis) return map;
    for (const z of plan.zameranis) map.set(normalizeZameraniName(z.name), z);
    return map;
  }, [plan]);

  // Pure reduce over existing data: for each zaměření, count how many of its
  // member subjects are currently enrolled or already fulfilled. Used both by
  // the header progress indicator and the zaměření card.
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

  if (!plan) {
    if (!studyPlanLoaded || (!handshakeDone && !handshakeTimedOut) || isSyncing) {
      return <SubjectsPanelSkeleton />;
    }
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
      <SubjectsPanelHeader
        creditsAcquired={plan.creditsAcquired}
        creditsRequired={plan.creditsRequired}
        studyStats={studyStats}
        plan={plan}
        zameraniProgress={zameraniProgress}
      />

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
              zameraniLookup={zameraniLookup}
              zameraniProgress={zameraniProgress}
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
