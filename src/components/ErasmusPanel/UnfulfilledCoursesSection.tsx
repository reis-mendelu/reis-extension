import { useEffect, useMemo, useState } from 'react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { computeFailRate } from '@/components/SubjectsPanel/computeFailRate';
import { ErasmusSemesterSection, isTransferableCourse } from './ErasmusSemesterSection';
import { isCompulsoryGroup, isCoreElectiveGroup } from '@/utils/studyPlanUtils';
import { Calendar } from 'lucide-react';
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

  const [targetSemester, setTargetSemester] = useState<number | null>(null);

  // Logic to determine available future semesters for selection
  const availableSemesters = useMemo(() => {
    if (!plan || !plan.blocks) return [];
    return plan.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => {
        if (block.isWholePlanPool || !block.groups) return false;
        const all = block.groups.flatMap(g => g.subjects || []);
        // Only include semesters that haven't been completed yet
        return !all.some(s => s.isFulfilled) && !all.some(s => s.isEnrolled);
      });
  }, [plan]);

  // Set default target semester to the first available one
  useEffect(() => {
    if (targetSemester === null && availableSemesters.length > 0) {
      setTargetSemester(availableSemesters[0].index);
    }
  }, [availableSemesters, targetSemester]);

  const futureSemesters = useMemo(() => {
    if (!plan || !plan.blocks || targetSemester === null) return [];
    return plan.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block, index }) => {
        // HARD FILTER: Hide anything before the target semester
        if (!block.isWholePlanPool && index < targetSemester) return false;
        
        const actionableSubjects = (block.groups || [])
          .filter(g => isCompulsoryGroup(g.name, block.title) || isCoreElectiveGroup(g.name, block.title))
          .flatMap(g => g.subjects || [])
          .filter(s => isTransferableCourse(s));

        if (actionableSubjects.length === 0) return false;
        if (block.isWholePlanPool) return true;
        
        const allSubjects = block.groups.flatMap(g => g.subjects || []);
        return !allSubjects.some(s => s.isFulfilled) && !allSubjects.some(s => s.isEnrolled);
      });
  }, [plan, targetSemester]);

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
      {/* Trip Window Selector */}
      <div className="bg-base-200/50 rounded-xl p-4 border border-base-300 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          <h4 className="text-sm font-bold">{t('erasmus.tripWindow')}</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableSemesters.map(({ block, index }) => (
            <button
              key={index}
              onClick={() => setTargetSemester(index)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                targetSemester === index 
                  ? 'bg-primary border-primary text-primary-content shadow-md' 
                  : 'bg-base-100 border-base-300 text-base-content/60 hover:border-primary/50'
              }`}
            >
              {t('erasmus.semesterLabel', { n: index + 1 })}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-base-content/40 italic">
          {t('erasmus.selectTripWindow')}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {futureSemesters.map(({ block, index }) => {
          const isPriority = index === targetSemester;
          return (
            <div key={index} className="flex flex-col gap-2">
              {isPriority && (
                <div className="badge badge-primary badge-outline text-[9px] font-bold uppercase tracking-widest ml-1">
                  {t('erasmus.replacementPriority')}
                </div>
              )}
              <ErasmusSemesterSection
                block={block}
                failRates={failRates}
                selectedCodes={selectedSet}
                zameraniLookup={zameraniLookup}
                zameraniProgress={zameraniProgress}
                onToggleCourse={toggleCourse}
                onOpenSubject={onOpenSubject}
                onSearchSubject={onSearchSubject}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
