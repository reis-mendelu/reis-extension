import type { AssociationProfile } from './types';

/**
 * Mapping of faculty labels (found in study details) to their corresponding student associations
 */
export const FACULTY_TO_ASSOCIATION: Record<string, string> = {
  'PEF': 'supef',
  'FRRMS': 'au_frrms',
  'AF': 'af',
  'ZF': 'zf',
  'LDF': 'ldf',
  'ICV': 'icv',
};

/**
 * Association profiles (logos will be replaced when provided by user)
 */
export const ASSOCIATION_PROFILES: Record<string, AssociationProfile> = {
  supef: {
    id: 'supef',
    name: 'SUPEF',
    websiteUrl: 'https://supef.cz',
    facultyIds: ['PEF'],
  },
  esn: {
    id: 'esn',
    name: 'ESN Mendelu',
    websiteUrl: 'https://esn.mendelu.cz',
    facultyIds: [], // Cross-faculty - for Erasmus students
  },
  au_frrms: {
    id: 'au_frrms',
    name: 'AU FRRMS',
    websiteUrl: 'https://au.mendelu.cz',
    facultyIds: ['FRRMS'],
  },
  af: {
    id: 'af',
    name: 'AF Spolek',
    websiteUrl: 'https://af.mendelu.cz',
    facultyIds: ['AF'],
  },
  zf: {
    id: 'zf',
    name: 'ZF Spolek',
    websiteUrl: 'https://zf.mendelu.cz',
    facultyIds: ['ZF'],
  },
  ldf: {
    id: 'ldf',
    name: 'LDF Spolek',
    websiteUrl: 'https://ldf.mendelu.cz',
    facultyIds: ['LDF'],
  },
  icv: {
    id: 'icv',
    name: 'ICV',
    websiteUrl: 'https://icv.mendelu.cz',
    facultyIds: ['ICV'],
  },
};

/**
 * API endpoint for spolky notifications
 */
export const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwSgl46V4HnYiAnE7ZET2lPP5v0ekV9G_KZkdREkZ2GrIpOlUsaHGn_1JmIh1XCqcqD/exec';
