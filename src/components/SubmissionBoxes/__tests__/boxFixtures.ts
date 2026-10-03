import type { Odevzdavarna } from '../../../api/odevzdavarny';

/** 3 Oct 2026 12:00 — the store's clock in these tests. */
export const NOW = new Date(2026, 9, 3, 12, 0);

export const box = (over: Partial<Odevzdavarna>): Odevzdavarna => ({
  courseId: 'P1',
  courseCode: 'EBC-PJ',
  courseNameCs: 'Programovací jazyk Java',
  courseNameEn: 'Java Programming Language',
  name: 'Projekt',
  type: '',
  deadline: '08.11.2026 23:59',
  odevzdavarnaId: '1',
  fileCount: 0,
  uploadUrl: 'https://is.mendelu.cz/auth/student/odevzdavarny_odevzdani.pl?odevzdavarna=1',
  section: 'open',
  isOpen: true,
  ...over,
});
