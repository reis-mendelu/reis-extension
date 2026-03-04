import type { SearchResult } from './types';

export const quickActions: SearchResult[] = [
  { id: 'qa-e-index', title: 'E-index', type: 'page', detail: 'Student', link: 'https://is.mendelu.cz/auth/student/pruchod_studiem.pl?studium={studium};obdobi={obdobi};lang={lang}' },
  { id: 'qa-odevzdavarna', title: 'Odevzdávárna', type: 'page', detail: 'Student', link: 'https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium={studium};obdobi={obdobi};lang={lang}' },
  { id: 'qa-wifi', title: 'Wi-Fi', type: 'page', detail: 'Student', link: 'https://is.mendelu.cz/auth/wifi/certifikat.pl?_m=177;lang={lang}' },
  { id: 'qa-practice-tests', title: 'Cvičné testy', type: 'page', detail: 'Student', link: 'https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium={studium};obdobi={obdobi};lang={lang}' },
  { id: 'qa-plan-control', title: 'Kontrola plánu', type: 'page', detail: 'Student', link: 'https://is.mendelu.cz/auth/studijni/studijni_povinnosti.pl?studium={studium};obdobi={obdobi};lang={lang}' },
  { id: 'qa-study-plans', title: 'Studijní plány', type: 'page', detail: 'Student', link: 'https://is.mendelu.cz/auth/katalog/plany.pl?lang={lang}' },
  { id: 'qa-success-rating', title: 'Hodnocení úspěšnosti', type: 'page', detail: 'Student', link: 'https://is.mendelu.cz/auth/student/hodnoceni.pl?_m=3167;lang={lang}' },
  { id: 'qa-contact-center', title: 'Kontaktní centrum', type: 'page', detail: 'Student', link: 'https://is.mendelu.cz/auth/kc/kc.pl?_m=17022;lang={lang}' },
];
