import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { ZaznamnikLine } from '../ZaznamnikLine';
import { useAppStore } from '../../../store/useAppStore';
import { parseAttendance } from '../../../api/attendance';

// A real list.pl page, through the parser, into the store. The drawer header used to
// turn it into coloured dots and a bare "0/1" nobody understood; they were removed
// until attendance gets a labelled place (Task List, 2026-10-29).
const page = readFileSync(
  join(__dirname, '../../../api/__tests__/fixtures/list-zaznamniku/pef-prez-recorded.cz.html'),
  'utf-8'
);

describe('ZaznamnikLine leaves attendance out', () => {
  beforeEach(() => {
    useAppStore.setState({
      attendance: parseAttendance(page),
      cvicneTests: [],
      odevzdavarny: [],
      subjects: null,
    } as never);
    // Both subjects really carry attendance, so an empty render means "left out", not "no data".
    const { attendance } = useAppStore.getState();
    expect(attendance['EXC-KPSIT']?.[0]?.records.length).toBeGreaterThan(0);
    expect(attendance['EBC-PS']?.[0]?.records.length).toBeGreaterThan(0);
  });

  it('draws nothing for a subject whose only content is attendance', () => {
    const { container } = render(<ZaznamnikLine courseCode="EXC-KPSIT" />);
    expect(container.innerHTML).toBe('');
  });

  it('keeps the rest of the line, without a count or dots', () => {
    useAppStore.setState({
      subjects: { data: { 'EBC-PS': { autoHref: 'https://example.test/ah' } } },
    } as never);
    const { container } = render(<ZaznamnikLine courseCode="EBC-PS" />);
    expect(screen.getByText('AH')).toBeTruthy();
    expect(screen.queryByText('4/4')).toBeNull();
    expect(container.querySelector('.rounded-full')).toBeNull();
  });
});
