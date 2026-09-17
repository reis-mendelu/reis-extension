/**
 * Student Association (Spolek) integration types
 */

export interface SpolekNotification {
  id: string;
  associationId?: string; // 'supef' | 'au_frrms' | 'agro' | ...
  title: string;
  body: string;
  link?: string;
  createdAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  priority: 'normal' | 'high';
  viewCount?: number;
  clickCount?: number;
}

export interface AssociationProfile {
  id: string; // 'supef'
  name: string; // 'SUPEF'
  websiteUrl: string; // 'https://supef.cz'
  facultyIds: string[]; // ['PEF']
  /**
   * Who this society's audience is, when it cannot be read off `facultyIds`.
   *
   * ESN is cross-faculty and its people are the Erasmus students, which no
   * faculty code expresses. Data rather than an `if (id === 'esn')` in the
   * label helper.
   */
  audienceLabelKey?: 'erasmus';
}

export type FacultyId = 'PEF' | 'FRRMS' | 'AGRO' | 'LDF' | 'AF' | 'ZF';
