import { useState } from 'react';
import { User } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PersonPhoto } from '../ui/PersonPhoto';
import type { Classmate } from '../../types/classmates';

/**
 * Rows rendered per step. Every row loads its photo from IS, so a 519-student
 * lecture rendered at once is 519 photo requests; 40 is IS's own page size.
 * Remount (a `key`) to start over at the first step.
 */
export const CLASSMATES_STEP = 40;

interface ClassmatesListProps {
  classmates: Classmate[];
  showStudyInfo: boolean;
  onOpen: (classmate: Classmate) => void;
}

export function ClassmatesList({ classmates, showStudyInfo, onOpen }: ClassmatesListProps) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(CLASSMATES_STEP);
  const remaining = classmates.length - limit;
  const next = Math.min(CLASSMATES_STEP, remaining);

  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        {classmates.slice(0, limit).map((student) => (
          <div
            key={student.personId}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(student)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(student);
              }
            }}
            className="flex items-center justify-between p-3 rounded-xl border border-base-200 bg-base-100 hover:border-primary/20 hover:shadow-sm transition-all group cursor-pointer text-left"
          >
            <div className="flex items-center gap-4 group/profile flex-1">
              <div className="avatar">
                <div className="w-14 h-14 rounded-full ring-1 ring-base-200 ring-offset-base-100 ring-offset-2 group-hover/profile:ring-primary/40 transition-all">
                  <PersonPhoto
                    personId={student.personId}
                    alt={student.name}
                    className="w-full h-full object-cover scale-[1.05]"
                    fallback={
                      <div className="bg-neutral text-neutral-content w-full h-full flex items-center justify-center">
                        <User size={24} strokeWidth={1.5} />
                      </div>
                    }
                  />
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-bold text-base-content leading-tight">
                    {student.name}
                  </span>
                  {showStudyInfo && student.studyInfo && (
                    <>
                      <span className="text-base-content/20">•</span>
                      <span
                        className="text-xs text-base-content/60 line-clamp-1 max-w-[150px] md:max-w-[250px] mt-0.5"
                        title={student.studyInfo}
                      >
                        {student.studyInfo}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm mt-3 w-full"
          onClick={() => setLimit((l) => l + CLASSMATES_STEP)}
        >
          {t('classmates.showMore', { count: next })}
        </button>
      )}
    </>
  );
}
