import { useTranslation } from '../../hooks/useTranslation';

/** Whose list the Spolužáci tab shows: the seminar group, or everyone taking the subject. */
export type ClassmatesScope = 'seminar' | 'subject';

interface ClassmatesScopeToggleProps {
  scope: ClassmatesScope;
  onChange: (scope: ClassmatesScope) => void;
}

/**
 * Two pressed buttons in a labelled group, not tabs: the choice filters the
 * one list below (with the search box in between), so there is no tabpanel to
 * own, and two Tab stops beat a roving-focus widget for two options. Same
 * pattern as the phone calendar's `CalendarViewSwitch`. The daisyUI `tab`
 * classes stay for the look; `tab-active` drives it, not `aria-selected`.
 */
export function ClassmatesScopeToggle({ scope, onChange }: ClassmatesScopeToggleProps) {
  const { t } = useTranslation();
  const option = (key: ClassmatesScope, label: string) => (
    <button
      type="button"
      aria-pressed={scope === key}
      className={`tab flex-1 whitespace-nowrap px-2 ${
        scope === key ? 'tab-active font-semibold' : 'text-base-content/70'
      }`}
      onClick={() => onChange(key)}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label={t('classmates.scopeLabel')}
      className="tabs tabs-box tabs-sm w-full flex-nowrap"
    >
      {option('seminar', t('classmates.seminar'))}
      {option('subject', t('classmates.wholeSubject'))}
    </div>
  );
}
