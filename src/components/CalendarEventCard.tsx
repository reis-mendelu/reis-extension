/**
 * CalendarEventCard - Event card component matching Figma design.
 *
 * Uses workspace semantic colors (exam-*, lecture-*, seminar-*).
 * Renders with adaptive content based on event duration.
 *
 * NOTE: This component fills its parent container. Positioning is handled by the parent.
 */

import { MapPin, Timer } from 'lucide-react';
import type { CardLesson } from '../types/calendarTypes';
import { useCourseName } from '../hooks/ui/useCourseName';
import { useAppStore } from '../store/useAppStore';
import { useTimeline } from '../hooks/useTimeline';
import { renderedBlockMinutes, MIN_VISUAL_BLOCK_MINUTES } from './WeeklyCalendar/utils';
import { CalendarEventCardHideMenu } from './CalendarEventCardHideMenu';
import { useTranslation } from '../hooks/useTranslation';
import { lessonPlace } from '../utils/lessonPlace';

interface CalendarEventCardProps {
  lesson: CardLesson;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  language?: string; // Language for localization
}

// Helper function to get localized course name
function getLocalizedCourseName(lesson: CardLesson, language?: string): string {
  if (language === 'en' && lesson.courseNameEn) {
    return lesson.courseNameEn;
  }
  return lesson.courseNameCs || lesson.courseName;
}

// Extract exam section name from the composite title
function getExamSectionName(courseName: string): string {
  // The format from WeeklyCalendar is `${subject.name} - ${section.name}`
  // We want to extract the full section name (everything after the first dash)
  const parts = courseName.split(' - ');
  const sectionName = parts.length > 1 ? parts.slice(1).join(' - ') : courseName;

  // Normalize "prubezny" to "průběžný"
  return sectionName.replace(/prubezny/gi, 'průběžný');
}

