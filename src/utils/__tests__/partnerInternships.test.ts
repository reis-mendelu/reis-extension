import { describe, it, expect } from 'vitest';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { internshipsFor } from '../partnerInternships';
import type { PartnerInternship } from '../../data/partnerInternships';

const ey = BUNDLED_SOCIETIES.ey!;
const kpmg = { ...ey, id: 'kpmg', name: 'KPMG', sortOrder: 80 };
const list: PartnerInternship[] = [
  {
    partnerId: 'kpmg',
    title: 'KPMG stáž',
    url: 'https://kpmg.example/',
    body: { cz: 'a', en: 'a' },
  },
  { partnerId: 'ey', title: 'EY program', url: 'https://ey.example/', body: { cz: 'b', en: 'b' } },
];

describe('internshipsFor', () => {
  it("gives a student only their own partners' programmes, in partner order", () => {
    expect(internshipsFor([ey, kpmg], list).map((i) => i.internship.title)).toEqual([
      'EY program',
      'KPMG stáž',
    ]);
    expect(internshipsFor([kpmg], list).map((i) => i.partner.id)).toEqual(['kpmg']);
  });

  it('is empty when no partner matches, so the button is not shown', () => {
    expect(internshipsFor([], list)).toEqual([]);
  });

  it('skips a matching partner that has no programme', () => {
    expect(internshipsFor([ey], [list[0]!])).toEqual([]);
  });
});
