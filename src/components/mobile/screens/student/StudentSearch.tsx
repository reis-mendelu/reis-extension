import { Search } from 'lucide-react';
import type { RefObject } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';

export type StudentMode = 'pages' | 'people' | 'subjects';

interface StudentSearchProps {
  mode: StudentMode;
  onModeChange: (mode: StudentMode) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Owned by StudentScreen, which also dismisses the keyboard on scroll. */
  inputRef?: RefObject<HTMLInputElement | null>;
}

/**
 * The Student screen's top chrome: the Stránky IS / Lidé / Předměty segmented control
 * plus the search input whose placeholder (and accessible name) follows the
 * active segment.
 */
export function StudentSearch({
  mode,
  onModeChange,
  query,
  onQueryChange,
  inputRef,
}: StudentSearchProps) {
  const { t } = useTranslation();
  const PLACEHOLDER_KEY: Record<StudentMode, string> = {
    pages: 'mobile.student.searchPages',
    people: 'mobile.student.searchPeople',
    subjects: 'mobile.student.searchSubjects',
  };
  const placeholder = t(PLACEHOLDER_KEY[mode]);

  return (
    <div className="flex flex-shrink-0 flex-col gap-2.5 px-4 pt-3.5">
      {/* Mapped, not three copies of the same button: the segment styling and
          the aria wiring drifted the moment there was more than one of them. */}
      <div role="tablist" className="flex gap-1 rounded-lg bg-base-200 p-1">
        {(
          [
            ['pages', 'mobile.student.tabPages'],
            ['people', 'mobile.student.tabPeople'],
            ['subjects', 'mobile.student.tabSubjects'],
          ] as const
        ).map(([value, labelKey]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => onModeChange(value)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
              mode === value ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/60'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2.5 rounded-full border border-base-300 bg-base-100 px-4 py-3">
        <Search size={17} className="flex-shrink-0 text-base-content/40" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          // Not type="search": iOS then draws its own clear button inside a
          // field that already sits in a custom pill, and the role changes from
          // textbox to searchbox. enterKeyHint alone relabels the return key.
          enterKeyHint="search"
          // On iPad the software keyboard hides most of the results list, and
          // there is no on-screen Done. Return is the explicit "I'm finished
          // typing" gesture, so it drops the keyboard; the query is already
          // live, so there is nothing left to submit.
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full bg-transparent text-base text-base-content outline-none placeholder:text-base-content/40"
        />
      </div>
    </div>
  );
}
