import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import type { AdminStudyAids } from '../../api/adminStudyAids';
import { audienceFromDraft, draftFromAudience } from '../../utils/partnerAudience';
import { AudiencePicker } from './AudiencePicker';

function StudyAidsAdminRow({ row }: { row: AdminStudyAids }) {
  const { t } = useTranslation();
  const save = useAppStore((s) => s.saveAdminStudyAids);
  const [draft, setDraft] = useState(() => draftFromAudience(row.audience));
  const [active, setActive] = useState(row.isActive);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const audience = audienceFromDraft(draft);
    setInvalid(audience === 'invalid');
    if (audience === 'invalid') return;
    setBusy(true);
    const ok = await save(row.id, { audience, isActive: active });
    setBusy(false);
    if (ok) toast.success(t('admin.studyAids.saved'));
    else toast.error(t('admin.studyAids.error'));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-3">
      <span className="text-sm font-medium">{row.id}</span>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="toggle toggle-sm"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        {t('admin.studyAids.active')}
      </label>
      <AudiencePicker draft={draft} setDraft={setDraft} legend={t('admin.studyAids.audience')} />
      {invalid && (
        <p role="alert" className="text-xs text-error">
          {t('admin.studyAids.invalid')}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-sm self-start"
        disabled={busy}
        onClick={() => void submit()}
      >
        {t('admin.studyAids.save')}
      </button>
    </div>
  );
}

/**
 * "Studijní opory" (reis_admin only, inside Otázky on both console layouts):
 * who is shown the link to the study aids under Předměty. Not a partner and not
 * a society, so no logo and no entry in the partner list: only an audience
 * (faculty and programme codes) and a switch. The student's device matches it.
 */
export function StudyAidsPanel() {
  const { t } = useTranslation();
  const rows = useAppStore((s) => s.adminStudyAids);

  return (
    <section data-testid="admin-study-aids" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-base-content">{t('admin.studyAids.title')}</h3>
      <p className="text-xs text-base-content/70">{t('admin.studyAids.note')}</p>
      {rows === null && (
        <p className="text-sm text-base-content/70">{t('admin.studyAids.loadError')}</p>
      )}
      {rows?.length === 0 && (
        <p className="text-sm text-base-content/70">{t('admin.studyAids.empty')}</p>
      )}
      {rows?.map((row) => (
        <StudyAidsAdminRow key={row.id} row={row} />
      ))}
    </section>
  );
}
