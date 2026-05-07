import type { SocietyDataset } from '../MockManager';
import type { SyllabusRequirements } from '../../../types/documents';

const MIKRO_SYLLABUS: SyllabusRequirements = {
  version: 1,
  language: 'cz',
  requirementsText: `Předmět je ukončen zkouškou. Studenti se na zkoušku přihlašují prostřednictvím IS. Podmínkou pro připuštění ke zkoušce je získání zápočtu. Zápočet se uděluje za účast na seminářích a úspěšné absolvování dvou průběžných testů. První test (v 7. týdnu) - max. 20 bodů. Druhý test (ve 13. týdnu) - max. 20 bodů. Pro získání zápočtu je nutné získat v součtu alespoň 24 bodů. Zkouška je písemná, max. 60 bodů. Pro úspěšné absolvování je nutné získat alespoň 36 bodů.`,
  requirementsTable: [
    ['Průběžný test 1', '20'],
    ['Průběžný test 2', '20'],
    ['Zkouška', '60'],
    ['Celkem', '100']
  ],
  courseInfo: {
    credits: '6',
    garant: { name: 'Ing. Alena Melicharová, Ph.D.' },
    teachers: [{ name: 'Ing. Alena Melicharová, Ph.D.', roles: 'přednášející, garant' }],
    status: 'active',
    courseNameCs: 'Mikroekonomie 1',
    courseNameEn: 'Microeconomics 1'
  }
};

const PRAVO_SYLLABUS: SyllabusRequirements = {
  version: 1,
  language: 'cz',
  requirementsText: `Předmět je ukončen zkouškou, která se skládá z písemného testu. Podmínkou pro připuštění ke zkoušce je získání zápočtu. Zápočet je udělován na základě aktivní účasti na seminářích a úspěšného vypracování seminárních úkolů.`,
  requirementsTable: [
    ['Zápočet', '30'],
    ['Zkouška', '70'],
    ['Celkem', '100']
  ],
  courseInfo: {
    credits: '5',
    garant: { name: 'doc. JUDr. Martin Janků, CSc.' },
    teachers: [{ name: 'doc. JUDr. Martin Janků, CSc.', roles: 'přednášející, garant' }],
    status: 'active',
    courseNameCs: 'Právo',
    courseNameEn: 'Law'
  }
};

