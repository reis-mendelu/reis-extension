/**
 * Every IS Mendelu page a reIS parser reads, for `scrape:real --dump-html`.
 *
 * Built in passes because most pages need an id that only another page
 * carries (a subject's `predmet`, a folder's `id`, an exam's `termin`). The
 * first pass is the pages addressed by the study alone; `laterPages` then reads
 * the ids out of them with deliberately loose regexes, so a redesign that
 * breaks a parser does not also stop the dump that is meant to diagnose it.
 *
 * Not dumped: POST-only pages (rozvrhy_view.pl, hledani/index.pl,
 * lide/index.pl) — a GET returns their empty form, not what the parser reads —
 * and binaries (foto.pl, certifikat.pl?get=, slozka.pl?download=).
 */
export type Page = [name: string, url: string];

/** PEF: any faculty will do, the catalogue's markup is the same for all. */
const CATALOG_FACULTY = '2';

export interface StudyIds {
  studium: string;
  obdobi: string;
  studentId: string;
}

export function firstPages(base: string, p: StudyIds): Page[] {
  const s = p.studium;
  const o = p.obdobi;
  return [
    ['study-plan', `${base}/auth/studijni/studijni_povinnosti.pl?studium=${s};razeni=obdobi`],
    ['exam-terms', `${base}/auth/student/terminy_seznam.pl?studium=${s}`],
    // Who is signed in: the name, student id and study switcher (userParams/fetchers.ts).
    ['studium', `${base}/auth/student/studium.pl?studium=${s}`],
    ['moje-studium', `${base}/auth/student/moje_studium.pl?studium=${s}`],
    ['certifikat', `${base}/auth/wifi/certifikat.pl?_m=177`],
    // A person's page (personProfile.ts, people search); the student's own.
    ['clovek', `${base}/auth/lide/clovek.pl?id=${p.studentId}`],
    // Vývěska's new posts (api/bulletin.ts).
    ['vyveska', `${base}/auth/vyveska/nove_prispevky.pl?zalozka=2`],
    // IS's own notices (isNotices.ts) are tiles on the home page.
    ['index', `${base}/auth/index.pl`],
    ['odevzdavarny', `${base}/auth/student/odevzdavarny.pl?studium=${s};obdobi=${o}`],
    // Subjects + attendance (subjects.ts, attendance.ts); without obdobi = period picker.
    ['list', `${base}/auth/student/list.pl?studium=${s};obdobi=${o}`],
    ['list-periods', `${base}/auth/student/list.pl?studium=${s}`],
    // Study stats, percentile, grade history (studyStats, studyComparison, gradeHistory).
    [
      'pruchod-stat',
      `${base}/auth/student/pruchod_studiem.pl?vyber=stat_info;studium=${s};obdobi=${o}`,
    ],
    [
      'pruchod-percentil',
      `${base}/auth/student/pruchod_studiem.pl?vyber=zobrazeni_percentilu;studium=${s};obdobi=${o}`,
    ],
    [
      'pruchod-podrobne',
      `${base}/auth/student/pruchod_studiem.pl?vyber=podrobne_vsechna_obdobi;studium=${s};obdobi=${o}`,
    ],
    // Teaching week (teachingWeek.ts).
    ['prehled-tydnu', `${base}/auth/ca/prehled_tydnu.pl?studium=${s}`],
    // Cvičné testy (cvicneTests.ts).
    ['seznam-osnov', `${base}/auth/elis/student/seznam_osnov.pl?studium=${s}`],
    // Past subjects' folders (pastSubjects.ts).
    ['strom-od', `${base}/auth/dok_server/strom_od.pl?id=6`],
    // Classmates listing (classmates.ts, classmatesListing.ts).
    ['spoluzaci', `${base}/auth/student/spoluzaci.pl?studium=${s};obdobi=${o}`],
    // The catalogue's study periods, first link of impersonation's chain.
    ['catalog-periods', `${base}/auth/katalog/plany.pl?fakulta=${CATALOG_FACULTY}`],
  ];
}

