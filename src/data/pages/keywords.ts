/**
 * Natural-language keyword synonyms for IS pages.
 * Enables students to find pages by describing what they want to do,
 * not by knowing the legacy Czech page name.
 */
export const pageKeywords: Record<string, string[]> = {
  // Moje studium
  'portal-studenta': ['dashboard', 'overview', 'přehled', 'domů', 'home'],
  'e-index': ['grades', 'známky', 'hodnocení', 'výsledky', 'results', 'marks', 'zápočet', 'credit'],
  'moji-spoluzaci': ['classmates', 'spolužáci', 'students', 'colleagues', 'peers'],
  'informace-o-studiu': ['study info', 'informace', 'obor', 'program', 'field of study'],
  'mapa-studii': ['study map', 'mapa', 'overview', 'přehled studií'],
  'e-osnovy': ['syllabus', 'osnovy', 'course outline', 'requirements', 'požadavky', 'cvičné testy', 'practice tests'],
  'rozpisy-temat': ['topics', 'témata', 'assignments', 'thesis topics', 'seminární práce', 'seminar work'],
  'odevzdavarny': ['submit', 'upload', 'homework', 'úkoly', 'odevzdat', 'dropbox', 'hand in', 'domácí úkol', 'submission'],
  'kontrola-planu': ['plan check', 'study plan', 'kontrola', 'povinnosti', 'requirements', 'credits needed', 'kolik kreditů', 'studijní plány', 'studijní plán'],
  'list-zaznamnik': ['teacher list', 'záznamník', 'učitel', 'docházka', 'attendance'],
  'oblibene-predmety': ['favorites', 'oblíbené', 'bookmarks', 'saved courses'],
  'prihlasovani-zkouskam': ['exam registration', 'přihlásit zkoušku', 'termín', 'exam date', 'sign up exam', 'zapsat zkoušku'],
  'registrace-zapisy': ['course registration', 'zápis předmětů', 'enroll', 'register subjects', 'přidat předmět', 'add course'],
  'tema-zp': ['thesis', 'závěrečná práce', 'diplomka', 'bakalářka', 'diploma', 'bachelor', 'final project'],
  'osobni-rozvrh': ['schedule', 'timetable', 'rozvrh', 'calendar', 'kalendář'],
  'harmonogram-vyuky': ['teaching schedule', 'week overview', 'přehled týdnů', 'semester weeks'],
  'harmonogram-ar': ['academic year', 'akademický rok', 'semester dates', 'holidays', 'prázdniny'],
  'kontaktni-oddeleni': ['contact department', 'studijní oddělení', 'study office'],
  'prohlidka-sz': ['state exams', 'státnice', 'státní zkoušky', 'final exams'],
  'kontaktni-centrum': ['contact center', 'help desk', 'support', 'žádost', 'request', 'podpora'],
  'moje-omluvenky': ['excuses', 'absence', 'omluvenka', 'nepřítomnost', 'sick leave'],
  'tisk-dokumentu': ['print', 'tisk', 'documents', 'potvrzení', 'confirmation', 'certificate'],
  'uloziste-dokumentu': ['document storage', 'soubory', 'files', 'úložiště'],
  'evaluace': ['evaluation', 'hodnocení předmětů', 'feedback', 'course rating', 'anketa', 'survey'],
  'portal-prilezitosti': ['jobs', 'práce', 'career', 'internship', 'stáž', 'brigáda', 'job portal'],
  'financovani-studia': ['finance', 'stipendium', 'scholarship', 'poplatky', 'fees', 'tuition'],
  'ubytovaci-stipendium': ['accommodation scholarship', 'ubytovací stipendium', 'kolej', 'dormitory'],
  'vyplacena-stipendia': ['paid scholarships', 'vyplacená stipendia', 'výplata'],
  'bankovni-spojeni': ['bank account', 'banka', 'číslo účtu', 'IBAN', 'payment'],
  'objednavky': ['orders', 'objednávky', 'ISIC', 'karta', 'card'],
  'vymenny-pobyt': ['exchange', 'Erasmus', 'mobility', 'abroad', 'zahraničí', 'výměnný pobyt'],
  'hodnoceni-uspesnosti': ['success rate', 'úspěšnost', 'statistics', 'pass rate', 'statistiky předmětů'],
  'studijni-plany': ['study plan', 'studijní plány', 'studijní plán', 'katalog', 'programy'],
  'prihlaska-ke-studiu': ['application', 'přihláška', 'apply', 'admission', 'přijímací řízení'],

  // Technologie
  'wifi-certifikat': ['wifi', 'eduroam', 'internet', 'network', 'síť', 'wireless', 'certificate', 'připojení'],
  'sprava-uctu': ['account', 'účet', 'password', 'heslo', 'login', 'přihlášení'],
  'pristupovy-system': ['access', 'přístup', 'door', 'dveře', 'card', 'karta', 'building'],
  'pristup-sit': ['VPN', 'network access', 'síť', 'remote'],
  'microsoft-imagine': ['Microsoft', 'software', 'licence', 'DreamSpark', 'Azure'],

  // eLearning
  'testy-zkouseni': ['tests', 'testy', 'quiz', 'e-learning', 'online test'],
  'elektronicke-materialy': ['materials', 'materiály', 'studijní texty', 'skripta', 'study materials'],

  // Osobní management
  'dokumentovy-server': ['documents', 'dokumenty', 'file server', 'sdílení'],
  'postovni-schranka': ['email', 'mail', 'pošta', 'inbox', 'zprávy', 'messages'],
  'diskuzni-fora': ['forum', 'discussion', 'diskuze', 'fórum'],
  'odber-novinek': ['news', 'novinky', 'notifications', 'subscribe', 'odběr'],
  'vyveska': ['bulletin board', 'vývěska', 'announcements', 'oznámení'],
  'ukoly': ['tasks', 'úkoly', 'to-do', 'todo'],
  'vypujcky-knihovna': ['library', 'knihovna', 'books', 'knihy', 'výpůjčky', 'borrow'],

  // eAgenda
  'kolejni-administrativa': ['dormitory', 'kolej', 'accommodation', 'ubytování', 'room'],
  'zahranicni-cesty': ['travel', 'cesty', 'business trip'],
  'epruzkuny': ['surveys', 'průzkumy', 'questionnaire', 'dotazník'],
  'portal-volice': ['voting', 'volby', 'elections', 'hlasování'],
  'evidence-tisku': ['print log', 'tisk', 'kopírování', 'printing'],

  // Nastavení IS
  'otp-nastaveni': ['two-factor', '2FA', 'OTP', 'authentication', 'security'],
  'identita-obcana': ['citizen identity', 'identita', 'ověření'],
  'zmena-hesla': ['change password', 'heslo', 'password reset', 'nové heslo'],
  'bezpecnostni-udaje': ['security', 'recovery', 'obnovení hesla', 'reset'],
  'nastaveni-delegatu': ['delegates', 'delegáti', 'access sharing'],
};
