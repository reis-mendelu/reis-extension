import { useListedSocieties } from '../../hooks/useSociety';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// reIS admins only. The RLS policies on spolky_events accept any association_id
// from a reis_admin session, so switching society here is the whole of what
// separates the two roles — there is no privileged code path behind it.
export function SocietyPicker() {
  const active = useAppStore((s) => s.adminActiveAssociationId);
  const setActive = useAppStore((s) => s.setActiveAssociation);
  const { t } = useTranslation();
  const societies = useListedSocieties();

  return (
    <select
      aria-label={t('admin.pickSociety') as string}
      className="select select-bordered select-sm w-48"
      value={active ?? ''}
      onChange={(e) => setActive(e.target.value)}
    >
      <option value="" disabled>
        {t('admin.pickSociety') as string}
      </option>
      {societies.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
