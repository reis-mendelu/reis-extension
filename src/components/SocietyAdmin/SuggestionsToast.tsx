import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// Render-less. Announces untriaged suggestions once per app open to a reIS
// admin. Toasts and t() live in components in this codebase — never in slices,
// which have no access to `t` at all. The ref guard keeps a later store change
// (marking one triaged) from re-firing the announcement mid-session.
export function SuggestionsToast() {
  const unread = useAppStore((s) => (s.adminRole === 'reis_admin' ? s.suggestionsUnread : 0));
  const { t } = useTranslation();
  const announced = useRef(false);

  useEffect(() => {
    if (announced.current || unread === 0) return;
    announced.current = true;
    toast.info(t('admin.newSuggestions', { count: unread }));
  }, [unread, t]);

  return null;
}
