import type { SocietyDataset } from '../MockManager';

export const esnDataset: SocietyDataset = {
  id: 'esn',
  name: 'ESN Mendelu',
  exams: [
    {
      version: 1,
      id: 'exam-alg',
      name: 'Algorithms',
      code: 'EBC-ALG',
      sections: [
        {
          id: 'alg-zkouska',
          name: 'exam',
          type: 'exam',
          status: 'registered',
          registeredTerm: {
            id: 'alg-term-1',
            date: '15.02.2026',
            time: '09:00',
            room: 'Q01',
            teacher: 'Assoc. Prof. John Smith, Ph.D.',
            teacherId: 'smith-john',
            deregistrationDeadline: '14.02.2026 23:59'
          },
          terms: [
            {
              id: 'alg-term-1',
              date: '15.02.2026',
              time: '09:00',
              capacity: { occupied: 18, total: 25, raw: '18/25' },
              full: false,
              room: 'Q01',
              teacher: 'Assoc. Prof. John Smith, Ph.D.',
              teacherId: 'smith-john',
              registrationStart: '01.02.2026 00:00',
              registrationEnd: '14.02.2026 23:59',
              attemptType: 'regular',
              canRegisterNow: true
            }
          ]
        }
      ]
    },
    {
      version: 1,
      id: 'exam-czech',
      name: 'Czech Language for Foreigners',
      code: 'LDF-CZECH',
      sections: [
        {
          id: 'czech-zkouska',
          name: 'exam',
          type: 'exam',
          status: 'open',
          terms: [
            {
              id: 'czech-term-1',
              date: '18.02.2026',
              time: '10:00',
              capacity: { occupied: 15, total: 20, raw: '15/20' },
              full: false,
              room: 'P12',
              teacher: 'Mgr. Anna Nováková, Ph.D.',
              teacherId: 'novakova-anna',
              registrationStart: '05.02.2026 00:00',
              registrationEnd: '17.02.2026 23:59',
              attemptType: 'regular',
              canRegisterNow: true
            }
          ]
        }
      ]
    }
  ],
  schedule: [
    {
      id: 'sched-mon-alg',
      date: '20260210',
      startTime: '08:00',
      endTime: '09:30',
      courseCode: 'EBC-ALG',
      courseName: 'Algorithms',
      room: 'Q01',
      roomStructured: { name: 'Q01', id: 'q01' },
      teachers: [{ fullName: 'Assoc. Prof. John Smith, Ph.D.', shortName: 'Smith', id: 'smith-john' }],
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
      id: 'sched-mon-czech',
      date: '20260210',
      startTime: '10:00',
      endTime: '11:30',
      courseCode: 'LDF-CZECH',
      courseName: 'Czech Language for Foreigners',
      room: 'P12',
      roomStructured: { name: 'P12', id: 'p12' },
      teachers: [{ fullName: 'Mgr. Anna Nováková, Ph.D.', shortName: 'Nováková', id: 'novakova-anna' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'LDF',
      isDefaultCampus: 'true',
      courseId: 'ldf-czech',
      campus: 'Brno',
      isSeminar: 'true',
      periodId: ''
    }
  ]
};
