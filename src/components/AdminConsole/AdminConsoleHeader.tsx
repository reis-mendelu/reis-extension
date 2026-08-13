import { ArrowLeft, LogOut } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { societyById } from '../../data/societies';
import { logError } from '../../utils/reportError';
import { SocietyChip } from './SocietyChip';
import { SocietyPicker } from './SocietyPicker';

// The console's own chrome. "Zpět do reIS" leaves for the student app without
// dropping the session — logging out is the separate, deliberate action next to
// it, which is why it lives here rather than in the student profile popover.
export function AdminConsoleHeader({ compact = false }: { compact?: boolean }) {
  const role = useAppStore((s) => s.adminRole);
  const activeId = useAppStore((s) => s.adminActiveAssociationId);
  const close = useAppStore((s) => s.closeSocietyAdmin);
  const logout = useAppStore((s) => s.adminLogout);
  const { t } = useTranslation();
  const society = activeId ? societyById(activeId) : null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-base-300 bg-base-100 px-3">
      <button type="button" className="btn btn-ghost btn-sm gap-1.5" onClick={close}>
        <ArrowLeft size={16} />
        <span className={compact ? 'sr-only' : ''}>{t('admin.backToReis') as string}</span>
      </button>
      {!compact && (
        <span className="text-sm font-bold opacity-70">{t('admin.consoleTitle') as string}</span>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-2">
        {role === 'reis_admin' ? <SocietyPicker /> : society && <SocietyChip society={society} />}
        <button
          type="button"
          className="btn btn-ghost btn-sm gap-1.5"
          onClick={() => void logout().catch((e) => logError('AdminConsole.logout', e))}
        >
          <LogOut size={15} />
          <span className={compact ? 'sr-only' : ''}>{t('admin.logout') as string}</span>
        </button>
      </div>
    </header>
  );
}
