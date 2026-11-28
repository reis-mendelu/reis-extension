import type { AudienceViewer } from './partnerAudience';
import { isReisForClaudeAudience } from './reisForClaude';

/**
 * The page on reisapp.cz with the datasets. The same page for every subject (Dominik,
 * 2026-11-28: it does not matter which subject the box belongs to); the page itself
 * splits web from Java. `language` takes the app's own codes; anything that is not
 * Czech gets the English page, as in guidesIndexUrl.
 */
export function projectDataUrl(language: string): string {
  return language === 'cz'
    ? 'https://reisapp.cz/navody/data-pro-projekty'
    : 'https://reisapp.cz/en/guides/project-data';
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
