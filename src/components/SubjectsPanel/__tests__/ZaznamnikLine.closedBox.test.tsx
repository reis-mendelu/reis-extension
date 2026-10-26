import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ZaznamnikLine } from '../ZaznamnikLine';
import { useAppStore } from '../../../store/useAppStore';
import type { Odevzdavarna } from '../../../api/odevzdavarny';

const inDays = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} 23:59`;
};

const box = (over: Partial<Odevzdavarna>): Odevzdavarna => ({
  courseId: 'P1',
  courseNameCs: 'Java',
  courseNameEn: 'Java',
  name: 'Projekt',
  type: '',
  deadline: inDays(5),
  odevzdavarnaId: '7',
  fileCount: 0,
  uploadUrl: 'https://is.mendelu.cz/x',
  ...over,
});

// The drawer header's deadline chips link to the upload page. A box IS lists
// under "Kam nemohu odevzdávat" has no upload page to send the student to.
describe('ZaznamnikLine deadline chips', () => {
  beforeEach(() => {
    useAppStore.setState({ attendance: {}, cvicneTests: [], subjects: null } as never);
  });

  it('shows an open box', () => {
    useAppStore.setState({ odevzdavarny: [box({ name: 'Otevřená', isOpen: true })] });
    render(<ZaznamnikLine courseCode="EBC-PJ" subjectId="P1" />);
    expect(screen.getByText('Otevřená')).toBeTruthy();
  });

  it('leaves out a box closed to the student', () => {
    useAppStore.setState({ odevzdavarny: [box({ name: 'Zavřená', isOpen: false })] });
    render(<ZaznamnikLine courseCode="EBC-PJ" subjectId="P1" />);
    expect(screen.queryByText('Zavřená')).toBeNull();
  });
});
