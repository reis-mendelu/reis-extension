import type { FeatureSignal } from '../api/featureUsage';

/**
 * The links shown under Předměty to some students only, keyed by `study_aids.id`:
 * mendelu.app's study aids, and each programme's Discord server.
 *
 * Only what is fixed per link lives here: where it goes, what it says and what
 * counts its tap. WHO sees it is a row of the `study_aids` table with the same
 * id (an audience of faculty and programme tokens, and an on/off switch),
 * edited in the admin console and matched on the device. A link with no active
 * row is shown to nobody, so retargeting or removing one is the console, not a
 * release. Every link whose audience matches is shown, in this order.
 *
 * The address is in code, not in the table, on purpose: the privacy guard
 * (`noStudentDataLeaves`) lists every host reIS can link to, which a
 * database-held address would escape. Adding a link therefore means code plus a
 * release; `src/test/guards/studyAidsRegistry.test.ts` names every other place
 * a new entry needs (seed row, counter whitelist, admin label, host, disclosure).
 *
 * Not a society and not a company: no logo, no partner row.
 */
export interface StudyAidsEntry {
  /** `study_aids.id` of the row that holds this link's audience. */
  id: string;
  url: string;
  /**
   * What counts a tap: the installs that tapped, which can be handed to whoever
   * runs the site. One label per link, so adding a link means adding its label
   * to `FEATURE_SIGNALS` and the database whitelist first.
   */
  clickSignal: FeatureSignal;
  /** i18n keys for the row's title and second line. */
  labelKey: string;
  hintKey: string;
  /** The row's mark: a plain book, or the service's own logo (`StudyAidsIcon`). */
  icon: 'book' | 'discord';
}

export const STUDY_AIDS: readonly StudyAidsEntry[] = [
  {
    id: 'mendelu-app',
    url: 'https://mendelu.app/',
    clickSignal: 'study_aids_click_mendelu_app',
    labelKey: 'subjects.studyAids',
    hintKey: 'subjects.studyAidsHint',
    icon: 'book',
  },
  {
    // Otevřená informatika, the B-OI students' server (2026-11-27).
    id: 'discord-b-oi',
    url: 'https://discord.gg/fN9XrTqmVf',
    clickSignal: 'study_aids_click_discord_b_oi',
    labelKey: 'subjects.discordBOi',
    hintKey: 'subjects.programmeCommunityHint',
    icon: 'discord',
  },
  {
    // Administrace IS/ICT, the B-AII students' server (2026-11-27).
    id: 'discord-b-aii',
    url: 'https://discord.gg/THue2RgVr2',
    clickSignal: 'study_aids_click_discord_b_aii',
    labelKey: 'subjects.discordBAii',
    hintKey: 'subjects.programmeCommunityHint',
    icon: 'discord',
  },
];
