import type { FeatureSignal } from '../api/featureUsage';

/**
 * Partners' study-aids links, shown under Předměty, keyed by partner id.
 *
 * Who sees one is the partner's own audience (`societies.audience`, matched on
 * the device by `matchingPartners`), set in the admin console by faculty and
 * programme (`af:B-ATE`), so no subject list is kept here. Bundled rather than
 * in the database, like `PARTNER_INTERNSHIPS`: one link does not need a console
 * form yet.
 *
 * The partner is a society row of kind `partner` named by `partnerId`. Without
 * that row, or while it is switched off, nobody is shown the link.
 */
export interface PartnerStudyAids {
  /** `Society.id` of the partner offering it. */
  partnerId: string;
  url: string;
  /**
   * What counts a tap on the row: the installs that tapped, handed to the
   * partner. One label per partner, so adding one means adding its label to
   * `FEATURE_SIGNALS` and the database whitelist first.
   */
  clickSignal: FeatureSignal;
}

export const PARTNER_STUDY_AIDS: readonly PartnerStudyAids[] = [
  {
    partnerId: 'mendelu-app',
    url: 'https://mendelu.app/',
    clickSignal: 'study_aids_click_mendelu_app',
  },
];
