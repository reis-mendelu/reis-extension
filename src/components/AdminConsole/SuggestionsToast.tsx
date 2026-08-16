import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// Render-less. Announces untriaged suggestions once per admin session to a
// reIS admin. Toasts and t() live in components in this codebase — never in
// slices, which have no access to `t` at all. The ref guard is keyed by the
// admin session's email (not a plain boolean) because this component is
// mounted once at the app root and survives logout/login, which only flip
// store fields. Keying by identity lets a fresh session (same or different
// admin) announce again, while a later store change (marking one triaged)
// within the same session doesn't re-fire it.
export function SuggestionsToast() {
  const unread = useAppStore((s) => (s.adminRole === 'reis_admin' ? s.suggestionsUnread : 0));
  const email = useAppStore((s) => s.adminSession?.user?.email ?? null);
  const { t } = useTranslation();
  const announcedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!email) {
      announcedFor.current = null;
      return;
    }
    if (unread === 0 || announcedFor.current === email) return;
    announcedFor.current = email;
    toast.info(t('admin.newSuggestions', { count: unread }));
  }, [unread, email, t]);

  return null;
}
