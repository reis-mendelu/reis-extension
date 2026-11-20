import { baseProgramme } from './partnerAudience';

/** The guide on reisapp.cz that the Novinky row opens. */
export const REIS_FOR_CLAUDE_GUIDE_URL = 'https://reisapp.cz/navody/reis-v-claude';

/**
 * reIS for Claude launches to IT students only (Dominik, 2026-11-20): the base
 * programmes of Otevřená informatika and Aplikovaná informatika.
 */
export const REIS_FOR_CLAUDE_PROGRAMMES: readonly string[] = ['B-OI', 'B-AII', 'N-OI'];

/** Whether the student's programme ('B-OI-ZBOI' counts as 'B-OI') is in the launch. */
export function isReisForClaudeAudience(programme: string | null | undefined): boolean {
  const base = baseProgramme(programme);
  return base !== null && REIS_FOR_CLAUDE_PROGRAMMES.includes(base);
}
