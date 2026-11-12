import type { SpolekNotification } from '../../services/spolky/types';
import { isIsNoticeRow } from '../../utils/isNoticeRows';
import { NotificationItem } from './NotificationItem';
import { IsNoticeItem } from './IsNoticeItem';

/**
 * One Novinky row, for BOTH trees (the extension's bell dropdown and the
 * phone's Novinky sheet), so an IS notice unfolds its text on either: chosen
 * here once rather than by a condition each list has to remember.
 */
export function NotificationRow({
  notification,
  onOpen,
  onVisible,
  clickable,
}: {
  notification: SpolekNotification;
  onOpen: () => void;
  onVisible?: () => void;
  clickable?: boolean;
}) {
  if (isIsNoticeRow(notification)) {
    return <IsNoticeItem notification={notification} onOpen={onOpen} onVisible={onVisible} />;
  }
  return (
    <NotificationItem
      notification={notification}
      onClick={onOpen}
      onVisible={onVisible}
      clickable={clickable}
    />
  );
}
