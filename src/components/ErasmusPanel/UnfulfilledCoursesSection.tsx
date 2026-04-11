import { useEffect, useMemo } from 'react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { computeFailRate } from '@/components/SubjectsPanel/computeFailRate';
import { ErasmusSemesterSection, isTransferableCourse } from './ErasmusSemesterSection';
import { isCompulsoryGroup, isCoreElectiveGroup } from '@/utils/studyPlanUtils';
import type { Zamerani } from '@/types/studyPlan';

interface Props {
  onOpenSubject: (courseCode: string, courseName?: string, courseId?: string) => void;
  onSearchSubject: (name: string) => void;
}

function normalizeZameraniName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/^zaměření:\s*/i, '')
    .replace(/^specialization:\s*/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function UnfulfilledCoursesSection({ onOpenSubject, onSearchSubject }: Props) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const loaded = useAppStore(s => s.studyPlanLoaded);
  const successRates = useAppStore(s => s.successRates);
  const selectedCourses = useAppStore(s => s.erasmusSelectedCourses) || [];
  const rawToggle = useAppStore(s => s.toggleErasmusCourse);

  const futureSemesters = useMemo(() => {
    if (!plan || !plan.blocks) return [];
    return plan.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => {
        if (!block || !block.groups) return false;
        // Only include semesters that have high-value subjects remaining
        const actionableSubjects = block.groups
          .filter(g => isCompulsoryGroup(g.name, block.title) || isCoreElectiveGroup(g.name, block.title))
          .flatMap(g => g.subjects || [])
          .filter(s => isTransferableCourse(s));

        if (actionableSubjects.length === 0) return false;
        if (block.isWholePlanPool) return true;
        
        // Also ensure the semester hasn't been fulfilled or enrolled already
        const allSubjects = block.groups.flatMap(g => g.subjects || []);
        return !allSubjects.some(s => s.isFulfilled) && !allSubjects.some(s => s.isEnrolled);
      });
  }, [plan]);

  const toggleCourse = (code: string) => {
    const isAdding = !selectedCourses.includes(code);
    rawToggle(code);
    if (isAdding) {
      const allSubjects = futureSemesters.flatMap(({ block }) => (block.groups || []).flatMap(g => g.subjects || []));
      const subject = allSubjects.find(s => s.code === code);
      if (subject?.id) useAppStore.getState().fetchSyllabus(subject.code, subject.id);
    }
  };

  const zameraniLookup = useMemo(() => {
    const map = new Map<string, Zamerani>();
    if (!plan?.zameranis) return map;
    for (const z of plan.zameranis) {
        if (z && z.name) map.set(normalizeZameraniName(z.name), z);
    }
    return map;
  }, [plan]);

  const zameraniProgress = useMemo(() => {
    const out = new Map<string, { enrolled: number; fulfilled: number; total: number; touched: boolean }>();
    if (!plan || !plan.zameranis || !plan.blocks) return out;
    const subjectByCode = new Map<string, { isEnrolled: boolean; isFulfilled: boolean }>();
    for (const b of plan.blocks) {
        if (!b.groups) continue;
        for (const g of b.groups) {
            if (!g.subjects) continue;
            for (const s of g.subjects) {
                subjectByCode.set(s.code, { isEnrolled: s.isEnrolled, isFulfilled: s.isFulfilled });
            }
        }
    }
    for (const z of plan.zameranis) {
      if (!z || !z.name || !z.subjects) continue;
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

  useEffect(() => { useAppStore.getState().loadErasmusSelectedCourses(); }, []);

  const failRates = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const { block } of futureSemesters) {
      if (!block.groups) continue;
      for (const group of block.groups) {
        if (isCompulsoryGroup(group.name, block.title) || isCoreElectiveGroup(group.name, block.title)) {
          if (!group.subjects) continue;
          for (const s of group.subjects) {
            if (isTransferableCourse(s)) {
              map[s.code] = computeFailRate(successRates[s.code]);
            }
          }
        }
      }
    }
    return map;
  }, [futureSemesters, successRates]);

  useEffect(() => {
    if (futureSemesters.length === 0) return;
    const codes = futureSemesters.flatMap(({ block }) =>
      (block.groups || [])
        .filter(g => isCompulsoryGroup(g.name, block.title) || isCoreElectiveGroup(g.name, block.title))
        .flatMap(g => (g.subjects || []).map(s => s.code))
    ).filter(c => {
        const all = plan?.blocks?.flatMap(b => (b.groups || []).flatMap(g => g.subjects || [])) || [];
        const s = all.find(sub => sub.code === c);
        return s ? isTransferableCourse(s) : true;
    });
    if (codes.length > 0) useAppStore.getState().fetchSuccessRateBatch(codes);
  }, [futureSemesters, plan]);

  if (!loaded) {
    return (
      <div className="border border-base-300 rounded-lg px-3 py-2.5 mb-3">
        <span className="loading loading-spinner loading-xs" />
      </div>
    );
  }

  if (!plan || futureSemesters.length === 0) return null;

  const totalSubjects = futureSemesters.reduce(
    (sum, { block }) => sum + (block.groups || [])
      .filter(g => isCompulsoryGroup(g.name, block.title) || isCoreElectiveGroup(g.name, block.title))
      .reduce((s, g) => s + (g.subjects || []).filter(sub => isTransferableCourse(sub)).length, 0), 0
  );

  const selectedSet = new Set(selectedCourses);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/40">
          {t('erasmus.myStudyPlan')}
        </h3>
        <span className="badge badge-ghost badge-sm font-medium">
          {totalSubjects} {t('erasmus.remainingCourses')}
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {futureSemesters.map(({ block, index }) => (
          <ErasmusSemesterSection
            key={index}
            block={block}
            failRates={failRates}
            selectedCodes={selectedSet}
            zameraniLookup={zameraniLookup}
            zameraniProgress={zameraniProgress}
            onToggleCourse={toggleCourse}
            onOpenSubject={onOpenSubject}
            onSearchSubject={onSearchSubject}
          />
        ))}
      </div>
    </div>
  );
}
