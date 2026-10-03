import { useTranslation } from '../../hooks/useTranslation';

/** Whose list the Spolužáci tab shows: the seminar group, or everyone taking the subject. */
export type ClassmatesScope = 'seminar' | 'subject';

interface ClassmatesScopeToggleProps {
  scope: ClassmatesScope;
  onChange: (scope: ClassmatesScope) => void;
}

export function ClassmatesScopeToggle({ scope, onChange }: ClassmatesScopeToggleProps) {
  const { t } = useTranslation();
  const option = (key: ClassmatesScope, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={scope === key}
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
      role="tablist"
      aria-label={t('classmates.scopeLabel')}
      className="tabs tabs-box tabs-sm w-full flex-nowrap"
    >
      {option('seminar', t('classmates.seminar'))}
      {option('subject', t('classmates.wholeSubject'))}
    </div>
  );
}
