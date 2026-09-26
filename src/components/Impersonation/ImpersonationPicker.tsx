import { useId, useState, type ReactNode } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { ImpersonationErrorCode } from '../../api/impersonation/types';

const ERROR_KEY: Record<ImpersonationErrorCode, string> = {
  options: 'impersonation.errorOptions',
  timetable: 'impersonation.errorTimetable',
  noPlan: 'impersonation.errorNoPlan',
  noSemester: 'impersonation.errorNoSemester',
  notAdmin: 'impersonation.errorNotAdmin',
  expired: 'impersonation.expired',
};

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-base-content/70">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const SELECT = 'select select-bordered select-sm w-full';

/** Shared by the desktop drawer and the phone sheet. `onStarted` closes the sheet. */
export function ImpersonationPicker({ onStarted }: { onStarted?: () => void }) {
  const { t } = useTranslation();
  const options = useAppStore((s) => s.impersonationOptions);
  const status = useAppStore((s) => s.impersonationOptionsStatus);
  const groupsById = useAppStore((s) => s.impersonationGroups);
  const starting = useAppStore((s) => s.impersonationStarting);
  const error = useAppStore((s) => s.impersonationError);
  const loadGroups = useAppStore((s) => s.loadImpersonationGroups);
  const start = useAppStore((s) => s.startImpersonation);
  const [faculty, setFaculty] = useState('');
  const [programId, setProgramId] = useState('');
  const [year, setYear] = useState(1);
  const [group, setGroup] = useState<number | null>(null);

  if (status === 'loading' || (!options && status !== 'error'))
    return <p className="p-4 text-sm text-base-content/70">{t('impersonation.loading')}</p>;

  const programmes = options?.find((f) => f.faculty === faculty)?.programmes ?? [];
  const programme = programmes.find((p) => p.programId === programId);
  const groups = programme ? groupsById[programme.programId] : undefined;

  const pickFaculty = (f: string) => {
    setFaculty(f);
    setProgramId('');
    setYear(1);
    setGroup(null);
  };
  // Groups are asked for here, in the handler — never from an effect.
  const pickProgramme = (id: string) => {
    setProgramId(id);
    setYear(1);
    setGroup(null);
    const p = programmes.find((x) => x.programId === id);
    if (p) void loadGroups(p);
  };
  const submit = async () => {
    if (!programme) return;
    const { programId: pid, shortCode, name, rozvrh } = programme;
    const req = {
      programId: pid,
      shortCode,
      name,
      faculty,
      year,
      group: year === 1 ? group : null,
      rozvrh,
    };
    if (await start(req)) onStarted?.();
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <Field label={t('impersonation.faculty')}>
        {(id) => (
          <select
            id={id}
            className={SELECT}
            value={faculty}
            onChange={(e) => pickFaculty(e.target.value)}
          >
            <option value="" disabled>
              —
            </option>
            {options?.map((f) => (
              <option key={f.faculty} value={f.faculty}>
                {f.faculty}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={t('impersonation.programme')}>
        {(id) => (
          <select
            id={id}
            className={SELECT}
            value={programId}
            disabled={!faculty}
            onChange={(e) => pickProgramme(e.target.value)}
          >
            <option value="" disabled>
              —
            </option>
            {programmes.map((p) => (
              <option key={p.programId} value={p.programId}>{`${p.shortCode} ${p.name}`}</option>
            ))}
          </select>
        )}
      </Field>
      <Field label={t('impersonation.year')}>
        {(id) => (
          <select
            id={id}
            className={SELECT}
            value={year}
            disabled={!programme}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {(programme?.years ?? [1]).map((y) => (
              <option key={y} value={y}>
                {t('impersonation.yearN', { n: y })}
              </option>
            ))}
          </select>
        )}
      </Field>
      {year === 1 && programme && (
        <Field label={t('impersonation.group')}>
          {(id) => (
            <select
              id={id}
              className={SELECT}
              value={group ?? ''}
              disabled={!Array.isArray(groups)}
              onChange={(e) => setGroup(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">
                {groups === 'loading'
                  ? t('impersonation.groupsLoading')
                  : t('impersonation.groupAll')}
              </option>
              {Array.isArray(groups) &&
                groups.map((g) => (
                  <option key={g} value={g}>
                    {t('impersonation.groupN', { n: g })}
                  </option>
                ))}
            </select>
          )}
        </Field>
      )}
      <p className="text-xs text-base-content/70">{t('impersonation.scopeNote')}</p>
      {(error || status === 'error') && (
        <p className="text-xs text-error">{t(ERROR_KEY[error ?? 'options'])}</p>
      )}
      <button
        className="btn btn-primary btn-sm"
        disabled={!programme || starting}
        onClick={() => void submit()}
      >
        {starting ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          t('impersonation.start')
        )}
      </button>
    </div>
  );
}