const first = (html: string, re: RegExp): string | undefined => re.exec(html)?.[1];

/**
 * Pages whose id is read out of a page already dumped, minus those already
 * dumped. The dumper calls this until it returns nothing: the catalogue chain
 * (periods → one period → a programme → its plan leaf) is four pages deep.
 */
export function laterPages(base: string, p: StudyIds, dumped: Map<string, string>): Page[] {
  const s = p.studium;
  const o = p.obdobi;
  const list = dumped.get('list') ?? '';
  const exams = dumped.get('exam-terms') ?? '';
  const pages: Page[] = [];
  const predmet = first(list, /syllabus\.pl\?predmet=(\d+)/);
  if (predmet) {
    pages.push(['syllabus', `${base}/auth/katalog/syllabus.pl?predmet=${predmet}`]);
    pages.push([
      'spoluzaci-subject',
      `${base}/auth/student/spoluzaci.pl?predmet=${predmet};;studium=${s};obdobi=${o}`,
    ]);
  }
  // Záznamník: a subject that has průběžné hodnocení / a test (zaznamnik.ts).
  const list1 = `${base}/auth/student/list.pl?studium=${s};obdobi=${o}`;
  const ph = first(list, /predmet=(\d+);[^"']*prubezne=1/);
  if (ph) pages.push(['list-prubezne', `${list1};predmet=${ph};prubezne=1`]);
  const vt = first(list, /predmet=(\d+);[^"']*test=1/);
  if (vt) pages.push(['list-test', `${list1};predmet=${vt};test=1`]);
  // Every current subject's folder (`slozka.pl?ds=1;id=N` on list.pl).
  const folders = new Set([...list.matchAll(/slozka\.pl\?(?:ds=1;)?id=(\d+)/g)].map((m) => m[1]));
  folders.forEach((id) =>
    pages.push([`slozka-${id}`, `${base}/auth/dok_server/slozka.pl?id=${id}`])
  );
  // An exam term's detail page and its people list (termDetail, termDuration, terminyInfo).
  const termin = first(exams, /termin=(\d+)/);
  if (termin) {
    const q = `termin=${termin};studium=${s};obdobi=${o}`;
    pages.push(['terminy-info', `${base}/auth/student/terminy_info.pl?${q}`]);
    pages.push(['terminy-info-spoluzaci', `${base}/auth/student/terminy_info.pl?${q};spoluzaci=1`]);
  }
  // A subject code search in the catalogue (syllabus.ts findSubjectId).
  const code = first(list, />([A-Z]{2,5}-[A-Z0-9-]{1,10})</);
  if (code) pages.push(['katalog-search', `${base}/auth/katalog/index.pl?search_text=${code}`]);
  // The catalogue chain impersonation walks (impersonation/catalogNav.ts):
  // periods → one period's bachelor programmes → a programme → its plan leaf.
  const catalog = `${base}/auth/katalog/plany.pl?fakulta=${CATALOG_FACULTY}`;
  // The student's own period when the catalogue lists it (the first row is often a
  // future period with no programmes yet).
  const periods = dumped.get('catalog-periods') ?? '';
  const poc = periods.includes(`poc_obdobi=${o};`) ? o : first(periods, /poc_obdobi=(\d+)/);
  const period = `${catalog};poc_obdobi=${poc};typ_ss=;typ_studia=1`;
  if (poc) pages.push(['catalog-period', `${period};misto_vyuky=`]);
  const program = first(dumped.get('catalog-period') ?? '', /typ_studia=1;[^"]*program=(\d+)/);
  if (poc && program)
    pages.push(['catalog-programme', `${period};program=${program};misto_vyuky=`]);
  const leaf = first(
    dumped.get('catalog-programme') ?? '',
    /href="(\/auth\/[^"]*forma=1;[^"]*stud_plan=\d+[^"]*)"/
  );
  if (leaf) pages.push(['catalog-leaf', `${base}${leaf.replace(/;lang=\w+/, '')}`]);
  return pages.filter(([name]) => !dumped.has(name));
}
