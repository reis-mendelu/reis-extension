import { MapPin } from 'lucide-react';
import type { BlockLesson } from '../../../../types/calendarTypes';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAppStore } from '../../../../store/useAppStore';
import { localizedCourseName } from '../../../../utils/localizedLesson';
import { lessonDisplayName } from '../../../../utils/courseDisplayName';
import { lessonPlace } from '../../../../utils/lessonPlace';
import { eventStyles } from './eventStyles';
import { blockBox, nameLines, type PlacedBlock } from './weekLayout';

export interface WeekBlockProps {
  block: PlacedBlock;
  /** Phone columns cascade a clash; iPad columns split it (see `blockBox`). */
  cascade: boolean;
  /** The grid's height in px, for how many name lines fit. 0 before layout. */
  gridPx: number;
  onOpen: (lesson: BlockLesson) => void;
}

/** Fixed line height, so the clamp below and the CSS agree at every width. */
const NAME_LINE_PX = 12;
/**
 * The iPad block's three rows — two name lines, the room, the time — plus
 * padding. Shorter than this (a 50-minute lesson in a long day) and the time
 * row goes, so overflow never clips the room (release review).
 */
const IPAD_TIME_ROW_MIN_PX = 80;
/** Block padding (4px) plus the room line (12px) under the name. */
const RESERVED_PX = 16;

/**
 * One lesson in the week grid: the subject's NAME and its room, and on an iPad
 * the time too. The room is the CODE with a pin ("Q07", not "Q07 (Brno)"):
 * it is how a student in Týden sees where a lesson is without opening it, and
 * a ~45px block has no width for the campus (spec 2026-10-30, decision 5). Never the course code — the mockups showed it and Dominik's
 * answer was "nobody cares about the code of the subjects".
 *
 * Same colours as the agenda row (`eventStyles`): fixed light tints in both
 * themes, so the ink is the fixed content-* tokens, not base-content.
 */
export function WeekBlock({ block, cascade, gridPx, onOpen }: WeekBlockProps) {
  const { language } = useTranslation();
  const { lesson } = block;
  const nicknames = useAppStore((s) => s.courseNicknames);
  const name = lessonDisplayName(nicknames, lesson, localizedCourseName(lesson, language));
  // The campus in brackets dropped, the trim routeSuggestionFor makes too.
  const room = lessonPlace(lesson, language)
    .label.replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  const styles = eventStyles(lesson);
  const box = blockBox(block.lane, block.lanes, cascade);
  // Clamped to the part a later clash leaves uncovered — there the room line is
  // under the block on top, so only the padding is reserved.
  const covered = block.visible < block.height;
  // On an iPad clashes sit side by side, so nothing covers a block: its full
  // height decides whether the time row fits (#622 review).
  const blockPx = ((cascade ? block.visible : block.height) / 100) * gridPx;
  const lines = cascade
    ? nameLines((block.visible / 100) * gridPx, NAME_LINE_PX, covered ? 4 : RESERVED_PX)
    : 2;
  const time = `${lesson.startTime} – ${lesson.endTime}`;
  // The day, so the same lesson on two days does not announce the same: the
  // column it sits in has no name of its own (PR #618 review). "St 7. 10."
  const date = new Date(
    Number(lesson.date.slice(0, 4)),
    Number(lesson.date.slice(4, 6)) - 1,
    Number(lesson.date.slice(6, 8))
  );
  const weekday = new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'cs-CZ', {
    weekday: 'short',
  }).format(date);
  const day = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${date.getDate()}. ${date.getMonth() + 1}.`;

  return (
    <button
      type="button"
      aria-label={[name, day, time, room].filter(Boolean).join(', ')}
      onClick={() => onOpen(lesson)}
      style={{
        top: `${block.top}%`,
        height: `${block.height}%`,
        left: box.left,
        width: box.width,
        // Paint order by start (placeDay), not lane: a later block is on top.
        zIndex: block.order + 1,
      }}
      // A cascaded block is drawn over the one it clashes with; the ring in the
      // screen's colour is what keeps the two edges apart.
      className={`absolute flex flex-col overflow-hidden rounded-md border border-l-[3px] py-0.5 pl-[3px] pr-0.5 text-left ${styles.solid} ${styles.border} ${styles.rail} ${
        block.onTop && cascade ? 'ring-2 ring-base-200' : ''
      }`}
    >
      <span
        lang={language === 'en' ? 'en' : 'cs'}
        style={{ WebkitLineClamp: lines }}
        className="line-clamp-2 hyphens-auto break-words text-[11px] font-bold leading-3 text-content-primary max-[359px]:text-[10px] md:text-[13px] md:leading-4"
      >
        {name}
      </span>
      {/* Under a cascaded clash the room line would show only as one letter in
          the uncovered strip; the room is in the block on top's tap-through. */}
      {room && !(cascade && covered) && (
        // The code wins the width. In a ~45px phone column "Q01.48" did not fit
        // beside the pin and read "Q01…", so a phone drops the pin for a code
        // longer than four characters, and below 360px the code is a point
        // smaller. Measured at 320/390/430 with verify:ui.
        <span className="mt-auto flex min-w-0 items-center gap-0.5 text-[11px] font-extrabold leading-3 text-content-primary/80 max-[359px]:text-[10px] md:mt-0 md:text-[12px] md:leading-[15px]">
          <MapPin
            aria-hidden
            className={`h-2.5 w-2.5 flex-shrink-0 md:h-3 md:w-3 ${room.length > 4 ? 'max-md:hidden' : ''}`}
            strokeWidth={2.5}
          />
          <span className="whitespace-nowrap">{room}</span>
        </span>
      )}
      {!cascade && (gridPx === 0 || blockPx >= IPAD_TIME_ROW_MIN_PX) && (
        <span className="truncate text-[11px] leading-[14px] tabular-nums text-content-secondary">
          {time}
        </span>
      )}
    </button>
  );
}
