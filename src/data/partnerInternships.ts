import type { FeatureSignal } from '../api/featureUsage';

/**
 * Partner programmes shown under Stáže (internships), keyed by partner id.
 *
 * Who sees one is the partner's own audience (`societies.audience`, matched on
 * the device by `matchingPartners`), so a programme reaches exactly the
 * students its partner is shown to: EY's reaches PEF.
 *
 * Bundled rather than in the database: one programme does not need a console
 * form yet. When partners manage their own, this moves to a table.
 */
export interface PartnerInternship {
  /** `Society.id` of the partner offering it. */
  partnerId: string;
  /** The programme's own name; not translated. */
  title: string;
  url: string;
  /**
   * What counts a click on the card: the installs that clicked, handed to the
   * partner. One label per programme, so adding a programme means adding its
   * label to `FEATURE_SIGNALS` and the database whitelist first.
   */
  clickSignal: FeatureSignal;
  body: { cz: string; en: string };
}

export const PARTNER_INTERNSHIPS: readonly PartnerInternship[] = [
  {
    partnerId: 'ey',
    title: 'Cesta s EY',
    url: 'https://cestasey.cz/',
    clickSignal: 'internship_click_ey',
    body: {
      cz: 'Program EY pro studenty. Podrobnosti najdeš na webu programu.',
      en: "EY's programme for students. The details are on the programme's website.",
    },
  },
];
