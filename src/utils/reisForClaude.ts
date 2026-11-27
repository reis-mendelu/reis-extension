import { matchesAudience, type AudienceViewer } from './partnerAudience';

/** The guide on reisapp.cz that the Novinky row opens. */
export const REIS_FOR_CLAUDE_GUIDE_URL = 'https://reisapp.cz/navody/reis-v-claude';

/**
 * reIS for Claude launches to IT students only (Dominik, 2026-11-20): the base
 * programmes of Otevřená informatika and Aplikovaná informatika, as audience
 * tokens (utils/partnerAudience).
 */
export const REIS_FOR_CLAUDE_AUDIENCE: readonly string[] = ['pef:B-OI', 'pef:B-AII', 'pef:N-OI'];

/** Whether the viewer (useViewer: the impersonated student while impersonating) is in the launch. */
export function isReisForClaudeAudience(viewer: AudienceViewer): boolean {
  return matchesAudience(REIS_FOR_CLAUDE_AUDIENCE, viewer);
}
