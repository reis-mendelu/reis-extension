import type { AudienceViewer } from './partnerAudience';
import { isReisForClaudeAudience } from './reisForClaude';

/** The subjects whose boxes get the line, and the section of the page that fits their project. */
const SECTION_BY_COURSE: Readonly<Record<string, 'web' | 'java'>> = {
  'EBC-VWA': 'web',
  'EBC-PJ': 'java',
};

/**
 * The page on reisapp.cz with the datasets, at the section for this subject, or
 * null when the subject is not listed (or the box has no course code: boxes
 * cached by an older build have none). `language` takes the app's own codes;
 * anything that is not Czech gets the English page, as in guidesIndexUrl.
 */
export function projectDataUrl(courseCode: string | undefined, language: string): string | null {
  const section = courseCode ? SECTION_BY_COURSE[courseCode] : undefined;
  if (!section) return null;
  return language === 'cz'
    ? `https://reisapp.cz/navody/data-pro-projekty#${section}`
    : `https://reisapp.cz/en/guides/project-data#${section}`;
}

/**
 * Who sees the "Data pro projekt" line: the informatics students reIS for Claude
 * launched to (Dominik, 2026-11-28), by the same rule. No programme list of its
 * own in code (guard noProgrammeListsInCode): if that audience moves to data, or
 * the two should differ, this is the one place to split them.
 */
export function isProjectDataAudience(viewer: AudienceViewer): boolean {
  return isReisForClaudeAudience(viewer);
}
