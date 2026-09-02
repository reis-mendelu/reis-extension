import { useMemo, useRef, useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSearch } from '../../SearchBar/useSearch';
import { SearchResultItem } from '../../SearchBar/SearchResultItem';
import type { SearchResult } from '../../SearchBar/types';
import { ScreenHeader } from './calendar/ScreenHeader';
import { StudentSearch, type StudentMode } from './student/StudentSearch';

const RECENT_PEOPLE_LIMIT = 5;
// useSearch's own floor (`query.trim().length < 2` bails before any fetch).
const MIN_PEOPLE_QUERY = 2;

function NoResults({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-base-content/50">{text}</p>;
}

function Searching({ text }: { text: string }) {
  return (
    <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-base-content/50">
      <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" />
      {text}
    </p>
  );
}

export function StudentScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<StudentMode>('people');
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // The iPad keyboard covers most of the list, and the field has no Done key of
  // its own. Blurring on every render once results arrive would fight anyone
  // still typing, so it is bound to the gestures that mean "I'm done typing,
  // let me look": Return (in StudentSearch), scrolling the list, and tapping a
  // person.
  const dismissKeyboard = () => inputRef.current?.blur();

  const pushSheet = useAppStore((s) => s.pushSheet);
  const recentPeople = useAppStore((s) => s.recentPeople);

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
    <div data-testid="student-screen" className="flex flex-1 flex-col overflow-hidden">
      <ScreenHeader title={t('mobile.student.title')} />
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
        className="flex-1 overflow-y-auto pb-24 pt-2"
      >
        {mode === 'subjects' && (
          <>
            {/* The catalogue search is scoped to the student's own faculty by
                default, and a subject from another one is simply absent until
                the scope widens — which is exactly what "it does not work for
                subjects outside my faculty" meant on the iPad. The desktop and
                the old MobileSearchOverlay both render this; the Student tab
                did not, so the way out was unreachable on a phone.

                Above the results, not below them as on the desktop: this list
                runs to dozens of rows on a phone, and a control the student has
                to scroll past every result to reach is the same dead end in a
                politer form. */}
            {hasQuery && canScopeToFaculty && (
              <div className="flex items-center justify-between gap-2 border-t border-base-300 px-4 py-2.5">
                <span className="truncate text-[11px] text-base-content/50">
                  {scope === 'faculty'
                    ? t('search.facultyScopeNote')
                    : t('search.universityScopeNote')}
                </span>
                <button
                  type="button"
                  // The preventDefault stays on mouseDown — the input is
                  // focused and a click would blur it first, which on iPad
                  // drops the keyboard and scrolls the list out from under the
                  // finger mid-tap. The ACTION belongs on click: keyboard
                  // activation of a button dispatches click and never
                  // mousedown, so with both on mousedown, Enter and Space could
                  // not change the scope at all — and an iPad with a keyboard
                  // is the device this control was added for.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (scope === 'faculty') widenToUniversity();
                    else narrowToFaculty();
                  }}
                  className="flex shrink-0 items-center gap-1.5 text-xs text-primary"
                >
                  <Globe size={14} />
                  {scope === 'faculty'
                    ? t('search.widenToUniversity')
                    : t('search.narrowToFaculty')}
                </button>
              </div>
            )}

            {hasQuery && subjectResults.length > 0 && (
              <>
                <div className="px-4 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider text-base-content/60">
                  {t('mobile.student.results')}
                </div>
                {subjectResults.map((result) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    isRecent={false}
                    isSelected={false}
                    onMouseEnter={() => {}}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      openSubject(result);
                    }}
                  />
                ))}
              </>
            )}

            {/* Same order as Lidé, and for the same reason: a query too short
                to search has no answer, an in-flight one does not have it yet,
                and only a finished search that came back empty has earned
                "nothing found". */}
            {canSearchPeople && subjectResults.length === 0 && searchingPeople && (
              <Searching text={t('search.loading')} />
            )}
            {canSearchPeople && subjectResults.length === 0 && !searchingPeople && (
              <NoResults text={noResultsText} />
            )}
          </>
        )}

        {mode === 'people' && (
          <>
            {!hasQuery && shownPeople.length > 0 && (
              <>
                <div className="px-4 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider text-base-content/60">
                  {t('mobile.student.recentPeople')}
                </div>
                {shownPeople.map((result) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    isRecent={false}
                    isSelected={false}
                    onMouseEnter={() => {}}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      openPerson(result);
                    }}
                  />
                ))}
              </>
            )}

            {hasQuery && peopleResults.length > 0 && (
              <>
                <div className="px-4 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider text-base-content/60">
                  {t('mobile.student.results')}
                </div>
                {peopleResults.map((result) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    isRecent={false}
                    isSelected={false}
                    onMouseEnter={() => {}}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      openPerson(result);
                    }}
                  />
                ))}
              </>
            )}

            {/* Order matters: a query too short to search has no answer, an
                in-flight one does not have it yet, and only a finished search
                that came back empty has earned "nothing found". */}
            {canSearchPeople && peopleResults.length === 0 && searchingPeople && (
              <Searching text={t('search.loading')} />
            )}
            {canSearchPeople && peopleResults.length === 0 && !searchingPeople && (
              <NoResults text={noResultsText} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
