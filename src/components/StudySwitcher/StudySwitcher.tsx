import { Check, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Which of a student's parallel studies reIS shows. IS keeps subjects, exams,
 * the study plan and assignments per study, and reIS runs on one at a time;
 * the timetable already holds both. Nothing renders for a student with one
 * study, which is almost everyone.
 *
 * Shared by both trees: the desktop profile popup and the phone/iPad profile
 * tab. Labels are IS's own (`PEF B-OI prez [sem 3, roč 2]`), verbatim.
 */
export function StudySwitcher({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const studies = useAppStore((s) => s.studies);
  const current = useAppStore((s) => s.studiumId);
  const status = useAppStore((s) => s.studySwitch);
  const switchStudy = useAppStore((s) => s.switchStudy);

  if (studies.length < 2) return null;
  const busy = status === 'switching';

  return (
    <div data-testid="study-switcher" className={className}>
      <div className="text-xs font-bold uppercase tracking-wider text-base-content/70">
        {t('settings.study')}
      </div>
      <p className="mt-0.5 text-xs leading-snug text-base-content/70">{t('settings.studyHint')}</p>
      {/* -mx-2: the rows' own padding then lines their text up with the
          heading, while the hover tint still has room around it. Toggle
          buttons, not radios: a radio group owes arrow-key navigation. */}
      <div role="group" aria-label={t('settings.study')} className="-mx-2 mt-1.5 flex flex-col">
        {studies.map((s) => {
          const active = s.studium === current;
          return (
            <button
              key={s.studium}
              type="button"
              aria-pressed={active}
              disabled={busy}
              onClick={() => {
                if (!active) void switchStudy(s.studium);
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-base-200 disabled:opacity-60"
            >
              <span className={`flex-1 text-sm ${active ? 'font-semibold' : ''}`}>{s.label}</span>
              {active && <Check size={16} className="flex-shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
      {busy && (
        <p role="status" className="mt-1 flex items-center gap-2 text-xs text-base-content/70">
          <Loader2 size={14} className="animate-spin" />
          {t('settings.studySwitching')}
        </p>
      )}
      {status === 'failed' && (
        <p role="alert" className="mt-1 text-xs text-error">
          {t('settings.studySwitchFailed')}
        </p>
      )}
    </div>
  );
}
