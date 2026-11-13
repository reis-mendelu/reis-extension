import type { PageCategory, PageItem } from './types';

/**
 * The Starý IS directory for another UIS school (prototype builds only, see
 * `utils/otherSchool.ts`). The list is MENDELU's; most of it is plain UIS and
 * works anywhere, so it is trimmed rather than replaced:
 *
 * - pages only MENDELU has go: its dorms (SKM), Microsoft Imagine, its network
 *   pages, the election portal (absent from both the ČZU and VŠE menus);
 * - `_m=` goes from every link: it is MENDELU's menu numbering, and a UIS page
 *   opens without it (the ČZU and VŠE dumps were all fetched with none);
 * - "na/o MENDELU" leaves the labels.
 */
const MENDELU_ONLY_PATHS = [
  '/auth/uskm/',
  '/auth/student/nastaveni_dreamspark.pl',
  '/auth/wifi/heslo_vpn_sit.pl',
  '/auth/wifi/statistika.pl',
  '/auth/sit/technika_moje.pl',
  '/auth/evolby/',
];

const isMendeluOnly = (page: PageItem) => MENDELU_ONLY_PATHS.some((p) => page.href.includes(p));

const withoutMenuId = (href: string) =>
  href
    .replace(/([?;])_m=\d+;?/, '$1')
    .replace(/[?;]$/, '')
    .replace(/;$/, '');

const withoutMendelu = (label: string) =>
  label.replace(/\s+(?:na|o|at|about)\s+MENDELU\b/g, '').trim();

export function pagesForOtherSchool(categories: PageCategory[]): PageCategory[] {
  return categories
    .map((c) => ({
      ...c,
      children: c.children
        .filter((p) => !isMendeluOnly(p))
        .map((p) => ({
          ...p,
          href: withoutMenuId(p.href),
          label: withoutMendelu(p.label),
          ...(p.labelEn && { labelEn: withoutMendelu(p.labelEn) }),
        })),
    }))
    .filter((c) => c.children.length > 0);
}
