import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// A follow toggle reached one tap earlier from the event that made the
// student want it, rather than only from Profile's follow list. Shared code:
// both DetailPanel (desktop) and MapPanelBody (phone/iPad) render
// EventDetailCard, so this chip ships on both trees automatically.
export function FollowChip({ societyId }: { societyId: string }) {
  const { t } = useTranslation();
  const followed = useAppStore((s) => s.followed.includes(societyId));
  const toggleFollow = useAppStore((s) => s.toggleFollow);

  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs shrink-0"
      aria-pressed={followed}
      onClick={() => void toggleFollow(societyId)}
    >
      {followed ? t('notify.following') : t('notify.follow')}
    </button>
  );
}