export function CalendarEventCard({ lesson, onClick, language }: CalendarEventCardProps) {
  const timeline = useTimeline(lesson.courseCode || '');

  // How much room the grid actually gave this block. `renderedMinutes` is the
  // number it laid the block out with — legibility floor and next-block cap
  // included — so recomputing it here without the cap would promise the card
  // space the column has not given it.
  const occupies = lesson.renderedMinutes ?? renderedBlockMinutes(lesson.startTime, lesson.endTime);

  // Two stacked lines need about 56px: 20 for the title, 20 for the room-and-time
  // row, 16 of padding. The grid is fourteen hours tall, so on a normal desktop
  // window 60 minutes is about 41px — and the old gate at `>= 60` drew the second
  // line anyway and let `overflow-hidden` cut it in half. That was visible on any
  // 60-to-89-minute lesson before this, and became the common case once short
  // blocks started being capped at the next one.
  //
  // MIN_VISUAL_BLOCK_MINUTES is the right line because it IS the floor: anything
  // the grid floored is at least this tall, and anything shorter got there by
  // being capped, which means something starts right underneath it.
  const fitsTwoLines = occupies >= MIN_VISUAL_BLOCK_MINUTES;

  // Get localized names and apply nickname
  const fullName = getLocalizedCourseName(lesson, language);
  const baseOnly = fullName.split(' - ')[0];
  const nickname = useAppStore((state) => state.courseNicknames?.[lesson.courseCode || '']);
  const baseName = useCourseName(lesson.courseCode, baseOnly);
  const courseName = lesson.isExam
    ? `${baseName} - ${getExamSectionName(fullName)}`
    : nickname
      ? baseName
      : fullName;
  const { t } = useTranslation();
  const mapEvents = useAppStore((state) => state.mapEvents);
  const societies = useAppStore((state) => state.societies);
  // The room, or where an answered society event is — which may be only a pin.
  const room = lessonPlace(
    lesson,
    language ?? 'cz',
    mapEvents,
    t('map.venueOnMap'),
    societies
  ).label;

  // Determine event type and colors using workspace tokens
  const getEventStyles = () => {
    // Card backgrounds are fixed light tints (exam/lecture/seminar-bg) that do
    // NOT follow the active DaisyUI theme, so the foreground must be a fixed dark
    // color too — using text-base-content turns the text near-white on the
    // default dark theme, making cards render blank/white.
    if (lesson.isExam) {
      return {
        bg: 'bg-exam-bg/85',
        border: 'border-l-exam-border',
        outerBorder: 'border-exam-border/30',
        text: 'text-exam-text',
      };
    } else if (lesson.isSeminar === 'true') {
      return {
        bg: 'bg-seminar-bg/85',
        border: 'border-l-seminar-border',
        outerBorder: 'border-seminar-border/30',
        text: 'text-seminar-text',
      };
    } else {
      return {
        bg: 'bg-lecture-bg/85',
        border: 'border-l-lecture-border',
        outerBorder: 'border-lecture-border/30',
        text: 'text-lecture-text',
      };
    }
  };

  const styles = getEventStyles();

  // For exams: show the section name (e.g. "Průběžný test 2")
  // For others: show the full course name
  const isCompact = (lesson.maxColumns ?? 1) > 1;
  const compactCode = lesson.courseCode
    ? lesson.courseCode.includes('-')
      ? lesson.courseCode.split('-').slice(1).join('-')
      : lesson.courseCode
    : courseName;
  const courseTitle =
    isCompact && !lesson.isExam
      ? compactCode
      : lesson.isExam
        ? getExamSectionName(courseName)
        : courseName;

  return (
    <div
      className={`h-full mx-1 rounded cursor-pointer group
                        ${styles.bg} border ${styles.outerBorder} border-l-4 ${styles.border} relative`}
      onClick={onClick}
      title={`${courseTitle}\n${lesson.startTime} - ${lesson.endTime}\n${room}\n${lesson.teachers[0]?.shortName || ''}`}
    >
      {/* Deadline countdown badge */}
      {timeline && timeline.weeksLeft <= 4 && !lesson.isExam && (
        <div
          className={`absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold z-10 group-hover:opacity-0 transition-opacity ${
            timeline.weeksLeft === 0
              ? 'bg-error/15 text-error'
              : timeline.weeksLeft <= 2
                ? 'bg-warning/15 text-warning'
                : 'bg-info/15 text-info'
          }`}
        >
          <Timer size={10} />
          <span>{timeline.short}</span>
        </div>
      )}
      {/* The only route to hideEvent/hideCourse, so it renders however little
          room the block has — see CalendarEventCardHideMenu. */}
      {!lesson.isCustom && !lesson.isExam && !isCompact && (
        <CalendarEventCardHideMenu lesson={lesson} fullName={fullName} baseName={baseName} />
      )}
      <div className="p-2 h-full flex flex-col text-sm overflow-hidden font-inter">
        {/* One line, for a block with room for one. The time joins the title
            rather than being dropped: "Cvičení" alone on a row between two other
            blocks says less than the thing it is sitting next to. The room goes,
            because something has to, and it is the part the tooltip and the
            subject drawer both still carry. */}
        {!fitsTwoLines ? (
          <div
            className={`flex min-w-0 items-baseline justify-between gap-2 ${
              // Same inset the two-line title takes, and for the same reason:
              // the quick-hide button sits at top-right and would otherwise
              // land on the time. It appears on hover, so without this the
              // time would vanish under a thumb at the moment it is read.
              !lesson.isCustom && !lesson.isExam && !isCompact ? 'pr-8' : ''
            }`}
          >
            <span className="truncate font-semibold text-content-primary">{courseTitle}</span>
            <span className="flex-shrink-0 whitespace-nowrap text-xs text-content-secondary">
              {isCompact ? lesson.startTime : `${lesson.startTime} - ${lesson.endTime}`}
            </span>
          </div>
        ) : (
          /* Course title - always visible. Fixed near-black (content-primary)
                    rather than the colored type token, so the title reads black on the
                    light green/blue/red card tints regardless of theme. */
          <div
            className={`font-semibold text-content-primary flex-shrink-0 truncate ${!lesson.isExam && !isCompact ? 'pr-8' : ''}`}
          >
            {courseTitle}
          </div>
        )}
        {/* Additional course info - only for longer events */}
        {fitsTwoLines && lesson.isExam && !isCompact && (
          <div className="text-exam-text font-medium text-xs flex-shrink-0 truncate">
            {courseName.split(' - ')[0]}
          </div>
        )}

        {/* Bottom row - Location and Time, pushed to bottom */}
        {fitsTwoLines && (
          <div className="text-content-secondary text-sm mt-auto flex-shrink-0 flex items-center justify-between gap-2">
            {room && !isCompact && (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <MapPin size={12} className="flex-shrink-0" />
                {/* No "show on map" button here. A calendar block is minutes
                    tall and already carries the course, the room and the time;
                    a third control spelled out as a sentence pushed the row
                    past the block at every width. The room is still reachable
                    on the map from the subject drawer. */}
                <span className="truncate">{room}</span>
              </div>
            )}
            <div className="text-content-secondary whitespace-nowrap flex-shrink-0">
              {isCompact ? lesson.startTime : `${lesson.startTime} - ${lesson.endTime}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
