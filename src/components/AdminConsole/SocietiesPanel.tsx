import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { ORGANIZERS, type Society } from '../../types/events';
import { SocietyLogo } from '../SocietyLogo';
import { SocietyForm } from './SocietyForm';

// A hairline under the section: the accounts panel follows directly, and its
// first control would otherwise read as part of this form.
const SECTION = 'border-b border-base-content/10 pb-6';

/** reIS-admin-only list of every society, hidden ones included. */
export function SocietiesPanel() {
  const { t, language } = useTranslation();
  const catalog = useAppStore((s) => s.societies);
  const setSocietyActive = useAppStore((s) => s.setSocietyActive);
  const [editing, setEditing] = useState<Society | 'new' | null>(null);
  const all = Object.values(catalog).sort((a, b) => a.sortOrder - b.sortOrder);

  if (editing) {
    return (
      <div className={SECTION}>
        <SocietyForm
          society={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${SECTION}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{t('admin.societies.title')}</h3>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
          {t('admin.societies.add')}
        </button>
      </div>
      {all.map((s) => (
        <div key={s.id} className="flex items-center gap-2 rounded-lg border border-base-300 p-2">
          <SocietyLogo society={s} className="h-8 w-8 rounded-md text-xs" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{s.name}</div>
            <div className="truncate text-xs text-base-content/70">
              {s.facultyKey === 'mendelu'
                ? t('admin.societies.wholeMendelu')
                : ORGANIZERS[s.facultyKey][language === 'en' ? 'en' : 'cz']}
              {!s.isActive && ` · ${t('admin.societies.hidden')}`}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditing(s)}>
            {t('admin.societies.edit')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => void setSocietyActive(s.id, !s.isActive)}
          >
            {s.isActive ? t('admin.societies.hide') : t('admin.societies.show')}
          </button>
        </div>
      ))}
    </div>
  );
}
