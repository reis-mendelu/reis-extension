import type { BlockLesson } from '../../../../types/calendarTypes';

/**
 * Colour tokens match `CalendarEventCard`'s desktop scheme exactly (same
 * `exam-*`/`lecture-*`/`seminar-*` design tokens) — these card backgrounds are
 * fixed light tints that do NOT follow the active theme, so the foreground
 * uses the fixed `content-primary`/`content-secondary` tokens too, not
 * theme-reactive `base-content`.
 *
 * `solid` is for the week grid, where a clash is drawn one block OVER another
 * and a translucent fill let the covered name show through.
 */
export function eventStyles(lesson: BlockLesson) {
  if (lesson.isExam) {
    return {
      bg: 'bg-exam-bg/85',
      solid: 'bg-exam-bg',
      border: 'border-exam-border/30',
      rail: 'border-l-exam-border',
      text: 'text-exam-text',
    };
  }
  if (lesson.isSeminar === 'true') {
    return {
      bg: 'bg-seminar-bg/85',
      solid: 'bg-seminar-bg',
      border: 'border-seminar-border/30',
      rail: 'border-l-seminar-border',
      text: 'text-seminar-text',
    };
  }
  return {
    bg: 'bg-lecture-bg/85',
    solid: 'bg-lecture-bg',
    border: 'border-lecture-border/30',
    rail: 'border-l-lecture-border',
    text: 'text-lecture-text',
  };
}
