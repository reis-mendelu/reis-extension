import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, cleanup, within } from '@testing-library/react';
import { AttendanceSection } from '../Zaznamnik/AttendanceSection';
import { ZaznamnikTab } from '../ZaznamnikTab';
import { useAppStore } from '../../../store/useAppStore';
import { parseAttendance } from '../../../api/attendance';
import cs from '../../../i18n/locales/cs.json';
import en from '../../../i18n/locales/en.json';

// A real list.pl page through the parser: EXC-KPSIT has one absence and one
// presence, on "EXC-KPSIT Cv St 17.00-18.50 Q01.48".
const page = readFileSync(
  join(__dirname, '../../../api/__tests__/fixtures/list-zaznamniku/pef-prez-recorded.cz.html'),
  'utf-8'
);

function seed(language: 'cz' | 'en') {
  useAppStore.setState({
    language,
    attendance: parseAttendance(page),
    studiumId: '123',
    obdobiId: '456',
    zaznamnikHydrated: true,
    zaznamnikLoading: {},
    zaznamnik: {},
    odevzdavarny: [],
    impersonation: null,
    subjects: { data: { 'EXC-KPSIT': { hasPrubezne: true, hasTest: false, subjectId: '1' } } },
  } as never);
}

describe('AttendanceSection', () => {
  afterEach(cleanup);

  it('says what it counts, in words', () => {
    seed('cz');
    render(<AttendanceSection courseCode="EXC-KPSIT" />);
    expect(screen.getByText(cs.zaznamnik.attendanceSection)).toBeInTheDocument();
    expect(screen.getByText('Na 1 ze 2 cvičení')).toBeInTheDocument();
    expect(screen.getByText(/1× chyběl\/a · Cv St 17\.00–18\.50 Q01\.48/)).toBeInTheDocument();
    expect(screen.getByText(cs.zaznamnik.attendanceNote)).toBeInTheDocument();
  });

  it('lists every recorded session with date, time, room and a status word', () => {
    seed('cz');
    render(<AttendanceSection courseCode="EXC-KPSIT" />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const first = within(rows[0]!);
    expect(first.getByText('23. 9.')).toBeInTheDocument();
    expect(first.getByText('17.00–18.50')).toBeInTheDocument();
    expect(first.getByText('Q01.48')).toBeInTheDocument();
    expect(first.getByText(cs.zaznamnik.attendanceStatus.absent)).toBeInTheDocument();
    expect(within(rows[1]!).getByText(cs.zaznamnik.attendanceStatus.present)).toBeInTheDocument();
  });

  it('keeps the phone summary short: the detail drops out below a wide container', () => {
    seed('cz');
    render(<AttendanceSection courseCode="EXC-KPSIT" />);
    expect(screen.getByText(/1× chyběl\/a/).className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(screen.getByText(/1× chyběl\/a/).className).toMatch(/@md:inline/);
  });

  it('speaks English', () => {
    seed('en');
    render(<AttendanceSection courseCode="EXC-KPSIT" />);
    expect(screen.getByText('At 1 of 2 sessions')).toBeInTheDocument();
    expect(screen.getByText(en.zaznamnik.attendanceStatus.absent)).toBeInTheDocument();
  });

  it('renders nothing for a subject with no attendance records', () => {
    seed('cz');
    const { container } = render(<AttendanceSection courseCode="EBC-MT" />);
    expect(container.innerHTML).toBe('');
  });
});

// The same tab renders in the desktop drawer and in the phone/iPad sheet
// (DrawerTabBody); the phone passes showIsBacklink={false}.
describe.each([
  ['desktop drawer', true],
  ['phone sheet', false],
])('ZaznamnikTab attendance in the %s', (_, showIsBacklink) => {
  beforeEach(() => seed('cz'));
  afterEach(cleanup);

  it('opens the tab with Docházka, above everything else', () => {
    render(<ZaznamnikTab courseCode="EXC-KPSIT" showIsBacklink={showIsBacklink} />);
    const heading = screen.getByText(cs.zaznamnik.attendanceSection);
    const note = screen.getByText(cs.zaznamnik.noData);
    expect(heading.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no Docházka for a subject without records', () => {
    useAppStore.setState({
      subjects: { data: { 'EBC-MT': { hasPrubezne: true, hasTest: false, subjectId: '2' } } },
    } as never);
    render(<ZaznamnikTab courseCode="EBC-MT" showIsBacklink={showIsBacklink} />);
    expect(screen.queryByText(cs.zaznamnik.attendanceSection)).toBeNull();
  });

  it('keeps Docházka when the marks failed to load', () => {
    useAppStore.setState({ zaznamnik: { 'EXC-KPSIT': null } } as never);
    render(<ZaznamnikTab courseCode="EXC-KPSIT" showIsBacklink={showIsBacklink} />);
    expect(screen.getByText(cs.zaznamnik.attendanceSection)).toBeInTheDocument();
    expect(screen.getByText(cs.mobile.loadFailed.title)).toBeInTheDocument();
  });
});
