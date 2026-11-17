import type { PageCategory } from './types';
import { portalInfo } from './portal-info';
import { mojeStudium } from './moje-studium';
import { vedaVyzkum, elearning } from './academic';
import { osobniManagement, eAgenda } from './management';
import { technologie, spravaIS, dokumentace } from './technical';
import { herna, personalizace, nastaveniIS, ochranaUdaju } from './personal';
import { pagesForOtherSchool } from './otherSchoolPages';
import { currentSchool } from '../../utils/school';

export * from './types';

const allPages: PageCategory[] = [
  mojeStudium,
  portalInfo,
  vedaVyzkum,
  elearning,
  osobniManagement,
  eAgenda,
  technologie,
  spravaIS,
  dokumentace,
  herna,
  personalizace,
  nastaveniIS,
  ochranaUdaju,
];

/**
 * The list above is MENDELU's own Starý IS menu. Every other school gets it
 * trimmed to general UIS. Keyed on the school, not a feature: the list itself is
 * MENDELU's, and this is the one place that says so.
 */
export const pagesData: PageCategory[] =
  currentSchool.id === 'mendelu' ? allPages : pagesForOtherSchool(allPages);

export const BASE_URL = 'https://is.mendelu.cz';
