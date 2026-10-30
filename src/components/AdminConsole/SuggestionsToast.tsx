import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// Render-less. Announces untriaged suggestions once per admin session to a
// reIS admin. Toasts and t() live in components in this codebase — never in
// slices, which have no access to `t` at all.
//
// Mounted in the admin console and the desktop app (AppOverlays), one at a time:
// in the app alone, the console — which App.tsx renders instead of it — never
// announced. The "already announced" mark is store state
// (suggestionsAnnouncedFor), so a remount between the two does not announce
// again, and adminLogout clears it for the next sign-in.
export function SuggestionsToast() {
  const unread = useAppStore((s) => (s.adminRole === 'reis_admin' ? s.suggestionsUnread : 0));
  const email = useAppStore((s) => s.adminSession?.user?.email ?? null);
  const announcedFor = useAppStore((s) => s.suggestionsAnnouncedFor);
  const markAnnounced = useAppStore((s) => s.markSuggestionsAnnounced);
  const { t } = useTranslation();

  useEffect(() => {
    // Still mounted when the session goes (the desktop app): forget it here too.
    if (!email) {
      if (announcedFor !== null) markAnnounced(null);
      return;
    }
    if (unread === 0 || announcedFor === email) return;
    markAnnounced(email);
    toast.info(t('admin.newSuggestions', { count: unread }));
  }, [unread, email, announcedFor, markAnnounced, t]);

  return null;
}
