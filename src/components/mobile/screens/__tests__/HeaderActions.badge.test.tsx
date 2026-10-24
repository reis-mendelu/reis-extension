import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderActions } from '../HeaderActions';
import { useAppStore } from '../../../../store/useAppStore';

function pad(n: number) {
  return String(n).padStart(2, '0');
}
/** IS Mendelu's `DD.MM.YYYY HH:MM`, a few hours out. */
function inHours(h: number) {
  const d = new Date(Date.now() + h * 3_600_000);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FEED = {
  data: [],
  status: 'success',
  readIds: new Set<string>(),
  viewedIds: new Set<string>(),
  seenDeadlineAlertIds: new Set<string>(),
};

describe('HeaderActions badge', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      notifications: EMPTY_FEED,
      exams: { data: [] },
      odevzdavarny: [],
      cvicneTests: [],
      now: new Date(),
    } as never);
  });

  // The deadline strip used to sit in the calendar header, so the bell never
  // had to carry deadlines. With the strip gone — Novinky is the one place for
  // them now — a deadline that nobody has opened the sheet for would arrive
  // with no signal anywhere in the app.
  it('counts unseen deadline alerts, not just society notifications', () => {
    useAppStore.setState({
      odevzdavarny: [
        {
          odevzdavarnaId: 'o1',
          courseId: 'ALG',
          courseNameCs: 'Algoritmizace',
          courseNameEn: 'Algorithms',
          name: 'Semestrální projekt',
          type: 'Odevzdávárna',
          deadline: inHours(5),
          fileCount: 0,
          uploadUrl: 'https://is.mendelu.cz/x',
        },
      ],
    } as never);

    render(<HeaderActions />);
    expect(screen.getByLabelText('Oznámení')).toHaveTextContent('1');
  });

  it('drops an alert from the count once it has been seen', () => {
    useAppStore.setState({
      odevzdavarny: [
        {
          odevzdavarnaId: 'o1',
          courseId: 'ALG',
          courseNameCs: 'Algoritmizace',
          courseNameEn: 'Algorithms',
          name: 'Semestrální projekt',
          type: 'Odevzdávárna',
          deadline: inHours(5),
          fileCount: 0,
          uploadUrl: 'https://is.mendelu.cz/x',
        },
      ],
      notifications: { ...EMPTY_FEED, seenDeadlineAlertIds: new Set(['odev-o1']) },
    } as never);

    render(<HeaderActions />);
    expect(screen.getByLabelText('Oznámení')).not.toHaveTextContent('1');
  });
});
