import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { computeFailRate } from '@/components/SubjectsPanel/computeFailRate';
import { ErasmusSemesterSection } from './ErasmusSemesterSection';
import { SelectedCoursesCard } from './SelectedCoursesCard';

interface Props {
  onOpenSubject: (courseCode: string, courseName?: string, courseId?: string) => void;
  onSearchSubject: (name: string) => void;
}

export function UnfulfilledCoursesSection({ onOpenSubject, onSearchSubject }: Props) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const loaded = useAppStore(s => s.studyPlanLoaded);
  const successRates = useAppStore(s => s.successRates);
  const selectedCourses = useAppStore(s => s.erasmusSelectedCourses);
  const toggleCourse = useAppStore(s => s.toggleErasmusCourse);
  const [open, setOpen] = useState(false);
  const [openSemester, setOpenSemester] = useState<number | null>(null);

  useEffect(() => { useAppStore.getState().loadErasmusSelectedCourses(); }, []);

  const futureSemesters = useMemo(() => {
    if (!plan) return [];
    return plan.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => {
        const all = block.groups.flatMap(g => g.subjects);
        if (all.length === 0) return false;
        return !all.some(s => s.isFulfilled) && !all.some(s => s.isEnrolled);
      });
  }, [plan]);

  const failRates = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const { block } of futureSemesters) {
      for (const group of block.groups) {
        for (const s of group.subjects) {
          map[s.code] = computeFailRate(successRates[s.code]);
        }
      }
    }
    return map;
  }, [futureSemesters, successRates]);

  useEffect(() => {
    if (futureSemesters.length === 0) return;
    const codes = futureSemesters.flatMap(({ block }) =>
      block.groups.flatMap(g => g.subjects.map(s => s.code))
    );
    if (codes.length > 0) useAppStore.getState().fetchSuccessRateBatch(codes);
  }, [futureSemesters]);

  if (!loaded) {
    return (
      <div className="border border-base-300 rounded-lg px-3 py-2.5 mb-3">
        <span className="loading loading-spinner loading-xs" />
      </div>
    );
  }

  if (!plan || futureSemesters.length === 0) return null;

  const totalSubjects = futureSemesters.reduce(
    (sum, { block }) => sum + block.groups.reduce((s, g) => s + g.subjects.length, 0), 0
  );

  const selectedSet = new Set(selectedCourses);

  return (
    <div className="flex flex-col gap-3 mb-3">
      <div className="border border-base-300 rounded-lg overflow-hidden">
        <button
          className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-base-200 transition-colors text-left"
          onClick={() => setOpen(!open)}
        >
          <BookOpen size={14} className="text-base-content/40 shrink-0" />
          <span className="text-sm font-medium flex-1">{t('erasmus.myStudyPlan')}</span>
          <span className="badge badge-sm bg-base-200 text-base-content/60">
            {totalSubjects} {t('erasmus.remainingCourses')}
          </span>
          <ChevronDown size={14} className={`text-base-content/40 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="px-3 pb-3 border-t border-base-300 pt-2">
            <p className="text-[11px] text-base-content/40 mb-2">{t('erasmus.studyPlanHint')}</p>
            <div className="flex flex-col gap-2">
              {futureSemesters.map(({ block, index }) => (
                <ErasmusSemesterSection
                  key={index}
                  block={block}
                  open={openSemester === index}
                  dimmed={openSemester !== null && openSemester !== index}
                  failRates={failRates}
                  selectedCodes={selectedSet}
                  onToggle={() => setOpenSemester(prev => prev === index ? null : index)}
                  onToggleCourse={toggleCourse}
                  onOpenSubject={onOpenSubject}
                  onSearchSubject={onSearchSubject}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedCourses.length > 0 && (
        <SelectedCoursesCard
          plan={plan}
          selectedCodes={selectedCourses}
          onToggle={toggleCourse}
        />
      )}
    </div>
  );
}
