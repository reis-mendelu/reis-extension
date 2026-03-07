import { useEffect } from 'react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { SubjectRow } from './SubjectRow';
import { SemesterSection } from './SemesterSection';
import type { SubjectStatus } from '@/types/studyPlan';

interface SubjectsPanelProps {
  onOpenSubject: (courseCode: string, courseName: string, courseId: string) => void;
  onSearchSubject: (name: string) => void;
}

function hasEnrolled(block: { groups: { subjects: { isEnrolled: boolean }[] }[] }) {
  return block.groups.some(g => g.subjects.some(s => s.isEnrolled));
}

function allFulfilled(block: { groups: { subjects: { isFulfilled: boolean }[] }[] }) {
  const all = block.groups.flatMap(g => g.subjects);
  return all.length > 0 && all.every(s => s.isFulfilled);
}

function isElectiveBlock(block: { title: string; groups: { name: string }[] }): boolean {
  return block.groups.every(g => isElectiveGroup(g.name, block.title));
}

/** Pure elective = group says "volitelných" but NOT "povinně volitelných" */
function isElectiveGroup(groupName: string, blockTitle: string): boolean {
  const g = groupName.toLowerCase();
  const b = blockTitle.toLowerCase();
  // "volitelných" without "povinně" prefix → pure elective
  // Also match English: "elective"/"optional" without "compulsory"
  const gElective = (g.includes('volitel') && !g.includes('povinně') && !g.includes('povin'))
    || (g.includes('elective') && !g.includes('compulsory'))
    || (g.includes('optional') && !g.includes('compulsory'));
  const bElective = b.includes('volitelné předměty') || b.includes('optional courses');
  return gElective || bElective;
}

export function SubjectsPanel({ onOpenSubject, onSearchSubject }: SubjectsPanelProps) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const loading = useAppStore(s => s.studyPlanLoading);
  const studyStats = useAppStore(s => s.studyStats);

  useEffect(() => {
    useAppStore.getState().fetchStudyPlan();
    useAppStore.getState().fetchStudyStats();
  }, []);

  if (loading && !plan) {
    return (
      <div className="flex items-center justify-center h-full text-base-content/50">
        <span className="loading loading-spinner mr-2" />
        {t('subjects.loading')}
      </div>
    );
  }

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
  const hasEnrolledSubjects = enrolledCore.length > 0 || enrolledElective.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <SubjectsPanelHeader creditsAcquired={plan.creditsAcquired} creditsRequired={plan.creditsRequired} studyStats={studyStats} />

      {hasEnrolledSubjects && (
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-primary mb-2">
            {t('subjects.enrolled')}
            <span className="ml-2 font-normal text-xs text-base-content/50">
              {enrolledCore.filter(s => s.credits <= 50).reduce((a, s) => a + s.credits, 0) + enrolledElective.filter(s => s.credits <= 50).reduce((a, s) => a + s.credits, 0)} {t('subjects.enrolledCreditsLabel')}
            </span>
          </h3>
          {enrolledCore.length > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-1">
              {enrolledCore.map(s => (
                <SubjectRow key={s.code} subject={s} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />
              ))}
            </div>
          )}
          {enrolledElective.length > 0 && (
            <div className="mt-1.5 rounded-lg border border-base-300/50 p-1">
              {enrolledElective.map(s => (
                <SubjectRow key={s.code} subject={s} compact onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-4 pt-2 pb-4">
        <h3 className="text-sm font-semibold text-base-content/50 mb-3">{t('subjects.studyPlan')}</h3>
        <div className="flex flex-col gap-2">
          {plan.blocks.map((block, bi) => (
            <SemesterSection
              key={bi}
              block={block}
              defaultOpen={false}
              onOpenSubject={onOpenSubject}
              onSearchSubject={onSearchSubject}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
