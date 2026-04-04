import { ClipboardList, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
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

  if (selected.length === 0) return null;

  const totalCredits = selected.reduce((sum, s) => sum + s.credits, 0);

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <ClipboardList size={14} className="text-primary shrink-0" />
        <span className="text-sm font-medium text-primary flex-1">{t('erasmus.selectedForLA')}</span>
        <span className="text-[11px] text-primary/70">{totalCredits} {t('erasmus.credits')}</span>
      </div>
      <div className="px-3 pb-2.5 border-t border-primary/10">
        {selected.map(s => (
          <div key={s.code} className="flex items-center gap-2 py-1 text-xs group">
            <span className="font-mono text-base-content/50 shrink-0">{s.code}</span>
            <span className="flex-1 truncate">{s.name}</span>
            <span className="text-base-content/40 shrink-0">{s.credits} {t('erasmus.credits')}</span>
            <button
              onClick={() => onToggle(s.code)}
              className="btn btn-ghost btn-xs w-5 h-5 min-h-0 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
