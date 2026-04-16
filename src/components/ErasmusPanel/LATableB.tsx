import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useCourseName } from '@/hooks/ui/useCourseName';
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';

interface TableACourse {
  code: string;
  name: string;
  credits: number;
}

interface Props {
  plan: StudyPlan;
  selectedCodes: string[];
  onToggle: (code: string) => void;
  tableACourses: TableACourse[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  hoveredRowIndex?: number | null;
}

function TableBRow({ subject, displayCredits, isFirst, isLast, onMoveUp, onMoveDown, onRemove }: {
  subject: SubjectStatus;
  displayCredits: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  isHovered?: boolean;
}) {
  const displayName = useCourseName(subject.code, subject.name);

  return (
    <div className={`grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 items-center px-3 py-2 border-b border-base-300/50 last:border-b-0 text-xs transition-colors ${isHovered ? 'bg-primary/10 border-primary/30 shadow-[inset_3px_0_0_oklch(var(--p))]' : 'hover:bg-base-200/30'}`}>
      <div className="flex flex-col gap-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="btn btn-ghost w-4 h-3.5 min-h-0 p-0 text-base-content/20 hover:text-primary disabled:opacity-0 disabled:pointer-events-none rounded-none"
        >
          <ChevronUp size={11} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="btn btn-ghost w-4 h-3.5 min-h-0 p-0 text-base-content/20 hover:text-primary disabled:opacity-0 disabled:pointer-events-none rounded-none"
        >
          <ChevronDown size={11} />
        </button>
      </div>
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
  );
}

export function LATableB({ plan, selectedCodes, onToggle, tableACourses, onReorder, hoveredRowIndex }: Props) {
  const { t } = useTranslation();

  const allSubjects = (plan.blocks || []).flatMap(b => (b.groups || []).flatMap(g => g.subjects || []));
  const selected: SubjectStatus[] = (selectedCodes || [])
    .map(code => allSubjects.find(s => s.code === code))
    .filter((s): s is SubjectStatus => s !== undefined);

  const tableATotal = tableACourses.reduce((sum, c) => sum + c.credits, 0);
  const knownBTotal = selected.reduce((sum, s) => s.credits < 999 ? sum + s.credits : sum, 0);
  const positionalExaTotal = selected.reduce((sum, s, i) => s.credits >= 999 ? sum + (tableACourses[i]?.credits ?? 0) : sum, 0);
  const residual = Math.max(0, tableATotal - knownBTotal - positionalExaTotal);

  const displayCredits = selected.map((s, i) =>
    s.credits >= 999 ? (tableACourses[i]?.credits ?? 0) : s.credits
  );
  const lastExaIdx = selected.map((s, i) => s.credits >= 999 ? i : -1).filter(i => i >= 0).pop();
  if (residual > 0 && lastExaIdx !== undefined) displayCredits[lastExaIdx] += residual;

  const totalCredits = displayCredits.reduce((sum, c) => sum + c, 0);

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
          <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 px-3 py-2 bg-base-200/50 border-b border-base-300 text-[10px] uppercase tracking-wider font-bold text-base-content/40">
            <span className="w-4" />
            <span className="w-20">{t('erasmus.colCode')}</span>
            <span>{t('erasmus.colMendeluCourse')}</span>
            <span className="w-12 text-right">{t('erasmus.colECTS')}</span>
            <span className="w-5" />
          </div>

          {selected.map((s, i) => (
            <TableBRow
              key={s.code}
              subject={s}
              displayCredits={displayCredits[i]}
              isFirst={i === 0}
              isLast={i === selected.length - 1}
              onMoveUp={() => onReorder(i, i - 1)}
              onMoveDown={() => onReorder(i, i + 1)}
              onRemove={() => onToggle(s.code)}
              isHovered={hoveredRowIndex === i}
            />
          ))}

          <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 items-center px-3 py-2 bg-base-200/30 border-t border-base-300 text-xs">
            <span className="w-4" />
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
