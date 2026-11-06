import { MapPin } from 'lucide-react';
import type { BlockLesson } from '../../../../types/calendarTypes';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAppStore } from '../../../../store/useAppStore';
import { localizedCourseName } from '../../../../utils/localizedLesson';
import { lessonDisplayName } from '../../../../utils/courseDisplayName';
import { lessonPlace } from '../../../../utils/lessonPlace';
import { eventStyles } from './eventStyles';
import { blockBox, nameLines, type PlacedBlock } from './weekLayout';
import { useHoldToHide } from './useHoldToHide';

export interface WeekBlockProps {
  block: PlacedBlock;
  /** An iPad: its ~150px columns have room for the time row too. */
  wide: boolean;
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
export function WeekBlock({ block, wide, gridPx, onOpen }: WeekBlockProps) {
  const { language } = useTranslation();
  const { lesson } = block;
  const nicknames = useAppStore((s) => s.courseNicknames);
  const name = lessonDisplayName(nicknames, lesson, localizedCourseName(lesson, language));
  // The campus in brackets dropped, the trim routeSuggestionFor makes too.
  const room = lessonPlace(lesson, language)
    .label.replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  const styles = eventStyles(lesson);
  const box = blockBox(block.lane, block.lanes);
  const hold = useHoldToHide(lesson);
  const blockPx = (block.height / 100) * gridPx;
  // A phone block shows as many whole lines of the name as fit above the room;
  // the iPad's wider block wraps less and keeps two.
  const lines = wide ? 2 : nameLines(blockPx, NAME_LINE_PX, RESERVED_PX);
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
      // A hold opens the hide menu (#43); see useHoldToHide.
      {...hold}
      style={{
        top: `${block.top}%`,
        height: `${block.height}%`,
        left: box.left,
        width: box.width,
      }}
      className={`absolute z-[1] flex flex-col overflow-hidden rounded-md border border-l-[3px] py-0.5 pl-[3px] pr-0.5 text-left ${styles.solid} ${styles.border} ${styles.rail}`}
    >
      <span
        lang={language === 'en' ? 'en' : 'cs'}
        style={{ WebkitLineClamp: lines }}
        className="line-clamp-2 hyphens-auto break-words text-[11px] font-bold leading-3 text-content-primary max-[359px]:text-[10px] md:text-[13px] md:leading-4"
      >
        {name}
      </span>
      {room && (
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
      {wide && (gridPx === 0 || blockPx >= IPAD_TIME_ROW_MIN_PX) && (
        <span className="truncate text-[11px] leading-[14px] tabular-nums text-content-secondary">
          {time}
        </span>
      )}
    </button>
  );
}
