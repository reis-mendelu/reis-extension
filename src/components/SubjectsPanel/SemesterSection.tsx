import { ChevronDown, CheckCircle2, BookOpen, Clock } from 'lucide-react';
import type { SemesterBlock, Zamerani } from '@/types/studyPlan';
import type { ZameraniProgress } from './SubjectsPanelHeader';
import { SubjectRow } from './SubjectRow';
import { getSemesterState, isRealCredits, normalizeZameraniName, type SemesterState } from './utils';

interface SemesterSectionProps {
  block: SemesterBlock;
  open: boolean;
  dimmed?: boolean;
  failRates?: Record<string, number | null>;
  zameraniLookup?: Map<string, Zamerani>;
  zameraniProgress?: Map<string, ZameraniProgress>;
  onToggle: () => void;
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void;
  onSearchSubject: (name: string) => void;
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

export function SemesterSection({ block, open, dimmed, failRates, zameraniLookup, zameraniProgress, onToggle, onOpenSubject, onSearchSubject }: SemesterSectionProps) {
  const state = getSemesterState(block);
  const cfg = stateConfig[state];

  const titleMatch = block.title.match(/^(\d+\.\s*semestr)/i);
  const cleanTitle = titleMatch ? titleMatch[1] : block.title.replace(/\s*\(dosud neaktivní\)/gi, '');

  const allSubjects = block.groups.flatMap(g => g.subjects);
  const fulfilledCount = allSubjects.filter(s => s.isFulfilled).length;
  const totalCount = allSubjects.length;
  const totalCredits = allSubjects.filter(s => isRealCredits(s.credits)).reduce((a, s) => a + s.credits, 0);
  const isPast = state === 'past';

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${open ? 'border-base-content/20 bg-base-100 shadow-sm' : `${cfg.border} ${state === 'current' ? 'bg-primary/5 ring-1 ring-primary/15' : ''}`} ${dimmed ? 'opacity-40' : ''} ${block.isWholePlanPool ? 'border-dashed' : ''}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${open ? 'bg-base-200/30' : 'hover:bg-base-200/50'}`}
      >
        <div className={`w-1 h-8 rounded-full ${cfg.indicator} shrink-0`} />
        <span className="text-sm font-semibold flex-1 text-left">{cleanTitle}</span>
        {totalCredits > 0 && (state !== 'future' || open) && (
          <span className="text-[11px] text-base-content/40 shrink-0">{totalCredits} kr.</span>
        )}
        <span className={cfg.badgeCls}>
          {fulfilledCount}/{totalCount}
        </span>
        <ChevronDown className={`w-4 h-4 text-base-content/40 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-2 pb-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {block.groups.map((group, gi) => {
            const statusText = (group.statusDescription || '').trim();
            const statusIsFulfilled = /^SPLN[ĚE]N/i.test(statusText) || /^FULFILLED/i.test(statusText);
            const statusCls = statusIsFulfilled ? 'text-success/70' : statusText ? 'text-warning/80' : 'text-base-content/40';
            // Live progress derived from subjects — independent of the server's statusDescription.
            const fulfilledInGroup = group.subjects.filter(s => s.isFulfilled).length;
            const liveProgress = group.minCount !== undefined
              ? `${Math.min(fulfilledInGroup, group.minCount)}/${group.minCount}`
              : null;
            return (
              <div key={gi} className={gi > 0 ? 'mt-2' : ''}>
                {(block.groups.length > 1 || statusText) && (
                  <div className="px-3 py-1 flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-base-content/40 font-medium uppercase tracking-wider truncate">{group.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {liveProgress && (
                        <span className="text-[10px] font-mono text-base-content/50">{liveProgress}</span>
                      )}
                      {statusText && (
                        <span className={`text-[10px] font-medium ${statusCls}`}>{statusText}</span>
                      )}
                    </span>
                  </div>
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
                    zamerani={zameraniLookup?.get(normalizeZameraniName(s.name)) ?? null}
                    zameraniProgress={zameraniProgress?.get(normalizeZameraniName(s.name)) ?? null}
                    onOpenSubject={onOpenSubject}
                    onSearchSubject={onSearchSubject}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
