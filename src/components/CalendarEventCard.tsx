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
import { CalendarEventCardHideMenu } from './CalendarEventCardHideMenu';
import { CalendarEventCardOneLine } from './CalendarEventCardOneLine';
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

/** The shortest block, in grid minutes, that holds the title and the room-and-time row. */
const TWO_LINE_BLOCK_MINUTES = 90;

export function CalendarEventCard({ lesson, onClick, language }: CalendarEventCardProps) {
  const timeline = useTimeline(lesson.courseCode || '');

  // Two stacked lines need about 56px: 20 for the title, 20 for the room-and-time
  // row, 16 of padding. The grid is fourteen hours tall, so on a 700px-tall
  // window an hour is about 41px (50px at 844) and 90 minutes the first length
  // that holds both. Below it the card is one line, which a 50-minute lesson
  // (~34px at 700) still fits with the tighter padding that layout takes.
  //
  // `renderedMinutes` is what the week grid laid the block out with. The day
  // list gives every card the same 80px and passes none, so there the height
  // says nothing about the lesson and the card always has room for both lines.
  const fitsTwoLines =
    lesson.renderedMinutes === undefined || lesson.renderedMinutes >= TWO_LINE_BLOCK_MINUTES;

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
  const room = lessonPlace(lesson, language ?? 'cz').label;

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
  const hasDeadlineBadge = !!timeline && timeline.weeksLeft <= 4 && !lesson.isExam;
  const hasHideMenu = !lesson.isCustom && !lesson.isExam && !isCompact;

  return (
    <div
      className={`h-full mx-1 rounded cursor-pointer group
                        ${styles.bg} border ${styles.outerBorder} border-l-4 ${styles.border} relative`}
      onClick={onClick}
      title={`${lesson.isExam ? courseName : courseTitle}\n${lesson.startTime} - ${lesson.endTime}\n${room}\n${lesson.teachers[0]?.shortName || ''}`}
    >
      {/* Deadline countdown badge */}
      {hasDeadlineBadge && timeline && (
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
      {hasHideMenu && (
        <CalendarEventCardHideMenu lesson={lesson} fullName={fullName} baseName={baseName} />
      )}
      <div
        className={`px-2 ${fitsTwoLines ? 'py-2' : 'py-1'} h-full flex flex-col text-sm overflow-hidden font-inter`}
      >
        {!fitsTwoLines ? (
          <CalendarEventCardOneLine
            title={courseTitle}
            time={isCompact ? lesson.startTime : `${lesson.startTime} - ${lesson.endTime}`}
            overlay={hasDeadlineBadge ? 'deadlineBadge' : hasHideMenu ? 'hideMenu' : 'none'}
          />
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
