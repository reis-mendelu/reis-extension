import { Search } from 'lucide-react';
import type { SubjectStatus } from '@/types/studyPlan';
import { useTranslation } from '@/hooks/useTranslation';

interface SubjectRowProps {
  subject: SubjectStatus;
  onOpenSubject: (courseCode: string, courseName: string, courseId: string) => void;
  onSearchSubject: (name: string) => void;
}

export function SubjectRow({ subject, onOpenSubject, onSearchSubject }: SubjectRowProps) {
  const { t } = useTranslation();
  const hasId = subject.id !== '';

  const handleClick = () => {
    if (hasId) {
      onOpenSubject(subject.code, subject.name, subject.id);
    } else {
      onSearchSubject(subject.name);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-base-200 transition-colors text-left group"
    >
      <span className="badge badge-sm badge-ghost font-mono shrink-0">{subject.code}</span>
      <span className="flex-1 text-sm truncate">{subject.name}</span>
      <span className="text-xs text-base-content/50 shrink-0">{subject.credits} kr.</span>
      {subject.isFulfilled ? (
        <span className="badge badge-sm badge-success">{t('subjects.fulfilled')}</span>
      ) : subject.isEnrolled ? (
        <span className="badge badge-sm badge-primary badge-outline">
          {subject.isEnrolled ? subject.rawStatusText : ''}
        </span>
      ) : !hasId ? (
        <span className="badge badge-sm badge-ghost gap-1">
          <Search className="w-3 h-3" />
          {t('subjects.searchToOpen')}
        </span>
      ) : (
        <span className="badge badge-sm badge-ghost">{subject.rawStatusText || t('subjects.notFulfilled')}</span>
      )}
    </button>
  );
}
