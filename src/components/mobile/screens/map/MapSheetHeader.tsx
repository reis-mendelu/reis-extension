import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * The open sheet's top row: either the panel's own heading, or Back out of a
 * tapped pin's card.
 *
 * It is a button in both shapes because it is also the sheet's main grab
 * surface — the drag handle is a 4px pill at the top of a 70vh sheet, so
 * collapsing by the handle alone meant reaching to the top of the screen. This
 * row is the nearest grab surface to the content the student is reading, which
 * is why `touch-none` is on it too and not only on the pill.
 *
 * It replaced a segmented control. Library study-room reservation is hidden on
 * mobile, so unless a building is selected there is exactly one tab, and a
 * track with a selected pill framing the only thing you could pick is all
 * chrome. The row still had to exist for the grab, so it became a heading whose
 * tap collapses.
 */
export function MapSheetHeader({
  showingCard,
  onCollapse,
  onBack,
}: {
  /** A tapped pin's card is showing, so the row is Back rather than a heading. */
  showingCard: boolean;
  onCollapse: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const title = (
    <span className="font-display text-lg font-bold tracking-tight text-base-content">
      {t('mobile.map.tabEvents')}
    </span>
  );

  // A tapped pin replaces the heading outright: the card IS the answer to the
  // tap, and leaving the panel's own title above it invites switching away from
  // the thing just asked for. Back returns to the list.
  if (showingCard) {
    return (
      <button
        type="button"
        onClick={onBack}
        className="flex flex-shrink-0 touch-none items-center gap-1.5 px-5 pb-2 text-left"
      >
        <ChevronLeft size={18} className="flex-shrink-0 text-base-content/40" />
        {title}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onCollapse}
      aria-expanded
      className="flex flex-shrink-0 touch-none items-center justify-between px-5 pb-2 text-left"
    >
      {/* Sized as the sheet's title, not as the tab it replaced: at 13.5px it
          read as a label floating above the content rather than as the heading
          for everything below it. Matches the other full sheets' headers. */}
      {title}
      <ChevronDown size={20} className="flex-shrink-0 text-base-content/40" aria-hidden="true" />
    </button>
  );
}
