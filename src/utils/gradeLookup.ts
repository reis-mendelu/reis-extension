import type { CourseGrade } from '../types/documents';

/**
 * Picks the grade to show for a subject from the E-index grade history,
 * matched by predmet id (the live "vsechna_obdobi" page shifts columns, so the
 * text courseCode is unreliable — the syllabus-link predmetId is not).
 * Prefers a passing grade (letter A–E); otherwise the latest attempt.
 * Returns null when the subject has no grade entry.
 */
export function gradeForCourse(grades: CourseGrade[], predmetId: string, courseCode?: string): CourseGrade | null {
  if (!predmetId && !courseCode) return null;
  const matches = grades.filter(g =>
    (!!predmetId && g.predmetId === predmetId) ||
    (!!courseCode && g.courseCode === courseCode)
  );
  if (matches.length === 0) return null;
  const passing = matches.filter(g => /^[A-E]$/.test(g.gradeLetter));
  const pool = passing.length ? passing : matches;
  return pool.reduce((best, g) => ((g.attempt ?? 0) >= (best.attempt ?? 0) ? g : best));
}


export type GradeBadge =
  | { kind: 'letter'; text: string; passed: boolean }
  | { kind: 'credited' }
  | { kind: 'completed' };

/**
 * Maps a grade to a small badge. Graded exams show the A–F letter; no-letter
 * completions map to a word: zápočet -> credited, zakončení -> completed.
 * (The live grade page has no reliable examType column, so we read the
 * completion kind from the parenthesised suffix of gradeText, e.g. "(zap)".)
 */
export function gradeBadge(grade: CourseGrade | null): GradeBadge | null {
  if (!grade) return null;
  if (/^[A-F]$/.test(grade.gradeLetter)) {
    return { kind: 'letter', text: grade.gradeLetter, passed: grade.gradeLetter !== 'F' };
  }
  const t = grade.gradeText.toLowerCase();
  if (t.includes('(zap)')) return { kind: 'credited' };
  if (t.includes('(zak)')) return { kind: 'completed' };
  return null;
}
