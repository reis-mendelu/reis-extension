import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createSocietyAccount } from '../../api/societyAccounts';
import { ORGANIZERS, type FacultyKey, type Society } from '../../types/events';
import { isUsablePinColor } from '../../utils/societies/pinColor';
import { GeneratedPasswordDialog } from './GeneratedPasswordDialog';

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const FACULTIES = Object.keys(ORGANIZERS) as FacultyKey[];

/** Add (no `society`) or edit one society. reis_admin only; RLS is the real gate. */
export function SocietyForm({ society, onDone }: { society?: Society; onDone: () => void }) {
  const { t, language } = useTranslation();
  const catalog = useAppStore((s) => s.societies);
  const saveSociety = useAppStore((s) => s.saveSociety);
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

  const holder = Object.values(catalog).find(
    (s) => s.autoFollowFaculty && s.facultyKey === facultyKey && s.id !== id && s.isActive
  );

  const validate = (): string | null => {
    if (isNew && !ID_RE.test(id)) return 'errors.id';
    if (isNew && catalog[id]) return 'errors.idTaken';
    if (!name.trim() || !shortName.trim()) return 'errors.required';
    if (!isUsablePinColor(color)) return 'errors.color';
    if (isNew && !logo) return 'errors.logo_required';
    return null;
  };

  const submit = async () => {
    if (busy) return;
    const invalid = validate();
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    const autoFollowFaculty = autoFollow && facultyKey !== 'mendelu';
    // The database allows one default per faculty: release it from the holder first.
    if (autoFollowFaculty && holder) {
      const moved = await saveSociety({ ...holder, autoFollowFaculty: false }, null, false);
      if (moved.error) {
        setBusy(false);
        return setError(`errors.${moved.error}`);
      }
    }
    const res = await saveSociety(
      { id, name, shortName, color, facultyKey, autoFollowFaculty },
      logo,
      isNew
    );
    if (res.error) {
      setBusy(false);
      return setError(`errors.${res.error}`);
    }
    if (isNew) {
      const account = await createSocietyAccount(id, name.trim());
      if (account.password) setPassword(account.password);
      else setError('errors.account_failed');
    }
    setBusy(false);
    if (!isNew) onDone();
  };

  const field = 'flex flex-col gap-1 text-sm';
  const facultyName = (k: FacultyKey) =>
    k === 'mendelu'
      ? t('admin.societies.wholeMendelu')
      : ORGANIZERS[k][language === 'en' ? 'en' : 'cz'];

  return (
    <div className="flex flex-col gap-3">
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.id')}</span>
        <input
          className="input input-bordered"
          value={id}
          disabled={!isNew}
          onChange={(e) => setId(e.target.value.trim())}
        />
        <span className="text-xs text-base-content/70">{t('admin.societies.idHint')}</span>
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.name')}</span>
        <input
          className="input input-bordered"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.shortName')}</span>
        <input
          className="input input-bordered"
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
          className="select select-bordered"
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
          className="file-input file-input-bordered file-input-sm"
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

/** Square preview of the picked file; the object URL is revoked when it changes. */
function LogoPreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <img src={url} alt="" className="h-16 w-16 rounded-md object-cover ring-1 ring-base-300" />
  );
}
