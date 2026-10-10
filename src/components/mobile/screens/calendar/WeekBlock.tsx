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
/** Block padding (4px) plus the room line (12px) under the name. */
const RESERVED_PX = 16;

/**
 * One lesson in the week grid: the subject's NAME and its room, and on an iPad
 * the time too. Never the course code — the mockups showed it and Dominik's
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
  const room = lessonPlace(lesson, language).label;
  const styles = eventStyles(lesson);
  const box = blockBox(block.lane, block.lanes, cascade);
  // Clamped to the part a later clash leaves uncovered — there the room line is
  // under the block on top, so only the padding is reserved.
  const covered = block.visible < block.height;
  const lines = cascade
    ? nameLines((block.visible / 100) * gridPx, NAME_LINE_PX, covered ? 4 : RESERVED_PX)
    : 2;
  const time = `${lesson.startTime} – ${lesson.endTime}`;

  return (
    <button
      type="button"
      aria-label={[name, room, time].filter(Boolean).join(', ')}
      onClick={() => onOpen(lesson)}
      style={{ top: `${block.top}%`, height: `${block.height}%`, left: box.left, width: box.width }}
      // A cascaded block is drawn over the one it clashes with; the ring in the
      // screen's colour is what keeps the two edges apart.
      className={`absolute flex flex-col overflow-hidden rounded-md border border-l-[3px] py-0.5 pl-[3px] pr-0.5 text-left ${styles.solid} ${styles.border} ${styles.rail} ${
        block.lane > 0 && cascade ? 'z-10 ring-2 ring-base-200' : ''
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
        <span className="mt-auto truncate text-[10px] leading-3 text-content-secondary md:mt-0 md:text-[11px] md:leading-[14px]">
          {room}
        </span>
      )}
      {!cascade && (
        <span className="truncate text-[11px] leading-[14px] tabular-nums text-content-secondary">
          {time}
        </span>
      )}
    </button>
  );
}
