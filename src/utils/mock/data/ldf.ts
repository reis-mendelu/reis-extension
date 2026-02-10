import type { SocietyDataset } from '../MockManager';

export const ldfDataset: SocietyDataset = {
  id: 'ldf',
  name: 'LDF Spolek',
  exams: [
    {
      version: 1,
      id: 'exam-spatial',
      name: 'Spatial Planning',
      code: 'LDF-SPATIAL',
      sections: [
        {
          id: 'spatial-zkouska',
          name: 'exam',
          type: 'exam',
          status: 'open',
          terms: [
            {
              id: 'spatial-term-1',
              date: '20.02.2026',
              time: '08:00',
              capacity: { occupied: 10, total: 15, raw: '10/15' },
              full: false,
              room: 'S301',
              teacher: 'Dr. Robert Green, Ph.D.',
              teacherId: 'green-robert',
              registrationStart: '15.02.2026 00:00',
              registrationEnd: '19.02.2026 23:59',
              attemptType: 'regular',
              canRegisterNow: false
            }
          ]
        }
      ]
    }
  ],
  schedule: [
    {
      id: 'sched-tue-spatial',
      date: '20260211',
      startTime: '13:00',
      endTime: '14:30',
      courseCode: 'LDF-SPATIAL',
      courseName: 'Spatial Planning',
      room: 'S301',
      roomStructured: { name: 'S301', id: 's301' },
      teachers: [{ fullName: 'Dr. Robert Green, Ph.D.', shortName: 'Green', id: 'green-robert' }],
      isExam: false,
      isConsultation: 'false',
      studyId: '',
      facultyCode: 'LDF',
      isDefaultCampus: 'true',
      courseId: 'ldf-spatial',
      campus: 'Brno',
      isSeminar: 'false',
      periodId: ''
    }
  ]
};