export const supefDataset: SocietyDataset = {
  id: 'supef',
  name: 'SUPEF',
  exams: [
    {
      version: 1,
      id: 'exam-mi1',
      name: 'Mikroekonomie 1',
      code: 'EBC-MI',
      sections: [
        {
          id: 'mi1-zkouska',
          name: 'exam',
          type: 'exam',
          status: 'registered',
          registeredTerm: {
            id: 'mi1-term-1',
            date: '12.02.2026',
            time: '08:00',
            room: 'Q01',
            teacher: 'Ing. Alena Melicharová, Ph.D.',
            teacherId: 'melicharova-alena',
            deregistrationDeadline: '11.02.2026 23:59'
          },
          terms: [
            {
              id: 'mi1-term-1',
              date: '12.02.2026',
              time: '08:00',
              capacity: { occupied: 45, total: 50, raw: '45/50' },
              full: false,
              room: 'Q01',
              teacher: 'Ing. Alena Melicharová, Ph.D.',
              teacherId: 'melicharova-alena',
              registrationStart: '01.01.2026 00:00',
              registrationEnd: '11.02.2026 23:59',
              attemptTypes: ['regular'],
              canRegisterNow: true
            }
          ]
        }
      ]
    },
    {
      version: 1,
      id: 'exam-pravo',
      name: 'Právo',
      code: 'EBC-P',
      sections: [
        {
          id: 'pravo-zkouska',
          name: 'exam',
          type: 'exam',
          status: 'open',
          terms: [
            {
              id: 'pravo-term-1',
              date: '19.02.2026',
              time: '14:00',
              capacity: { occupied: 120, total: 200, raw: '120/200' },
              full: false,
              room: 'Aula',
              teacher: 'doc. JUDr. Martin Janků, CSc.',
              teacherId: 'janku-martin',
              registrationStart: '05.02.2026 00:00',
              registrationEnd: '18.02.2026 23:59',
              attemptTypes: ['regular'],
              canRegisterNow: true
            }
          ]
        }
      ]
    },
    {
      version: 1,
      id: 'exam-ds',
      name: 'Daňová soustava',
      code: 'EBC-DS',
      sections: [
        {
          id: 'ds-zkouska',
          name: 'exam',
          type: 'exam',
          status: 'open',
          terms: [
            {
              id: 'ds-term-1',
              date: '23.02.2026',
              time: '10:00',
              capacity: { occupied: 30, total: 30, raw: '30/30' },
              full: true,
              room: 'Q21',
              teacher: 'Ing. Břetislav Andrlík, Ph.D.',
              teacherId: 'andrlik-bretislav',
              registrationStart: '01.02.2026 00:00',
              registrationEnd: '22.02.2026 23:59',
              attemptTypes: ['regular'],
              canRegisterNow: true
            }
          ]
        }
      ]
    },
    {
      version: 1,
      id: 'exam-man',
      name: 'Management',
      code: 'EBC-MAN',
      sections: [
        {
          id: 'man-zkouska',
          name: 'exam',
          type: 'exam',
          status: 'open',
          terms: [
            {
              id: 'man-term-1',
              date: '25.02.2026',
              time: '13:00',
              capacity: { occupied: 10, total: 100, raw: '10/100' },
              full: false,
              room: 'Q01',
              teacher: 'doc. Ing. Pavel Žufan, Ph.D.',
              teacherId: 'zufan-pavel',
              registrationStart: '01.02.2026 00:00',
              registrationEnd: '24.02.2026 23:59',
              attemptTypes: ['regular'],
              canRegisterNow: true
            }
          ]
        }
      ]
    },
    {
      version: 1,
      id: 'exam-st',
      name: 'Statistika',
      code: 'EBC-ST',
      sections: [
        {
          id: 'st-zkouska',
          name: 'exam',
          type: 'exam',
          status: 'open',
          terms: [
            {
              id: 'st-term-1',
              date: '26.02.2026',
              time: '09:00',
              capacity: { occupied: 50, total: 80, raw: '50/80' },
              full: false,
              room: 'Q11',
              teacher: 'doc. Ing. Luboš Střelec, Ph.D.',
              teacherId: 'strelec-lubos',
              registrationStart: '01.02.2026 00:00',
              registrationEnd: '25.02.2026 23:59',
              attemptTypes: ['regular'],
              canRegisterNow: true
            }
          ]
        }
      ]
    },
    {
      version: 1,
      id: 'exam-mat1',
      name: 'Matematika 1',
      code: 'EBC-MT1',
      sections: [
        {
          id: 'mat1-zkouska',
          name: 'exam',
          type: 'exam',
          status: 'open',
          terms: [
            {
              id: 'mat1-term-1',
              date: '02.03.2026',
              time: '10:00',
              capacity: { occupied: 20, total: 200, raw: '20/200' },
              full: false,
              room: 'Aula',
              teacher: 'doc. RNDr. Jaroslav Paseka, CSc.',
              teacherId: 'paseka-jaroslav',
              registrationStart: '01.02.2026 00:00',
              registrationEnd: '01.03.2026 23:59',
              attemptTypes: ['regular'],
              canRegisterNow: true
            }
          ]
        }
      ]
    },
    {
      version: 1,
      id: 'exam-i1',
      name: 'Informatika',
      code: 'EBC-I',
      sections: [
        {
          id: 'i1-zkouska',
          name: 'exam',
          type: 'exam',
          status: 'open',
          terms: [
            {
              id: 'i1-term-1',
              date: '03.03.2026',
              time: '14:00',
              capacity: { occupied: 40, total: 60, raw: '40/60' },
              full: false,
              room: 'Q11',
              teacher: 'Ing. Jan Přichystal, Ph.D.',
              teacherId: 'prichystal-jan',
              registrationStart: '01.02.2026 00:00',
              registrationEnd: '02.03.2026 23:59',
              attemptTypes: ['regular'],
              canRegisterNow: true
            }
          ]
        }
      ]
    }
  ],
  schedule: [
    {
      id: 'sched-mon-mi1',
      date: '20260210',
      startTime: '08:00',
      endTime: '09:30',
      courseCode: 'EBC-MI',
      courseName: 'Mikroekonomie 1',
      room: 'Q01',
      roomStructured: { name: 'Q01', id: 'q01' },
      teachers: [{ fullName: 'Ing. Alena Melicharová, Ph.D.', shortName: 'Melicharová', id: 'melicharova-alena' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'ebc-mi',
      campus: 'Brno',
      isSeminar: 'false',
      periodId: ''
    },
    {
      id: 'sched-mon-alg',
      date: '20260210',
      startTime: '10:00',
      endTime: '11:30',
      courseCode: 'EBC-ALG',
      courseName: 'Algoritmizace',
      room: 'Q11',
      roomStructured: { name: 'Q11', id: 'q11' },
      teachers: [{ fullName: 'doc. Ing. Oldřich Trenz, Ph.D.', shortName: 'Trenz', id: 'trenz-oldrich' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'ebc-alg',
      campus: 'Brno',
      isSeminar: 'false',
      periodId: ''
    },
    {
      id: 'sched-mon-aj1',
      date: '20260210',
      startTime: '12:00',
      endTime: '13:30',
      courseCode: 'EBA-AJ1',
      courseName: 'Angličtina 1',
      room: 'Q24',
      roomStructured: { name: 'Q24', id: 'q24' },
      teachers: [{ fullName: 'Mgr. Petr Novák', shortName: 'Novák', id: 'novak-petr' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'eba-aj1',
      campus: 'Brno',
      isSeminar: 'true',
      periodId: ''
    },
    {
      id: 'sched-tue-pravo',
      date: '20260211',
      startTime: '13:00',
      endTime: '14:30',
      courseCode: 'EBC-P',
      courseName: 'Právo',
      room: 'Aula',
      roomStructured: { name: 'Aula', id: 'aula' },
      teachers: [{ fullName: 'doc. JUDr. Martin Janků, CSc.', shortName: 'Janků', id: 'janku-martin' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'ebc-p',
      campus: 'Brno',
      isSeminar: 'false',
      periodId: ''
    },
    {
      id: 'sched-wed-mar',
      date: '20260212',
      startTime: '08:00',
      endTime: '09:30',
      courseCode: 'EBC-MAR',
      courseName: 'Marketing 1',
      room: 'Q11',
      roomStructured: { name: 'Q11', id: 'q11' },
      teachers: [{ fullName: 'doc. Ing. Jana Turčínková, Ph.D.', shortName: 'Turčínková', id: 'turcinkova-jana' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'ebc-mar',
      campus: 'Brno',
      isSeminar: 'false',
      periodId: ''
    },
    {
      id: 'sched-wed-ft',
      date: '20260212',
      startTime: '10:00',
      endTime: '11:30',
      courseCode: 'EBC-FT',
      courseName: 'Finanční trhy',
      room: 'Q21',
      roomStructured: { name: 'Q21', id: 'q21' },
      teachers: [{ fullName: 'doc. Ing. Svatopluk Kapounek, Ph.D.', shortName: 'Kapounek', id: 'kapounek-svatopluk' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'ebc-ft',
      campus: 'Brno',
      isSeminar: 'true',
      periodId: ''
    },
    {
      id: 'sched-thu-man',
      date: '20260213',
      startTime: '10:00',
      endTime: '11:30',
      courseCode: 'EBC-MAN',
      courseName: 'Management',
      room: 'Q01',
      roomStructured: { name: 'Q01', id: 'q01' },
      teachers: [{ fullName: 'doc. Ing. Pavel Žufan, Ph.D.', shortName: 'Žufan', id: 'zufan-pavel' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'ebc-man',
      campus: 'Brno',
      isSeminar: 'false',
      periodId: ''
    },
    {
      id: 'sched-thu-st',
      date: '20260213',
      startTime: '13:00',
      endTime: '14:30',
      courseCode: 'EBC-ST',
      courseName: 'Statistika',
      room: 'Q11',
      roomStructured: { name: 'Q11', id: 'q11' },
      teachers: [{ fullName: 'doc. Ing. Luboš Střelec, Ph.D.', shortName: 'Střelec', id: 'strelec-lubos' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'PEF',
      isDefaultCampus: 'true',
      courseId: 'ebc-st',
      campus: 'Brno',
      isSeminar: 'false',
      periodId: ''
    }
  ],
  syllabuses: {
    'EBC-MI': MIKRO_SYLLABUS,
    'EBC-P': PRAVO_SYLLABUS
  },
  success_rates: {
    'EBC-MI': {
      courseCode: 'EBC-MI',
      lastUpdated: new Date().toISOString(),
      stats: [
        {
          semesterName: 'Podzim 2025',
          semesterId: '123',
          year: 2025,
          totalPass: 450,
          totalFail: 150,
          type: 'exam',
          terms: [
            {
              term: 'Všechny termíny',
              pass: 450,
              fail: 150,
              grades: { A: 50, B: 80, C: 120, D: 100, E: 100, F: 150, FN: 0 }
            }
          ]
        }
      ]
    },
    'EBC-P': {
      courseCode: 'EBC-P',
      lastUpdated: new Date().toISOString(),
      stats: [
        {
          semesterName: 'Podzim 2025',
          semesterId: '124',
          year: 2025,
          totalPass: 300,
          totalFail: 50,
          type: 'exam',
          terms: [
            {
              term: 'Všechny termíny',
              pass: 300,
              fail: 50,
              grades: { A: 100, B: 80, C: 60, D: 40, E: 20, F: 50, FN: 0 }
            }
          ]
        }
      ]
    },
    'EBC-ALG': {
      courseCode: 'EBC-ALG',
      lastUpdated: '2026-03-06T00:00:00.000Z',
      stats: [
        {
          semesterName: 'ZS 2025/2026 - PEF',
          semesterId: '801',
          year: 2025,
          totalPass: 100,
          totalFail: 138,
          type: 'exam',
          sourceUrl: 'https://is.mendelu.cz/auth/student/hodnoceni.pl?fakulta=2;obdobi=801;predmet=159410;lang=cz',
          terms: [
            { term: 'Všechny termíny', pass: 100, fail: 138, grades: { A: 8, B: 8, C: 14, D: 18, E: 52, F: 115, FN: 23 } },
            { term: 'Řádný termín', pass: 52, fail: 186, grades: { A: 6, B: 7, C: 10, D: 11, E: 18, F: 163, FN: 23 } },
            { term: '1. opravný', pass: 30, fail: 88, grades: { A: 1, B: 0, C: 3, D: 5, E: 21, F: 88, FN: 0 } },
            { term: '2. opravný', pass: 18, fail: 57, grades: { A: 1, B: 1, C: 1, D: 2, E: 13, F: 57, FN: 0 } }
          ]
        },
        {
          semesterName: 'ZS 2024/2025 - PEF',
          semesterId: '754',
          year: 2024,
          totalPass: 51,
          totalFail: 57,
          type: 'exam',
          terms: [
            { term: 'Všechny termíny', pass: 51, fail: 57, grades: { A: 5, B: 1, C: 12, D: 4, E: 29, F: 42, FN: 15 } },
            { term: 'Řádný termín', pass: 23, fail: 85, grades: { A: 4, B: 0, C: 7, D: 2, E: 12, F: 67, FN: 16 } },
            { term: '1. opravný', pass: 12, fail: 42, grades: { A: 0, B: 1, C: 2, D: 1, E: 8, F: 42, FN: 0 } },
            { term: '2. opravný', pass: 16, fail: 1, grades: { A: 1, B: 0, C: 3, D: 1, E: 9, F: 3, FN: 0 } }
          ]
        },
        {
          semesterName: 'ZS 2023/2024 - PEF',
          semesterId: '741',
          year: 2023,
          totalPass: 80,
          totalFail: 40,
          type: 'exam',
          terms: [
            { term: 'Všechny termíny', pass: 80, fail: 40, grades: { A: 10, B: 15, C: 20, D: 15, E: 20, F: 30, FN: 10 } }
          ]
        }
      ]
    }
  }
};
