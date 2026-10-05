import { useRef } from 'react';
import { User } from 'lucide-react';
import { PersonPhoto } from '../ui/PersonPhoto';
import { useSeenOnce } from '../../hooks/ui/useSeenOnce';
import type { Classmate } from '../../types/classmates';

interface ClassmatesListProps {
  classmates: Classmate[];
  showStudyInfo: boolean;
  onOpen: (classmate: Classmate) => void;
}

/**
 * Every classmate, in the tab's own scroller — no nested scroll box, which on
 * the phone would stop the sheet's tab swipe reaching the list. The listing is
 * already in memory (classmatesListing reads every IS page up front); what
 * costs is the photos, one IS request each, so a 519-student lecture asks only
 * for the rows on screen. Not `loading="lazy"`: the <img> gets a data:
 * URL that usePersonPhoto has already fetched, so the fetch itself is gated.
 */
export function ClassmatesList({ classmates, showStudyInfo, onOpen }: ClassmatesListProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {classmates.map((student) => (
        <ClassmateRow
          key={student.personId}
          student={student}
          showStudyInfo={showStudyInfo}
          onOpen={() => onOpen(student)}
        />
      ))}
    </div>
  );
}

function ClassmateRow({
  student,
  showStudyInfo,
  onOpen,
}: {
  student: Classmate;
  showStudyInfo: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeenOnce(ref);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex items-center justify-between p-3 rounded-xl border border-base-200 bg-base-100 hover:border-primary/20 hover:shadow-sm transition-all group cursor-pointer text-left"
    >
      <div className="flex items-center gap-4 group/profile flex-1">
        <div className="avatar">
          <div className="w-14 h-14 rounded-full ring-1 ring-base-200 ring-offset-base-100 ring-offset-2 group-hover/profile:ring-primary/40 transition-all">
            <PersonPhoto
              personId={seen ? student.personId : null}
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
  );
}
