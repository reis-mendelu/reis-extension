import { ExternalLink } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { BulletinList } from '../../Bulletin/BulletinList';

const VYVESKA_URL = 'https://is.mendelu.cz/auth/vyveska/nove_prispevky.pl?zalozka=2';

/**
 * The vývěska, as a sheet in the shared stack.
 *
 * It used to be a portal mounted inside `CalendarScreen`, while the pin that
 * opens it lives in `HeaderActions` — which `ScreenHeader` renders on every
 * screen. So four tabs set `bulletinExpanded` and nothing was listening:
 * "clicking the vyveska anywhere else than the calendar tab fails to open it".
 *
 * Mounting the overlay on all five screens would have fixed the symptom and
 * left the cause. `SheetHost` already renders the stack once for the whole app,
 * which is why no other sheet has ever had this bug — and going through it also
 * gives the vývěska the drag-to-dismiss the rest have, which is what was asked
 * for: "let's make vyveska also a slidedown so it's consistent".
 *
 * Being in the stack is what makes back work too. `handleBackPress` carried a
 * dedicated `bulletinOpen` branch purely because this surface sat outside the
 * stack; it does not any more.
 */
export function BulletinSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const posts = useAppStore((s) => s.bulletinPosts);
  const loading = useAppStore((s) => s.bulletinLoading);
  const error = useAppStore((s) => s.bulletinError);

  return (
    <Sheet size="full" onClose={onClose}>
      <SheetHeader title={t('bulletin.title')} onClose={onClose} />
      {/* Everything IS has, for the student who wants the real page. A plain
          target="_blank": installExternalLinkHandler intercepts it app-wide and
          opens IS in the in-app browser with the session attached. */}
      <div className="flex-shrink-0 px-4 pb-2">
        <a
          href={VYVESKA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          <ExternalLink className="h-4 w-4" />
          {t('bulletin.showAll')}
        </a>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        <BulletinList posts={posts} loading={loading} error={error} />
      </div>
    </Sheet>
  );
}
