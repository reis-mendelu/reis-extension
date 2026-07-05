import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { SocietyLoginForm } from './SocietyLoginForm';

export function SocietyAdminOverlay() {
  const open = useAppStore((s) => s.adminOverlayOpen);
  const close = useAppStore((s) => s.closeAdminOverlay);
  const logout = useAppStore((s) => s.adminLogout);
  const session = useAppStore((s) => s.adminSession);
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="modal modal-open" role="dialog">
      <div className="modal-box max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">{t('admin.title_panel')}</h3>
          <button className="btn btn-ghost btn-sm" onClick={close}>✕</button>
        </div>
        {session ? (
          <>
            <p className="text-sm text-base-content/70">{t('admin.reisAdminNote')}</p>
            <button className="btn btn-ghost btn-sm mt-4" onClick={() => void logout()}>{t('admin.logout')}</button>
          </>
        ) : <SocietyLoginForm />}
      </div>
      <div className="modal-backdrop" onClick={close} />
    </div>
  );
}
