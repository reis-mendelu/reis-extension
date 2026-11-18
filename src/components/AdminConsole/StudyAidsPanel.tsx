import { useState, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import type { AdminStudyAids } from '../../api/adminStudyAids';
import {
  audienceFromDraft,
  draftFromAudience,
  type AudienceDraft,
} from '../../utils/partnerAudience';
import { AudiencePicker } from './AudiencePicker';

function StudyAidsAdminRow({ row, locked }: { row: AdminStudyAids; locked: boolean }) {
  const { t } = useTranslation();
  const save = useAppStore((s) => s.saveAdminStudyAids);
  const [draft, setDraft] = useState(() => draftFromAudience(row.audience));
  const [active, setActive] = useState(row.isActive);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  // Editing the audience ends the complaint about it; submit still validates.
  const editDraft = (next: SetStateAction<AudienceDraft>) => {
    setInvalid(false);
    setDraft(next);
  };

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
      <AudiencePicker draft={draft} setDraft={editDraft} legend={t('admin.studyAids.audience')} />
      {invalid && (
        <p role="alert" className="text-xs text-error">
          {t('admin.studyAids.invalid')}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-sm self-start"
        disabled={busy || locked}
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
  const loading = useAppStore((s) => s.adminStudyAidsLoading);
  const failed = useAppStore((s) => s.adminStudyAidsFailed);
  const reload = useAppStore((s) => s.loadAdminStudyAids);
  const showFailure = failed && !loading;

  return (
    <section data-testid="admin-study-aids" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-base-content">{t('admin.studyAids.title')}</h3>
      <p className="text-xs text-base-content/70">{t('admin.studyAids.note')}</p>
      {rows === null && loading && (
        <p className="text-sm text-base-content/70">{t('admin.studyAids.loading')}</p>
      )}
      {/* A failed read, with or without a list from an earlier one: what is shown
          may be stale, so say so, offer the retry, and keep Save off (`locked`). */}
      {showFailure && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-base-content/70">{t('admin.studyAids.loadError')}</p>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => void reload()}>
            {t('admin.studyAids.retry')}
          </button>
        </div>
      )}
      {rows?.length === 0 && (
        <p className="text-sm text-base-content/70">{t('admin.studyAids.empty')}</p>
      )}
      {/* Keyed on what the server holds, not only the id: reopening the tab
          shows the list the store kept while a new read runs, and a row that
          comes back changed must replace the editor's fields, or a later Save
          would write the old switch and programmes back. A reload that brings
          the same row keeps the editor, and what the admin has typed in it. */}
      {rows?.map((row) => (
        // Save is off while a fresh read is out, and after one that failed: the
        // editor may still hold the list from the last visit, and Save would
        // write its values back.
        <StudyAidsAdminRow
          key={`${row.id}:${row.isActive}:${row.audience.join(',')}`}
          row={row}
          locked={loading || failed}
        />
      ))}
    </section>
  );
}
