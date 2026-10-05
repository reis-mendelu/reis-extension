import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SubmissionBoxesSummary } from '../SubmissionBoxesSummary';
import { useAppStore } from '../../../store/useAppStore';
import { NOW, box } from './boxFixtures';

/**
 * The Subjects-screen card, on both trees. Compact by default: some teachers
 * leave a box open for the whole year, so a list of every open box would grow
 * into a permanent wall. Collapsed, rows are only what is actually due; the
 * open count is a disclosure that lists every open box.
 */
describe('SubmissionBoxesSummary', () => {
  beforeEach(() => {
    useAppStore.setState({ now: NOW, language: 'cz' } as never);
  });
  afterEach(cleanup);

  it('renders nothing when no box is open', () => {
    useAppStore.setState({ odevzdavarny: [box({ isOpen: false, section: 'closed' })] });
    const { container } = render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('collapsed: rows only for boxes due within 14 days with nothing uploaded', () => {
    useAppStore.setState({
      odevzdavarny: [
        box({ name: 'Rozpracovaný projekt', deadline: '08.10.2026 23:59', odevzdavarnaId: '1' }),
        box({ name: 'Projects', deadline: '31.01.2027 04:27', odevzdavarnaId: '2' }),
        box({ name: 'Hotovo', deadline: '06.10.2026 10:00', fileCount: 1, odevzdavarnaId: '3' }),
      ],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.getByText('3 otevřené')).toBeTruthy();
    expect(screen.getByText('Rozpracovaný projekt')).toBeTruthy();
    expect(screen.queryByText('Projects')).toBeNull();
    expect(screen.queryByText('Hotovo')).toBeNull();
  });

  it('collapsed: says nothing is due rather than listing a box left open all year', () => {
    useAppStore.setState({
      odevzdavarny: [box({ name: 'Projects', deadline: '31.01.2027 04:27' })],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.getByText('Nic k odevzdání do 14 dní')).toBeTruthy();
    expect(screen.queryByText('Projects')).toBeNull();
    const toggle = screen.getByTestId('submission-boxes-toggle');
    expect(toggle.textContent).toContain('1 otevřená');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('expands to every open box when nothing is due, with deadline and upload state', () => {
    useAppStore.setState({
      odevzdavarny: [
        box({ name: 'Projects', deadline: '31.01.2027 04:27', odevzdavarnaId: '1' }),
        box({ name: 'Zadání', deadline: '12.10.2026 12:00', fileCount: 1, odevzdavarnaId: '2' }),
        box({ name: 'Bez termínu', deadline: '', odevzdavarnaId: '3' }),
        box({ name: 'Uzavřená', isOpen: false, section: 'closed', odevzdavarnaId: '4' }),
      ],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    fireEvent.click(screen.getByTestId('submission-boxes-toggle'));

    expect(screen.getByTestId('submission-boxes-toggle').getAttribute('aria-expanded')).toBe(
      'true'
    );
    const rows = screen.getAllByTestId('submission-open-row');
    // Soonest first, a box without a deadline last, the closed one not at all.
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Zadání'),
      expect.stringContaining('Projects'),
      expect.stringContaining('Bez termínu'),
    ]);
    expect(rows[0]!.textContent).toContain('Odevzdáno');
    expect(rows[0]!.textContent).toContain('za 9 d');
    expect(rows[1]!.textContent).not.toContain('Odevzdáno');
    expect(rows[1]!.textContent).toContain('do 31. 1.');
    expect(screen.queryByText('Nic k odevzdání do 14 dní')).toBeNull();
    expect(screen.queryByText('Uzavřená')).toBeNull();
  });

  it('expanded replaces the due rows, so no box is listed twice', () => {
    useAppStore.setState({
      odevzdavarny: [
        box({ name: 'Rozpracovaný projekt', deadline: '08.10.2026 23:59', odevzdavarnaId: '1' }),
        box({ name: 'Projects', deadline: '31.01.2027 04:27', odevzdavarnaId: '2' }),
      ],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.getAllByTestId('submission-due-row')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('submission-boxes-toggle'));
    expect(screen.queryAllByTestId('submission-due-row')).toHaveLength(0);
    expect(screen.getAllByTestId('submission-open-row')).toHaveLength(2);
    expect(screen.getAllByText('Rozpracovaný projekt')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('submission-boxes-toggle'));
    expect(screen.queryAllByTestId('submission-open-row')).toHaveLength(0);
    expect(screen.getAllByTestId('submission-due-row')).toHaveLength(1);
  });

  it('no disclosure when the collapsed card already shows every open box', () => {
    useAppStore.setState({
      odevzdavarny: [box({ name: 'Rozpracovaný projekt', deadline: '08.10.2026 23:59' })],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.queryByTestId('submission-boxes-toggle')).toBeNull();
    expect(screen.getByText('1 otevřená')).toBeTruthy();
  });

  it('an expanded row opens the box’s subject; one without a subject links to IS', () => {
    const onOpen = vi.fn();
    const known = box({ name: 'Projects', deadline: '31.01.2027 04:27', odevzdavarnaId: '1' });
    const orphan = box({
      name: 'Cizí',
      courseCode: undefined,
      courseId: 'P9',
      deadline: '01.02.2027 10:00',
      odevzdavarnaId: '2',
    });
    useAppStore.setState({ odevzdavarny: [known, orphan], subjects: { data: {} } } as never);
    render(<SubmissionBoxesSummary onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('submission-boxes-toggle'));
    fireEvent.click(screen.getByText('Projects'));
    expect(onOpen).toHaveBeenCalledWith('EBC-PJ', known);
    const [, orphanRow] = screen.getAllByTestId('submission-open-row');
    expect(orphanRow!.getAttribute('href')).toBe(orphan.uploadUrl);
  });

  it('caps the rows at three', () => {
    useAppStore.setState({
      odevzdavarny: [1, 2, 3, 4].map((n) =>
        box({ name: `Úkol ${n}`, deadline: `0${4 + n}.10.2026 10:00`, odevzdavarnaId: String(n) })
      ),
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.getAllByTestId('submission-due-row')).toHaveLength(3);
  });

  it('opens the box’s subject when a row is tapped', () => {
    const onOpen = vi.fn();
    const due = box({ name: 'Rozpracovaný projekt', deadline: '08.10.2026 23:59' });
    useAppStore.setState({ odevzdavarny: [due] });
    render(<SubmissionBoxesSummary onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Rozpracovaný projekt'));
    expect(onOpen).toHaveBeenCalledWith('EBC-PJ', due);
  });

  it('finds the subject by predmet id for a row cached without a course code', () => {
    const onOpen = vi.fn();
    const due = box({ courseCode: undefined, deadline: '08.10.2026 23:59' });
    useAppStore.setState({
      odevzdavarny: [due],
      subjects: { data: { 'EBC-PJ': { subjectId: 'P1' } } },
    } as never);
    render(<SubmissionBoxesSummary onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Projekt'));
    expect(onOpen).toHaveBeenCalledWith('EBC-PJ', due);
  });

  it('falls back to a link into IS when the subject cannot be found', () => {
    const due = box({ courseCode: undefined, courseId: 'P9', deadline: '08.10.2026 23:59' });
    useAppStore.setState({ odevzdavarny: [due], subjects: { data: {} } } as never);
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.getByTestId('submission-due-row').getAttribute('href')).toBe(due.uploadUrl);
  });
});
