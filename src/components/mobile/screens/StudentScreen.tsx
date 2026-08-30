import { useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSearch } from '../../SearchBar/useSearch';
import { SearchResultItem } from '../../SearchBar/SearchResultItem';
import type { SearchResult } from '../../SearchBar/types';
import { pagesData, injectUserParams } from '../../../data/pages';
import { openExternal } from '../../../mobile/openExternal';
import { ScreenHeader } from './calendar/ScreenHeader';
import { StudentSearch, type StudentMode } from './student/StudentSearch';
import { ShortcutGrid, type ShortcutSheetKind } from './student/ShortcutGrid';
import { PageGroupList, type PageGroup } from './student/PageGroupList';
import { PagesDisclosure } from './student/PagesDisclosure';

const RECENT_PEOPLE_LIMIT = 5;
// useSearch's own floor (`query.trim().length < 2` bails before any fetch).
const MIN_PEOPLE_QUERY = 2;

function stripDiacritics(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildPageGroups(query: string, language: string): PageGroup[] {
  const normalized = stripDiacritics(query.trim());
  const pick = (label: string, labelEn?: string) =>
    language === 'en' && labelEn ? labelEn : label;

  return pagesData
    .map((category) => {
      const items = category.children
        .map((item) => ({ id: item.id, label: pick(item.label, item.labelEn), href: item.href }))
        .filter((item) => !normalized || stripDiacritics(item.label).includes(normalized));
      if (items.length === 0) return null;
      return { id: category.id, label: pick(category.label, category.labelEn), items };
    })
    .filter((group): group is PageGroup => group !== null);
}

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
  const { t, language } = useTranslation();
  const [mode, setMode] = useState<StudentMode>('pages');
  const [query, setQuery] = useState('');
  // Collapsed by default only where the screen is actually short of room. The
  // disclosure exists so 95 links do not bury the two shortcuts a student opens
  // daily (see PagesDisclosure) — on a phone. An iPad runs the same phone tree
  // at 810–1080pt (resolvePhoneViewport), where that same collapse leaves half
  // a screen empty under two shortcuts and hides the directory behind a tap
  // nobody has a reason to make. `isNarrow` is `max-width: 767px`, so this is
  // open on tablets and unchanged on phones. Initial state only: a student who
  // collapses it keeps it collapsed.
  const isNarrow = useAppStore((s) => s.isNarrow);
  const [pagesOpen, setPagesOpen] = useState(!isNarrow);
  const inputRef = useRef<HTMLInputElement>(null);

  // The iPad keyboard covers most of the list, and the field has no Done key of
  // its own. Blurring on every render once results arrive would fight anyone
  // still typing, so it is bound to the gestures that mean "I'm done typing,
  // let me look": Return (in StudentSearch), scrolling the list, and tapping a
  // person.
  const dismissKeyboard = () => inputRef.current?.blur();

  const pushSheet = useAppStore((s) => s.pushSheet);
  const studiumId = useAppStore((s) => s.studiumId);
  const recentPeople = useAppStore((s) => s.recentPeople);

  // isLoading is read, not ignored: useSearch debounces 250ms and then goes to
  // the network, so `peopleResults` is empty for the whole round trip. Reading
  // only `sections` made the screen answer "nothing found" before it had asked.
  const { sections, isLoading, saveToHistory } = useSearch(query);
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
  const pageGroups = useMemo(() => buildPageGroups(query, language), [query, language]);
  const pageCount = useMemo(
    () => pagesData.reduce((n, category) => n + category.children.length, 0),
    []
  );

  const handleModeChange = (next: StudentMode) => {
    setMode(next);
    setQuery('');
  };

  const openHref = (href: string) => {
    // openExternal, not window.open: on Capacitor that hands the URL to the
    // system browser, which has no IS session.
    void openExternal(injectUserParams(href, studiumId, language === 'en' ? 'en' : 'cz'));
  };

  const openSheet = (kind: ShortcutSheetKind) => {
    pushSheet(kind === 'eduroam' ? { kind: 'eduroam' } : { kind: 'docs' });
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
        {mode === 'pages' && (
          <>
            {!hasQuery && (
              <>
                <ShortcutGrid onOpenSheet={openSheet} />
                <PagesDisclosure
                  open={pagesOpen}
                  count={pageCount}
                  onToggle={() => setPagesOpen((v) => !v)}
                />
              </>
            )}
            {/* Searching bypasses the disclosure: the box above reaches every
                one of the 95 links whether or not the list is expanded, which
                is what makes hiding the long tail safe. */}
            {(hasQuery || pagesOpen) && pageGroups.length > 0 ? (
              <PageGroupList groups={pageGroups} onOpen={openHref} />
            ) : hasQuery ? (
              <NoResults text={noResultsText} />
            ) : null}
          </>
        )}

        {mode === 'subjects' && (
          <>
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
