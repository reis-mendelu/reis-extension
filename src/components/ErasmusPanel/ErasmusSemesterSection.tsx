import { ChevronDown, Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useCourseName } from '@/hooks/ui/useCourseName';
import type { SemesterBlock, SubjectStatus } from '@/types/studyPlan';

interface Props {
  block: SemesterBlock;
  open: boolean;
  dimmed?: boolean;
  failRates: Record<string, number | null>;
  selectedCodes: Set<string>;
  onToggle: () => void;
  onToggleCourse: (code: string) => void;
  onOpenSubject: (courseCode: string, courseName?: string, courseId?: string) => void;
  onSearchSubject: (name: string) => void;
}

function SelectableRow({ subject, failRate, selected, onToggle, onOpen }: {
  subject: SubjectStatus;
  failRate: number | null;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const displayName = useCourseName(subject.code, subject.name);

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-base-200/50 transition-colors group">
      <input
        type="checkbox"
        className="checkbox checkbox-xs checkbox-primary shrink-0"
        checked={selected}
        onChange={onToggle}
      />
      <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-2 text-left">
        <span className="text-xs font-mono text-base-content/50 shrink-0">{subject.code}</span>
        <span className="text-sm truncate flex-1">{displayName}</span>
      </button>
      {failRate != null && (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
          failRate >= 25 ? 'bg-error/10 text-error'
            : failRate >= 20 ? 'bg-warning/15 text-warning-content'
            : 'bg-base-content/5 text-base-content/40'
        }`}>
          {failRate}%
        </span>
      )}
      <span className="text-xs text-base-content/40 shrink-0">{subject.credits} kr.</span>
    </div>
  );
}

export function ErasmusSemesterSection({
  block, open, dimmed, failRates, selectedCodes, onToggle, onToggleCourse, onOpenSubject, onSearchSubject,
}: Props) {
  const { t } = useTranslation();
  const allSubjects = block.groups.flatMap(g => g.subjects);
  const totalCredits = allSubjects.filter(s => s.credits <= 50).reduce((a, s) => a + s.credits, 0);
  const selectedCount = allSubjects.filter(s => selectedCodes.has(s.code)).length;

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${open ? 'border-base-content/20 bg-base-100 shadow-sm' : 'border-base-300'} ${dimmed ? 'opacity-40' : ''}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${open ? 'bg-base-200/30' : 'hover:bg-base-200/50'}`}
      >
        <div className="w-1 h-8 rounded-full bg-base-content/20 shrink-0" />
        <Clock className="w-4 h-4 text-base-content/40 shrink-0" />
        <span className="text-sm font-semibold flex-1 text-left">{block.title}</span>
        <span className="text-[11px] text-base-content/40 shrink-0">{totalCredits} kr.</span>
        {selectedCount > 0 && (
          <span className="badge badge-sm badge-primary">{selectedCount} {t('erasmus.selected')}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-base-content/40 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-2 pb-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {block.groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-2' : ''}>
              {block.groups.length > 1 && (
                <div className="text-[11px] text-base-content/40 font-medium px-3 py-1 uppercase tracking-wider">{group.name}</div>
              )}
              {group.subjects.map(s => (
                <SelectableRow
                  key={s.code}
                  subject={s}
                  failRate={failRates[s.code] ?? null}
                  selected={selectedCodes.has(s.code)}
                  onToggle={() => onToggleCourse(s.code)}
                  onOpen={() => s.id ? onOpenSubject(s.code, s.name, s.id) : onSearchSubject(s.name)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
