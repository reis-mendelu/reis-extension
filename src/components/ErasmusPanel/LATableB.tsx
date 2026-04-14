import { useRef, useState } from 'react';
import { X, GripVertical } from 'lucide-react';
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
}

function TableBRow({ subject, displayCredits, onRemove, onDragStart, onDragOver, onDrop, isDragOver }: {
  subject: SubjectStatus;
  displayCredits: number;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  isDragOver: boolean;
}) {
  const displayName = useCourseName(subject.code, subject.name);

  return (
    <div
      className={`border-b border-base-300/50 last:border-b-0 transition-colors ${isDragOver ? 'bg-primary/5 border-primary/30' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 items-center px-3 py-2 text-xs hover:bg-base-200/30 transition-colors">
        <div
          draggable
          onDragStart={onDragStart}
          className="cursor-grab active:cursor-grabbing text-base-content/20 hover:text-base-content/40 transition-colors"
        >
          <GripVertical size={12} />
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
    </div>
  );
}

export function LATableB({ plan, selectedCodes, onToggle, tableACourses, onReorder }: Props) {
  const { t } = useTranslation();
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  const handleDragStart = (i: number) => { dragIndex.current = i; };
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIndex(i); };
  const handleDrop = (i: number) => {
    if (dragIndex.current !== null && dragIndex.current !== i) onReorder(dragIndex.current, i);
    dragIndex.current = null;
    setDragOverIndex(null);
  };
  const handleDragEnd = () => { dragIndex.current = null; setDragOverIndex(null); };

  return (
    <div className="flex flex-col gap-2" onDragEnd={handleDragEnd}>
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
          <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 px-3 py-2 bg-base-200/50 border-b border-base-300 text-[10px] uppercase tracking-wider font-bold text-base-content/40">
            <span className="w-3" />
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
              onRemove={() => onToggle(s.code)}
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              isDragOver={dragOverIndex === i && dragIndex.current !== i}
            />
          ))}

          {/* Total */}
          <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 items-center px-3 py-2 bg-base-200/30 border-t border-base-300 text-xs">
            <span className="w-3" />
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
