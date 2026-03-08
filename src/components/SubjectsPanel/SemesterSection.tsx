import { ChevronDown, CheckCircle2, BookOpen, Clock } from 'lucide-react';
import type { SemesterBlock } from '@/types/studyPlan';
import { SubjectRow } from './SubjectRow';

type SemesterState = 'past' | 'current' | 'future';

interface SemesterSectionProps {
  block: SemesterBlock;
  open: boolean;
  dimmed?: boolean;
  failRates?: Record<string, number | null>;
  onToggle: () => void;
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: string) => void;
  onSearchSubject: (name: string) => void;
}

function getSemesterState(block: SemesterBlock): SemesterState {
  const all = block.groups.flatMap(g => g.subjects);
  if (all.length === 0) return 'future';
  const hasEnrolled = all.some(s => s.isEnrolled);
  if (hasEnrolled) return 'current';
  const allFulfilled = all.every(s => s.isFulfilled);
  if (allFulfilled) return 'past';
  const hasFulfilled = all.some(s => s.isFulfilled);
  return hasFulfilled ? 'past' : 'future';
}

const stateConfig: Record<SemesterState, {
  icon: typeof CheckCircle2;
  border: string;
  accent: string;
  indicator: string;
  badgeCls: string;
}> = {
  past: {
    icon: CheckCircle2,
    border: 'border-success/20',
    accent: 'text-success',
    indicator: 'bg-success',
    badgeCls: 'bg-success/15 text-success font-medium px-2 py-0.5 rounded text-[11px]',
  },
  current: {
    icon: BookOpen,
    border: 'border-primary/30',
    accent: 'text-primary',
    indicator: 'bg-primary',
    badgeCls: 'bg-primary/15 text-primary font-medium px-2 py-0.5 rounded text-[11px]',
  },
  future: {
    icon: Clock,
    border: 'border-base-300',
    accent: 'text-base-content/40',
    indicator: 'bg-base-content/20',
    badgeCls: 'bg-base-content/5 text-base-content/50 font-medium px-2 py-0.5 rounded text-[11px]',
  },
};

export function SemesterSection({ block, open, dimmed, failRates, onToggle, onOpenSubject, onSearchSubject }: SemesterSectionProps) {
  const state = getSemesterState(block);
  const cfg = stateConfig[state];
  const Icon = cfg.icon;

  const allSubjects = block.groups.flatMap(g => g.subjects);
  const fulfilledCount = allSubjects.filter(s => s.isFulfilled).length;
  const totalCount = allSubjects.length;
  const totalCredits = allSubjects.filter(s => s.credits <= 50).reduce((a, s) => a + s.credits, 0);
  const isPast = state === 'past';

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${open ? 'border-base-content/20 bg-base-100 shadow-sm' : cfg.border} ${dimmed ? 'opacity-40' : ''}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${open ? 'bg-base-200/30' : 'hover:bg-base-200/50'}`}
      >
        <div className={`w-1 h-8 rounded-full ${cfg.indicator} shrink-0`} />
        <Icon className={`w-4 h-4 ${cfg.accent} shrink-0`} />
        <span className="text-sm font-semibold flex-1 text-left">{block.title}</span>
        <span className="text-[11px] text-base-content/40 shrink-0">{totalCredits} kr.</span>
        <span className={cfg.badgeCls}>
          {fulfilledCount}/{totalCount}
        </span>
        <ChevronDown className={`w-4 h-4 text-base-content/40 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-2 pb-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {block.groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-2' : ''}>
              {block.groups.length > 1 && (
                <div className="text-[11px] text-base-content/40 font-medium px-3 py-1 uppercase tracking-wider">{group.name}</div>
              )}
              {[...group.subjects].sort((a, b) => {
                if (a.isFulfilled !== b.isFulfilled) return a.isFulfilled ? 1 : -1;
                const fa = failRates?.[a.code] ?? -1;
                const fb = failRates?.[b.code] ?? -1;
                return fb - fa;
              }).map(s => (
                <SubjectRow
                  key={s.code}
                  subject={s}
                  compact={isPast}
                  failRate={failRates?.[s.code]}
                  onOpenSubject={onOpenSubject}
                  onSearchSubject={onSearchSubject}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
