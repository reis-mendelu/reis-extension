import { ClipboardList } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { TransferRow } from './TransferRow';
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';

interface Props {
  plan: StudyPlan;
  selectedCodes: string[];
  onToggle: (code: string) => void;
}

export function SelectedCoursesCard({ plan, selectedCodes, onToggle }: Props) {
  const { t } = useTranslation();

  const allSubjects = plan.blocks.flatMap(b => b.groups.flatMap(g => g.subjects));
  const selected: SubjectStatus[] = selectedCodes
    .map(code => allSubjects.find(s => s.code === code))
    .filter((s): s is SubjectStatus => s !== undefined);

  if (selected.length === 0) {
    return (
      <div className="border border-dashed border-base-300 rounded-lg px-4 py-5 flex flex-col items-center gap-1.5 text-center">
        <ClipboardList size={18} className="text-base-content/20" />
        <p className="text-sm text-base-content/40">{t('erasmus.selectedForLA')}</p>
        <p className="text-xs text-base-content/30">{t('erasmus.studyPlanHint')}</p>
      </div>
    );
  }

  const totalCredits = selected.reduce((sum, s) => sum + s.credits, 0);

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <ClipboardList size={14} className="text-primary shrink-0" />
        <span className="text-sm font-medium text-primary flex-1">{t('erasmus.selectedForLA')}</span>
        <span className="text-[11px] text-primary/70">{totalCredits} {t('erasmus.credits')}</span>
      </div>
      <div>
        {selected.map(s => (
          <TransferRow key={s.code} subject={s} onRemove={() => onToggle(s.code)} />
        ))}
      </div>
    </div>
  );
}
