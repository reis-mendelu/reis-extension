import type { FeatureSignal } from '../api/featureUsage';

/**
 * The study-aids links shown under Předměty, keyed by `study_aids.id`.
 *
 * Only what is fixed per link lives here: where it goes and what counts its
 * tap. WHO sees it is a row of the `study_aids` table with the same id (an
 * audience of faculty and programme tokens, and an on/off switch), edited in
 * the admin console and matched on the device. A link with no active row is
 * shown to nobody.
 *
 * The address is in code, not in the table, on purpose: the privacy guard
 * (`noStudentDataLeaves`) lists every host reIS can link to, which a
 * database-held address would escape.
 *
 * Not a society and not a company: no logo, no partner row.
 */
export interface StudyAidsEntry {
  /** `study_aids.id` of the row that holds this link's audience. */
  id: string;
  url: string;
  /**
   * What counts a tap: the installs that tapped, handed to whoever runs the
   * site. One label per link, so adding a link means adding its label to
   * `FEATURE_SIGNALS` and the database whitelist first.
   */
  clickSignal: FeatureSignal;
}

export const STUDY_AIDS: readonly StudyAidsEntry[] = [
  {
    id: 'mendelu-app',
    url: 'https://mendelu.app/',
    clickSignal: 'study_aids_click_mendelu_app',
  },
];
