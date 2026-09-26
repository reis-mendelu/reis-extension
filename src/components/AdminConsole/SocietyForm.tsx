import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createSocietyAccount } from '../../api/societyAccounts';
import { ORGANIZERS, type FacultyKey, type Society } from '../../types/events';
import { autoFollowHolder, validateSocietyDraft } from './societyFormRules';
import { GeneratedPasswordDialog } from './GeneratedPasswordDialog';
import { LogoPreview } from './LogoPreview';

const FACULTIES = Object.keys(ORGANIZERS) as FacultyKey[];

/** Add (no `society`) or edit one society. reis_admin only; RLS is the real gate. */
export function SocietyForm({ society, onDone }: { society?: Society; onDone: () => void }) {
  const { t, language } = useTranslation();
  const catalog = useAppStore((s) => s.societies);
  const saveSociety = useAppStore((s) => s.saveSociety);
  const loadSocietyAccounts = useAppStore((s) => s.loadSocietyAccounts);
  const isNew = !society;
  const [id, setId] = useState(society?.id ?? '');
  const [name, setName] = useState(society?.name ?? '');
  const [shortName, setShortName] = useState(society?.shortName ?? '');
  const [color, setColor] = useState(society?.color ?? '#0046a0');
  const [facultyKey, setFacultyKey] = useState<FacultyKey>(society?.facultyKey ?? 'mendelu');
  const [autoFollow, setAutoFollow] = useState(society?.autoFollowFaculty ?? false);
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState<string | null>(null);

  const holder = autoFollowHolder(catalog, facultyKey, id);

  const submit = async () => {
    if (busy) return;
    const invalid = validateSocietyDraft(
      { id, name, shortName, color, hasLogo: Boolean(logo) },
      isNew,
      catalog
    );
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      const failure = await persist(autoFollow && facultyKey !== 'mendelu');
      if (failure) setError(failure);
      else if (!isNew) onDone();
    } catch {
      // The encoder rejects an unreadable image; the button must come back.
      setError('errors.save_failed');
    } finally {
      setBusy(false);
    }
  };

  /** Returns an i18n error key, or null when everything saved. */
  const persist = async (autoFollowFaculty: boolean): Promise<string | null> => {
    // One default per faculty: release it from the holder first, and give it
    // back if the replacement fails, so the faculty is never left without one.
    const released = autoFollowFaculty && holder ? holder : null;
    if (released) {
      const moved = await saveSociety({ ...released, autoFollowFaculty: false }, null, false);
      if (moved.error) return `errors.${moved.error}`;
    }
    const res = await saveSociety(
      { id, name, shortName, color, facultyKey, autoFollowFaculty },
      logo,
      isNew
    );
    if (res.error) {
      if (released) await saveSociety({ ...released, autoFollowFaculty: true }, null, false);
      return `errors.${res.error}`;
    }
    if (!isNew) return null;
    const account = await createSocietyAccount(id, name.trim());
    if (!account.password) return 'errors.account_failed';
    setPassword(account.password);
    // The accounts panel below reads the store; without this it keeps
    // offering to create the account that now exists.
    await loadSocietyAccounts();
    return null;
  };

  const field = 'flex flex-col gap-1 text-sm';
  const facultyName = (k: FacultyKey) =>
    k === 'mendelu'
      ? t('admin.societies.wholeMendelu')
      : ORGANIZERS[k][language === 'en' ? 'en' : 'cz'];

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold">
        {isNew ? t('admin.societies.add') : `${t('admin.societies.edit')}: ${society.name}`}
      </h3>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.id')}</span>
        <input
          className="input input-bordered w-full"
          value={id}
          disabled={!isNew}
          onChange={(e) => setId(e.target.value.trim())}
        />
        <span className="text-xs text-base-content/70">{t('admin.societies.idHint')}</span>
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.name')}</span>
        <input
          className="input input-bordered w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.shortName')}</span>
        <input
          className="input input-bordered w-full"
          value={shortName}
          maxLength={24}
          onChange={(e) => setShortName(e.target.value)}
        />
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.color')}</span>
        <input
          type="color"
          className="input input-bordered h-10 w-20 p-1"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.faculty')}</span>
        <select
          className="select select-bordered w-full"
          value={facultyKey}
          onChange={(e) => setFacultyKey(e.target.value as FacultyKey)}
        >
          {FACULTIES.map((k) => (
            <option key={k} value={k}>
              {facultyName(k)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="checkbox checkbox-sm checkbox-primary"
          checked={autoFollow && facultyKey !== 'mendelu'}
          disabled={facultyKey === 'mendelu'}
          onChange={(e) => setAutoFollow(e.target.checked)}
        />
        <span>
          {t('admin.societies.autoFollow')}
          {autoFollow && holder && (
            <span className="block text-xs text-base-content/70">
              {t('admin.societies.autoFollowMoves', { from: holder.name })}
            </span>
          )}
        </span>
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.logo')}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="file-input file-input-bordered file-input-sm w-full"
          onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
        />
      </label>
      {logo && <LogoPreview file={logo} />}
      {error && (
        <p role="alert" className="text-error text-sm">
          {t(`admin.societies.${error}`)}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>
          {t('admin.societies.save')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          {t('admin.societies.cancel')}
        </button>
      </div>
      {password && (
        <GeneratedPasswordDialog
          password={password}
          login={id}
          onClose={() => {
            setPassword(null);
            onDone();
          }}
        />
      )}
    </div>
  );
}
