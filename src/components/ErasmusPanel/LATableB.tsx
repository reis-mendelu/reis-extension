import { X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useCourseName } from '@/hooks/ui/useCourseName';
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';

interface Props {
  plan: StudyPlan;
  selectedCodes: string[];
  onToggle: (code: string) => void;
  tableATotal: number;
}

function TableBRow({ subject, displayCredits, onRemove }: {
  subject: SubjectStatus;
  displayCredits: number;
  onRemove: () => void;
}) {
  const displayName = useCourseName(subject.code, subject.name);

  return (
    <div className="border-b border-base-300/50 last:border-b-0">
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-3 py-2 text-xs hover:bg-base-200/30 transition-colors">
        <span className="font-mono text-base-content/50 w-20 truncate">{subject.code}</span>
        <span className="truncate font-medium">{displayName}</span>
        <span className="tabular-nums font-bold text-base-content/70 w-12 text-right">{displayCredits}</span>
        <button
          onClick={onRemove}
          className="btn btn-ghost btn-xs w-5 h-5 min-h-0 p-0 text-base-content/15 hover:text-error hover:bg-error/10 rounded-full"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

export function LATableB({ plan, selectedCodes, onToggle, tableATotal }: Props) {
  const { t } = useTranslation();

  const allSubjects = (plan.blocks || []).flatMap(b => (b.groups || []).flatMap(g => g.subjects || []));
  const selected: SubjectStatus[] = (selectedCodes || [])
    .map(code => allSubjects.find(s => s.code === code))
    .filter((s): s is SubjectStatus => s !== undefined);

  const knownTotal = selected.reduce((sum, s) => sum + (s.credits < 999 ? s.credits : 0), 0);
  const exaUpSlots = selected.filter(s => s.credits >= 999);
  const exaUpCount = exaUpSlots.length;
  const exaUpResidual = Math.max(0, tableATotal - knownTotal);
  const exaUpBase = exaUpCount > 0 ? Math.floor(exaUpResidual / exaUpCount) : 0;
  const exaUpRemainder = exaUpCount > 0 ? exaUpResidual % exaUpCount : 0;
  const exaUpCredits = new Map(
    exaUpSlots.map((s, i) => [s.code, exaUpBase + (i >= exaUpCount - exaUpRemainder ? 1 : 0)])
  );

  const totalCredits = knownTotal + exaUpResidual;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <div className="badge badge-sm font-black tracking-wider bg-success/10 text-success border-success/20">B</div>
        <span className="text-[10px] uppercase tracking-widest font-bold text-base-content/50">
          {t('erasmus.tableBTitle')}
        </span>
        {selected.length > 0 && (
          <span className="ml-auto text-[10px] text-base-content/30 tabular-nums">{selected.length} {t('erasmus.selected')}</span>
        )}
      </div>

      {selected.length === 0 ? (
        <div className="border border-dashed border-base-300 rounded-lg px-4 py-4 text-center">
          <p className="text-xs text-base-content/40">{t('erasmus.tableBEmpty')}</p>
        </div>
      ) : (
        <div className="border border-base-300 rounded-xl overflow-hidden bg-base-100 shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 bg-base-200/50 border-b border-base-300 text-[10px] uppercase tracking-wider font-bold text-base-content/40">
            <span className="w-20">{t('erasmus.colCode')}</span>
            <span>{t('erasmus.colMendeluCourse')}</span>
            <span className="w-12 text-right">{t('erasmus.colECTS')}</span>
            <span className="w-5" />
          </div>

          {selected.map(s => (
            <TableBRow
              key={s.code}
              subject={s}
              displayCredits={s.credits < 999 ? s.credits : (exaUpCredits.get(s.code) ?? 0)}
              onRemove={() => onToggle(s.code)}
            />
          ))}

          {/* Total */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-3 py-2 bg-base-200/30 border-t border-base-300 text-xs">
            <span className="font-bold text-base-content/50 w-20">{t('erasmus.total')}</span>
            <span />
            <span className="tabular-nums font-black w-12 text-right">{totalCredits}</span>
            <span className="w-5" />
          </div>
        </div>
      )}
    </div>
  );
}