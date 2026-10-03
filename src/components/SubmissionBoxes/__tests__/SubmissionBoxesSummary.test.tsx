import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SubmissionBoxesSummary } from '../SubmissionBoxesSummary';
import { useAppStore } from '../../../store/useAppStore';
import { NOW, box } from './boxFixtures';

/**
 * The Subjects-screen card, on both trees. Compact on purpose: some teachers
 * leave a box open for the whole year, so a list of every open box would grow
 * into a permanent wall. Rows are only what is actually due.
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

  it('rows only for boxes due within 14 days with nothing uploaded; the rest only counted', () => {
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

  it('says nothing is due rather than listing a box left open all year', () => {
    useAppStore.setState({
      odevzdavarny: [box({ name: 'Projects', deadline: '31.01.2027 04:27' })],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.getByText('Nic k odevzdání do 14 dní')).toBeTruthy();
    expect(screen.queryByText('Projects')).toBeNull();
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
