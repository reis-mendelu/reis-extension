import type { PageCategory } from './types';
import { portalInfo } from './portal-info';
import { mojeStudium } from './moje-studium';
import { vedaVyzkum, elearning } from './academic';
import { osobniManagement, eAgenda } from './management';
import { technologie, spravaIS, dokumentace } from './technical';
import { herna, personalizace, nastaveniIS, ochranaUdaju } from './personal';
import { pagesForOtherSchool } from './otherSchoolPages';
import { IS_OTHER_SCHOOL } from '../../utils/otherSchool';

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

/** Another school's prototype gets the list without MENDELU's own pages. */
export const pagesData: PageCategory[] = IS_OTHER_SCHOOL ? pagesForOtherSchool(allPages) : allPages;

export const BASE_URL = 'https://is.mendelu.cz';
