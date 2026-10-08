import { Eye, MousePointerClick, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// Seen · Opened · Link tapped for one event, each once per DEVICE
// (api/eventSignals dedupes locally; the server gets an event id and nothing
// else). Counted from the October 2026 release on: the older view/click
// numbers measured something else (every Novinky tap) and are not shown.
export function EventStats({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const s = useAppStore((st) => st.societyEventSignals[eventId]);
  if (!s) return null;
  const item = (Icon: typeof Eye, key: string, count: number) => (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <Icon size={11} className="flex-shrink-0" aria-hidden />
      <span>{t(key, { count })}</span>
    </span>
  );
  return (
    // Three numbers beside the row's actions do not fit one line at 320–430px:
    // each stays whole and the row wraps between them, never inside one.
    <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-base-content/70">
      {item(Eye, 'admin.eventSeen', s.seen)}
      {item(MousePointerClick, 'admin.eventOpened', s.opened)}
      {item(ExternalLink, 'admin.eventLinkTaps', s.linkTaps)}
    </span>
  );
}

/** The one-line key to the numbers, shown once some listed row has them. */
export function EventStatsNote({ eventIds }: { eventIds: string[] }) {
  const { t } = useTranslation();
  const any = useAppStore((st) => eventIds.some((id) => st.societyEventSignals[id]));
  if (!any) return null;
  return (
    <p className="px-3 pb-4 pt-3 text-[11px] text-base-content/70">{t('admin.eventStatsNote')}</p>
  );
}
