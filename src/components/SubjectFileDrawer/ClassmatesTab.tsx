import { useState, useMemo } from 'react';
import { Search, Users } from 'lucide-react';
import { useClassmates } from '../../hooks/data/useClassmates';
import { useSubjectClassmates } from '../../hooks/data/useSubjectClassmates';
import { useTranslation } from '../../hooks/useTranslation';
import { ClassmatesListSkeleton } from './ClassmatesListSkeleton';
import { useAppStore } from '../../store/useAppStore';
import { ISBacklink } from './ISBacklink';
import { NoSeminarState } from './NoSeminarState';
import { ClassmatesScopeToggle, type ClassmatesScope } from './ClassmatesScopeToggle';
import { ClassmatesList } from './ClassmatesList';
import { ClassmatePersonDrawer } from '../Classmates/ClassmatePersonDrawer';
import type { Classmate } from '../../types/classmates';

interface ClassmatesTabProps {
  /** Off for the phone sheet — see `showIsBacklink` in DrawerTabBody. */
  showIsBacklink?: boolean;
  courseCode: string;
  /**
   * Takes over the row tap. The phone passes this to reach its own
   * `PersonSheet` — the one search already opens, with roles, office and the
   * map button — instead of `ClassmatePersonDrawer`, which left the app with
   * two different person views and gave the phone the weaker one.
   */
  onSelectPerson?: (classmate: Classmate) => void;
  /**
   * Off for the phone, where the study programme only ever rendered clipped
   * mid-word ("PEF B-OI-ZBOI prez [se…") and squeezed the name onto two lines.
   */
  showStudyInfo?: boolean;
}

/**
 * Cvičení / Celý předmět. The seminar group is the default and comes with the
 * sync; the whole subject — hundreds of students over many IS pages — is read
 * only once the student switches to it. A lecture-only subject has no seminar
 * group, so it opens on the whole subject instead.
 */
export function ClassmatesTab({
  courseCode,
  showIsBacklink = true,
  onSelectPerson,
  showStudyInfo = true,
}: ClassmatesTabProps) {
  const { t, language } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Classmate | null>(null);
  const [chosenScope, setChosenScope] = useState<ClassmatesScope | null>(null);
  const seminar = useClassmates(courseCode);
  // Lecture-only: there is no seminar group to read.
  const noSeminar = seminar.noSeminar && (seminar.classmates?.length ?? 0) === 0;
  const scope = chosenScope ?? (noSeminar ? 'subject' : 'seminar');
  const subject = useSubjectClassmates(courseCode, scope === 'subject');
  const current = scope === 'subject' ? subject : seminar;
  const showNoSeminar = scope === 'seminar' && noSeminar;

  const refreshSubject = useAppStore((s) => s.refreshSubjectClassmates);
  const refreshSeminar = useAppStore((s) => s.refreshClassmatesForSubject);
  const subjectInfo = useAppStore((s) => (courseCode ? s.subjects?.data[courseCode] : undefined));
  const studium = useAppStore((s) => s.studiumId);
  const obdobi = useAppStore((s) => s.obdobiId);

  const lang = language === 'cz' ? 'cz' : 'en';
  const subjectId = subjectInfo?.subjectId;
  const classmatesUrl =
    studium && obdobi
      ? subjectId
        ? `https://is.mendelu.cz/auth/student/spoluzaci.pl?predmet=${subjectId};;studium=${studium};obdobi=${obdobi};lang=${lang}`
        : `https://is.mendelu.cz/auth/student/spoluzaci.pl?studium=${studium};obdobi=${obdobi};lang=${lang}`
      : null;

  const openPerson = (student: Classmate) =>
    onSelectPerson ? onSelectPerson(student) : setSelected(student);

  const total = current.classmates?.length ?? 0;
  const filteredClassmates = useMemo(() => {
    const list = current.classmates ?? [];
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.personId.toString().includes(q)
    );
  }, [current.classmates, searchQuery]);

  const emptyState = (message: string, onRetry?: () => void) => (
    <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
      <Users size={48} className="mb-4 opacity-20" />
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={onRetry}>
          {t('classmates.retry')}
        </button>
      )}
    </div>
  );

  const renderBody = () => {
    if (current.error && filteredClassmates.length === 0) {
      const retry = scope === 'subject' ? refreshSubject : refreshSeminar;
      return emptyState(t('classmates.loadFailed'), () => retry(courseCode));
    }
    if (showNoSeminar) {
      return (
        <NoSeminarState isUrl={classmatesUrl} onShowSubject={() => setChosenScope('subject')} />
      );
    }
    if (filteredClassmates.length === 0) return emptyState(t('classmates.noneFound'));
    return (
      <>
        <p className="mb-3 text-xs font-medium text-base-content/70">
          {t(scope === 'subject' ? 'classmates.fromSubject' : 'classmates.fromSeminar', {
            count: total,
          })}
        </p>
        <ClassmatesList
          classmates={filteredClassmates}
          showStudyInfo={showStudyInfo}
          onOpen={openPerson}
        />
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-base-100">
      <div className="flex flex-col gap-3 px-6 py-4 border-b border-base-300">
        <ClassmatesScopeToggle scope={scope} onChange={setChosenScope} />
        {!showNoSeminar && (
          <div className="relative">
            <input
              type="text"
              placeholder={t('classmates.search')}
              className="input input-sm input-bordered w-full h-10 pl-9 rounded-lg bg-base-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none z-10"
            />
          </div>
        )}
      </div>
      {current.isLoading && !current.classmates?.length ? (
        <ClassmatesListSkeleton
          message={t(
            scope === 'subject' ? 'classmates.loadingSubject' : 'classmates.loadingSeminar'
          )}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {renderBody()}
          {classmatesUrl && showIsBacklink && !showNoSeminar && <ISBacklink href={classmatesUrl} />}
        </div>
      )}
      <ClassmatePersonDrawer classmate={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
