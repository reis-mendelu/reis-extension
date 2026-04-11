import { ClipboardList, ShieldCheck, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { TransferRow } from './TransferRow';
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';

interface Props {
  plan: StudyPlan;
  selectedCodes: string[];
  onToggle: (code: string) => void;
  compulsoryCredits?: number;
}

export function SelectedCoursesCard({ plan, selectedCodes, onToggle, compulsoryCredits = 0 }: Props) {
  const { t } = useTranslation();

  if (!plan) return null;

  const allSubjects = (plan.blocks || []).flatMap(b => (b.groups || []).flatMap(g => g.subjects || []));
  const selected: SubjectStatus[] = (selectedCodes || [])
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
  const isMinReached = totalCredits >= 18;
  const isIdeal = totalCredits >= 25;
  const isDangerZone = compulsoryCredits < 10 && selected.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Prolongation Warning */}
      {isDangerZone && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={18} className="text-error shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-error leading-tight">
            {t('erasmus.prolongationWarning')}
          </p>
        </div>
      )}

      <div className={`rounded-xl p-3 border flex items-center justify-between gap-3 ${
        isIdeal ? 'bg-success/5 border-success/20 text-success' :
        isMinReached ? 'bg-warning/5 border-warning-content/20 text-warning-content' :
        'bg-error/5 border-error/20 text-error'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isIdeal ? 'bg-success/20' : isMinReached ? 'bg-warning/20' : 'bg-error/20'
          }`}>
            {isIdeal ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">
              {t('erasmus.selectedForLA')}
            </span>
            <span className="text-sm font-bold">
              {isIdeal ? t('erasmus.progressOk') : isMinReached ? t('erasmus.progressOk') : t('erasmus.progressLow')}
            </span>
            {compulsoryCredits > 0 && (
              <span className="text-[10px] font-medium opacity-60">
                {t('erasmus.compulsoryCredits')}: {compulsoryCredits} kr.
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-lg font-black leading-none">{totalCredits}</span>
          <span className="text-[10px] font-bold block opacity-70 uppercase tracking-tighter">ECTS</span>
        </div>
      </div>

      <div className="border border-base-300 bg-base-100 rounded-xl overflow-hidden shadow-sm">
        <div className="px-3 py-2 bg-base-200/30 border-b border-base-300 flex items-center gap-2">
          <ClipboardList size={14} className="text-base-content/40 shrink-0" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-base-content/50">{t('erasmus.selected')} ({selected.length})</span>
        </div>
        <div>
          {selected.map(s => (
            <TransferRow key={s.code} subject={s} onRemove={() => onToggle(s.code)} />
          ))}
        </div>
      </div>
    </div>
  );
}
