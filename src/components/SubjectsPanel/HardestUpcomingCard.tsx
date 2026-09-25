import { useState } from 'react';
import { Flame, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useCourseName } from '@/hooks/ui/useCourseName';
import type { HardestEntry } from './insights';
import { failRateTone } from './failRateTone';
import { SubjectCredits } from './SubjectCredits';

interface Props {
  entries: HardestEntry[];
  onOpenSubject: (
    courseCode: string,
    courseName: string,
    courseId: string,
    facultyCode?: string,
    initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates',
    isFulfilled?: boolean
  ) => void;
  onSearchSubject: (name: string) => void;
}

function Row({
  entry,
  onOpen,
  onSearch,
}: {
  entry: HardestEntry;
  onOpen: Props['onOpenSubject'];
  onSearch: Props['onSearchSubject'];
}) {
  const { t } = useTranslation();
  const { subject, stat, semesters } = entry;
  const displayName = useCourseName(subject.code, subject.name);
  const handleClick = () => {
    if (subject.id)
      onOpen(subject.code, subject.name, subject.id, undefined, 'stats', subject.isFulfilled);
    else onSearch(subject.code);
  };
  const rateLabel = `${t('subjects.failRateLabel')} ${stat.rate} %`;
  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-base-200 transition-colors text-left"
    >
      {semesters.length > 0 && (
        <span className="font-mono text-[10px] text-base-content/70 whitespace-nowrap shrink-0">
          {semesters.join('·')}.<span className="hidden md:inline"> sem.</span>
        </span>
      )}
      {/* Under the name, as in the study-plan rows below — `SubjectCredits`. */}
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-sm truncate">{displayName}</span>
        <SubjectCredits credits={subject.credits} />
      </span>
      {/* The number alone, with the words said once per page in
          `FailRateLegend` — the arrangement the semester rows below already
          use. This card spelled them out on every row instead, which at 320px
          was most of the row and made one screen describe the same figure two
          different ways. `title`/`aria-label` keep the sentence for a pointer
          and a screen reader; unlike the hover-only label #265 removed, the
          legend is visible to a thumb. */}
      <span
        title={rateLabel}
        aria-label={rateLabel}
        className={`group/fail flex items-center justify-center h-5 px-1.5 rounded text-[10px] font-medium tabular-nums shrink-0 ${failRateTone(stat.rate)}`}
      >
        {stat.rate}%
      </span>
    </button>
  );
}

export function HardestUpcomingCard({ entries, onOpenSubject, onSearchSubject }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border border-base-300 bg-base-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-base-200/50 transition-colors text-left"
      >
        <Flame className="w-4 h-4 text-error shrink-0" />
        <span className="text-sm font-semibold flex-1">{t('subjects.insights.hardestTitle')}</span>
        <ChevronDown
          className={`w-4 h-4 text-base-content/70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-1 pb-2 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
          {entries.map((e) => (
            <Row key={e.subject.code} entry={e} onOpen={onOpenSubject} onSearch={onSearchSubject} />
          ))}
        </div>
      )}
    </div>
  );
}
