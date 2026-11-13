import { describe, it, expect } from 'vitest';
import { pagesForOtherSchool } from '../otherSchoolPages';
import type { PageCategory } from '../types';

const category = (children: PageCategory['children']): PageCategory => ({
  id: 'c',
  label: 'Kategorie',
  children,
});

describe('pagesForOtherSchool', () => {
  it("drops MENDELU's own pages: dorms, Microsoft Imagine, its network", () => {
    const [c] = pagesForOtherSchool([
      category([
        {
          id: 'koleje',
          label: 'Kolejní administrativa',
          href: 'https://is.mendelu.cz/auth/uskm/koleje_index.pl?_m=308;lang={{lang}}',
        },
        {
          id: 'imagine',
          label: 'Přihláška do Microsoft Imagine',
          href: 'https://is.mendelu.cz/auth/student/nastaveni_dreamspark.pl?_m=4003;lang={{lang}}',
        },
        {
          id: 'vpn',
          label: 'Přístup do univerzitní sítě',
          href: 'https://is.mendelu.cz/auth/wifi/heslo_vpn_sit.pl?_m=3532;lang={{lang}}',
        },
        {
          id: 'studium',
          label: 'Informace o mém studiu',
          href: 'https://is.mendelu.cz/auth/student/studium.pl?studium={{studium}};lang={{lang}}',
        },
      ]),
    ]);
    expect(c!.children.map((p) => p.id)).toEqual(['studium']);
  });

  // `_m=` is MENDELU's menu numbering; UIS pages open without it (both the
  // ČZU and VŠE dumps were fetched with no `_m`).
  it('strips the menu id wherever it sits in the query', () => {
    const [c] = pagesForOtherSchool([
      category([
        { id: 'a', label: 'A', href: 'https://is.mendelu.cz/auth/katalog/?_m=111;lang={{lang}}' },
        { id: 'b', label: 'B', href: 'https://is.mendelu.cz/auth/zp/?lang={{lang}};_m=20841' },
        { id: 'c', label: 'C', href: 'https://is.mendelu.cz/auth/lide/?_m=104' },
      ]),
    ]);
    expect(c!.children.map((p) => p.href)).toEqual([
      'https://is.mendelu.cz/auth/katalog/?lang={{lang}}',
      'https://is.mendelu.cz/auth/zp/?lang={{lang}}',
      'https://is.mendelu.cz/auth/lide/',
    ]);
  });

  it('takes MENDELU out of the labels, in both languages', () => {
    const [c] = pagesForOtherSchool([
      category([
        { id: 'lide', label: 'Lidé na MENDELU', labelEn: 'Persons at MENDELU', href: 'x' },
        {
          id: 'info',
          label: 'Další informace o MENDELU',
          labelEn: 'Additional information about MENDELU',
          href: 'y',
        },
      ]),
    ]);
    expect(c!.children.map((p) => [p.label, p.labelEn])).toEqual([
      ['Lidé', 'Persons'],
      ['Další informace', 'Additional information'],
    ]);
  });

  it('drops a category left with no pages', () => {
    expect(
      pagesForOtherSchool([
        category([
          {
            id: 'koleje',
            label: 'Kolejní administrativa',
            href: 'https://is.mendelu.cz/auth/uskm/koleje_index.pl',
          },
        ]),
      ])
    ).toEqual([]);
  });
});
