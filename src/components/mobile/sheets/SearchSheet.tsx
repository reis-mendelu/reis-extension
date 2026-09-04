import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import type { MobileSheet } from '../../../store/types';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSearch } from '../../SearchBar/useSearch';
import type { SearchResult } from '../../SearchBar/types';
import { Sheet } from '../primitives/Sheet';
import { SearchSubjectResults } from './search/SearchSubjectResults';
import { SearchPeopleResults } from './search/SearchPeopleResults';
import { SheetHeader } from '../primitives/SheetHeader';
import { StudentSearch, type StudentMode } from '../screens/student/StudentSearch';

const RECENT_PEOPLE_LIMIT = 5;
// useSearch's own floor (`query.trim().length < 2` bails before any fetch).
const MIN_PEOPLE_QUERY = 2;

export interface SearchSheetProps {
  sheet?: Extract<MobileSheet, { kind: 'search' }>;
  onClose: () => void;
}

/**
 * People and the subject catalogue, opened from the header's search icon.
 *
 * This was the "Student" TAB — a fifth of the phone's primary navigation spent
 * on a text field, on a screen whose whole content was that field and its
 * results. As a sheet it opens over whichever tab the student is on, closes
 * back to it, and frees the slot for the four real destinations.
 *
 * A sheet rather than a screen also fixes what the tab could not: the two
 * things search leads to (a subject drawer, a person card) push ON TOP of it,
 * so closing one returns to the results instead of to a cleared field.
 */
export function SearchSheet({ sheet, onClose }: SearchSheetProps) {
  const { t } = useTranslation();
  // A prefilled sheet is one opened from a subject, so it starts in subject
  // mode; the bare header icon starts on people, which is what it always did.
  const [mode, setMode] = useState<StudentMode>(sheet?.query ? 'subjects' : 'people');
  const [query, setQuery] = useState(sheet?.query ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  // The iPad keyboard covers most of the list, and the field has no Done key of
  // its own. Blurring on every render once results arrive would fight anyone
  // still typing, so it is bound to the gestures that mean "I'm done typing,
  // let me look": Return (in StudentSearch), scrolling the list, and tapping a
  // person.
  const dismissKeyboard = () => inputRef.current?.blur();

  const pushSheet = useAppStore((s) => s.pushSheet);
  const recentPeople = useAppStore((s) => s.recentPeople);
  const recentSubjects = useAppStore((s) => s.recentSubjects);

  // isLoading is read, not ignored: useSearch debounces 250ms and then goes to
  // the network, so `peopleResults` is empty for the whole round trip. Reading
  // only `sections` made the screen answer "nothing found" before it had asked.
  const {
    sections,
    isLoading,
    saveToHistory,
    scope,
    canScopeToFaculty,
    widenToUniversity,
    narrowToFaculty,
  } = useSearch(query);
  const peopleResults = sections.find((s) => s.key === 'people')?.results ?? [];
  // The section useSearch has always produced and this screen used to discard,
  // which is why a subject could be looked up on the desktop and nowhere on a
  // phone. It carries the student's enrolled subjects plus whatever the
  // catalogue search returned, already sorted by relevance.
  const subjectResults = sections.find((s) => s.key === 'subjects')?.results ?? [];
  // Everyone the student looked up, not just staff. This read the mixed history
  // and kept only `personType === 'teacher'` — so a classmate searched
  // yesterday was dropped here, and three IS-page lookups had already evicted
  // them from the store anyway. Five is the cap: enough to be useful, few
  // enough that the search box stays in reach on a phone.
  const shownPeople = useMemo(() => recentPeople.slice(0, RECENT_PEOPLE_LIMIT), [recentPeople]);
  // Same cap as people, for the same reason: enough to be useful, few enough
  // that the search box stays in reach on a phone.
  const shownSubjects = useMemo(
    () => recentSubjects.slice(0, RECENT_PEOPLE_LIMIT),
    [recentSubjects]
  );

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  // useSearch never queries below two characters, so a one-letter query has no
  // answer to report — neither results nor their absence.
  const canSearchPeople = trimmedQuery.length >= MIN_PEOPLE_QUERY;
  const searchingPeople = canSearchPeople && isLoading;
  const handleModeChange = (next: StudentMode) => {
    setMode(next);
    setQuery('');
  };

  // The drawer the app already has for a subject — syllabus, difficulty,
  // files — reached with the same three fields the desktop search passes it.
  const openSubject = (result: SearchResult) => {
    dismissKeyboard();
    saveToHistory(result);
    pushSheet({
      kind: 'subjectDrawer',
      courseCode: result.subjectCode ?? result.title,
      courseName: result.title,
      courseId: result.subjectId,
    });
  };

  const openPerson = (result: SearchResult) => {
    dismissKeyboard();
    saveToHistory(result);
    pushSheet({ kind: 'person', personId: result.id, personName: result.title });
  };

  const noResultsText = t('mobile.student.noResults');

  return (
    <Sheet size="full" onClose={onClose}>
      <div data-testid="search-sheet" className="flex min-h-0 flex-1 flex-col">
        {/* "Hledat", not "Student": the title was the name of the TAB this used
            to be, and a sheet opened by tapping a magnifier should say what it
            is. Same string as the button's own label. */}
        <SheetHeader title={t('mobile.header.search')} onClose={onClose} />
        <StudentSearch
          mode={mode}
          onModeChange={handleModeChange}
          query={query}
          onQueryChange={setQuery}
          inputRef={inputRef}
        />

        <div
          data-testid="student-results"
          onScroll={dismissKeyboard}
          className="flex-1 overflow-y-auto pb-6 pt-2"
        >
          {mode === 'subjects' && (
            <SearchSubjectResults
              subjectResults={subjectResults}
              hasQuery={hasQuery}
              canSearchPeople={canSearchPeople}
              searchingPeople={searchingPeople}
              scope={scope}
              canScopeToFaculty={canScopeToFaculty}
              widenToUniversity={widenToUniversity}
              narrowToFaculty={narrowToFaculty}
              shownSubjects={shownSubjects}
              openSubject={openSubject}
              noResultsText={noResultsText}
            />
          )}

          {mode === 'people' && (
            <SearchPeopleResults
              peopleResults={peopleResults}
              shownPeople={shownPeople}
              hasQuery={hasQuery}
              canSearchPeople={canSearchPeople}
              searchingPeople={searchingPeople}
              openPerson={openPerson}
              noResultsText={noResultsText}
            />
          )}
        </div>
      </div>
    </Sheet>
  );
}
