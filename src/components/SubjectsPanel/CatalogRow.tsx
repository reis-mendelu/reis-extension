import type { Subject } from '@/api/search/types';

interface Props {
  subject: Subject;
  failRate: number | null;
  onOpen: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void;
}

function failClass(rate: number): string {
  if (rate >= 30) return 'bg-error/15 text-error';
  if (rate >= 20) return 'bg-warning/15 text-warning';
  return 'bg-success/15 text-success';
}

export function CatalogRow({ subject, failRate, onOpen }: Props) {
  const handleClick = () => onOpen(subject.code, subject.name, subject.id, subject.faculty, 'stats');
  const facultyChip = subject.faculty && subject.faculty !== 'N/A' ? subject.faculty : null;
  return (
    <button onClick={handleClick} className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-base-200 transition-colors text-left">
      {facultyChip && (
        <span
          className="badge badge-sm text-[10px] font-medium shrink-0"
          style={subject.facultyColor ? { backgroundColor: `${subject.facultyColor}22`, color: subject.facultyColor, borderColor: 'transparent' } : undefined}
        >
          {facultyChip}
        </span>
      )}
      <span className="font-mono text-[10px] text-base-content/40 shrink-0">{subject.code}</span>
      <span className="flex-1 text-sm truncate">{subject.name}</span>
      {subject.semester && subject.semester !== 'N/A' && (
        <span className="text-[10px] text-base-content/40 font-mono shrink-0 hidden sm:inline">{subject.semester}</span>
      )}
      <span className={`flex items-center justify-center h-5 px-1.5 rounded text-[10px] font-medium shrink-0 ${failRate != null ? failClass(failRate) : 'bg-base-content/5 text-base-content/30'}`}>
        {failRate != null ? `${failRate}%` : '—'}
      </span>
    </button>
  );
}
