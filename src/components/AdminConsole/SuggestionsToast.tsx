import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { markAnnounced, wasAnnounced } from './suggestionsAnnounced';

// Render-less. Announces untriaged suggestions once per admin session to a
// reIS admin. Toasts and t() live in components in this codebase — never in
// slices, which have no access to `t` at all.
//
// Mounted in the admin console AND the student app (AppOverlays), since only
// one of them is on screen at a time: in the app alone, the console — which
// App.tsx renders instead of it — never announced (release review). So the
// "already announced" mark is module-level and keyed by the session's email: a
// remount between the two does not announce again, a fresh session does.
export function SuggestionsToast() {
  const unread = useAppStore((s) => (s.adminRole === 'reis_admin' ? s.suggestionsUnread : 0));
  const email = useAppStore((s) => s.adminSession?.user?.email ?? null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!email) {
      markAnnounced(null);
      return;
    }
    if (unread === 0 || wasAnnounced(email)) return;
    markAnnounced(email);
    toast.info(t('admin.newSuggestions', { count: unread }));
  }, [unread, email, t]);

  return null;
}
