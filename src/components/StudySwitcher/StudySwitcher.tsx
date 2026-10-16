import { useId, useState } from 'react';
import { Check, GraduationCap } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

/** "PEF B-EM komb [sem 1, roč 1]" → ["PEF B-EM komb", "sem 1, roč 1"]. */
function splitLabel(label: string): [string, string] {
  const m = /^(.*?)\s*\[(.*)\]\s*$/.exec(label);
  return m ? [m[1]!, m[2]!] : [label, '']; // safe: both groups required
}

/**
 * Which of the student's ACTIVE studies reIS shows (decision 2026-10-16).
 *
 * Renders nothing with fewer than two: a single-study student — nearly
 * everyone — sees no change. Interrupted and finished studies are never in
 * `studies` (see `resolveStudies`), so they are never offered.
 *
 * One component for both trees: the extension's profile popup (`compact`)
 * and the phone/iPad Profile tab, so the two cannot drift apart.
 */
export function StudySwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const studies = useAppStore((s) => s.studies);
  const studiumId = useAppStore((s) => s.studiumId);
  const switching = useAppStore((s) => s.studySwitching);
  const loadingFor = useAppStore((s) => s.studyPendingFor);
  const switchStudy = useAppStore((s) => s.switchStudy);
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const labelId = useId();

  if (studies.length < 2) return null;

  const choose = async (studium: string) => {
    if (switching || studium === studiumId) return;
    setFailed(false);
    setPending(studium);
    const ok = await switchStudy(studium);
    setPending(null);
    setFailed(!ok);
  };

  const row = compact ? 'min-h-9 px-2 py-1.5 text-xs' : 'min-h-11 px-3 py-2 text-sm';

  return (
    <div
      data-testid="study-switcher"
      className={`flex flex-col gap-1.5 ${compact ? '' : 'md:max-w-md'}`}
    >
      <span
        id={labelId}
        className={`flex items-center gap-1.5 font-semibold text-base-content/70 ${compact ? 'text-xs' : 'text-sm'}`}
      >
        <GraduationCap size={compact ? 14 : 16} aria-hidden="true" />
        {t('studySwitcher.label')}
      </span>
      <div
        // Toggle buttons, not radios: a radio group moves its choice with the
        // arrow keys, and each choice here is a switch that re-syncs a study.
        role="group"
        aria-labelledby={labelId}
        className="flex flex-col overflow-hidden rounded-lg border border-base-300"
      >
        {studies.map((s) => {
          const [name, rawDetail] = splitLabel(s.label);
          // IS writes the detail in Czech whatever the UI language is.
          const sy = /^sem\s+(\d+),\s+roč\s+(\d+)$/.exec(rawDetail);
          const detail = sy
            ? t('studySwitcher.detail', { semester: sy[1]!, year: sy[2]! }) // safe: both groups required
            : rawDetail;
          const selected = s.studium === studiumId;
          const busy = pending === s.studium || (selected && loadingFor === s.studium);
          return (
            <button
              key={s.studium}
              type="button"
              aria-pressed={selected}
              disabled={switching}
              onClick={() => void choose(s.studium)}
              className={`flex w-full items-center gap-2 border-b border-base-300 text-left last:border-b-0 disabled:cursor-wait ${row} ${
                selected ? 'bg-primary/10 text-base-content' : 'bg-base-100 hover:bg-base-200'
              }`}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold leading-tight">{name}</span>
                {detail && (
                  <span className="text-base-content/70 leading-tight tabular-nums">{detail}</span>
                )}
              </span>
              {busy ? (
                <span role="status" className="flex items-center">
                  <span className="loading loading-spinner loading-xs text-primary" />
                  <span className="sr-only">
                    {t(pending === s.studium ? 'studySwitcher.switching' : 'studySwitcher.loading')}
                  </span>
                </span>
              ) : (
                selected && <Check size={16} className="text-primary" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      {failed && (
        <span role="alert" className={`text-error ${compact ? 'text-xs' : 'text-sm'}`}>
          {t('studySwitcher.failed')}
        </span>
      )}
    </div>
  );
}
