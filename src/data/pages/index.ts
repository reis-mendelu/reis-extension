import type { PageCategory } from './types';
import { portalInfo } from './portal-info';
import { mojeStudium } from './moje-studium';
import { vedaVyzkum, elearning } from './academic';
import { osobniManagement, eAgenda } from './management';
import { technologie, spravaIS, dokumentace } from './technical';
import { herna, personalizace, nastaveniIS, ochranaUdaju } from './personal';

export * from './types';

export const pagesData: PageCategory[] = [
    portalInfo,
    mojeStudium,
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
    ochranaUdaju
];

export const BASE_URL = "https://is.mendelu.cz";
