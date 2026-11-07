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
  body: { cz: string; en: string };
}

export const PARTNER_INTERNSHIPS: readonly PartnerInternship[] = [
  {
    partnerId: 'ey',
    title: 'Cesta s EY',
    url: 'https://cestasey.cz/',
    body: {
      cz: 'Program EY pro studenty. Podrobnosti najdeš na webu programu.',
      en: "EY's programme for students. The details are on the programme's website.",
    },
  },
];
