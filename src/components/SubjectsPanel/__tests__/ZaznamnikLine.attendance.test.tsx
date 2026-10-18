import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { ZaznamnikLine } from '../ZaznamnikLine';
import { useAppStore } from '../../../store/useAppStore';
import { parseAttendance } from '../../../api/subjects';

// A real list.pl page, through the parser, into the drawer header's dots. When IS
// switched to span icons the parse came back empty and the dots silently vanished.
const page = readFileSync(
  join(__dirname, '../../../api/__tests__/fixtures/list-zaznamniku/pef-prez-recorded.cz.html'),
  'utf-8'
);

describe('ZaznamnikLine attendance from a real list.pl page', () => {
  beforeEach(() => {
    useAppStore.setState({
      attendance: parseAttendance(page),
      cvicneTests: [],
      odevzdavarny: [],
      subjects: null,
    } as never);
  });

  it('counts a one-action subject read from its own row', () => {
    render(<ZaznamnikLine courseCode="EXC-KPSIT" />);
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('counts a subject read from its sub-row', () => {
    render(<ZaznamnikLine courseCode="EBC-PS" />);
    expect(screen.getByText('4/4')).toBeTruthy();
  });
});
