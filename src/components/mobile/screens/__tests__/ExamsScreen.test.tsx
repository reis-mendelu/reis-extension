import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExamsScreen } from '../ExamsScreen';
import { ExamTimeline } from '../exams/ExamTimeline';
import { useAppStore } from '../../../../store/useAppStore';
import type { ExamSubject } from '../../../../types/exams';
import type { TimelinePoint } from '../../../../utils/mobile/examTimeline';

function point(overrides: Partial<TimelinePoint> = {}): TimelinePoint {
    return {
        id: overrides.id ?? 'p1',
        subjectCode: overrides.subjectCode ?? 'EBC-ALG',
        date: overrides.date ?? new Date('2026-06-01T09:00:00'),
        daysLeft: overrides.daysLeft ?? 5,
        label: overrides.label ?? '1.6.2026 09:00',
        shortLabel: overrides.shortLabel ?? '1.6.',
    };
}

function subject(sections: ExamSubject['sections'], overrides: Partial<ExamSubject> = {}): ExamSubject {
    return {
        version: 1,
        id: overrides.id ?? 'sub-1',
        name: overrides.name ?? 'Algoritmizace',
        code: overrides.code ?? 'EBC-ALG',
        sections,
    };
}

function setExams(data: ExamSubject[]) {
    useAppStore.setState({ exams: { data, status: 'success', error: null } });
}

describe('ExamsScreen', () => {
    beforeEach(() => {
        useAppStore.setState({
            language: 'cz',
            syncStatus: { isSyncing: false, lastSync: 1, error: null, handshakeDone: true, handshakeTimedOut: false },
            exams: { data: [], status: 'success', error: null },
            examClassmates: {},
            examClassmatesLoading: {},
            examClassmatesError: {},
            lastExamClassmatesFetchedAt: {},
        });
    });

    it('renders the empty state when there are no exams', () => {
        render(<ExamsScreen />);
        expect(screen.getByText('Žádné zkoušky')).toBeInTheDocument();
    });

    it('renders a collapsed card for a subject with terms', () => {
        setExams([subject([{
            id: 'sec-1', name: 'zkouška', type: 'exam', status: 'available',
            terms: [{ id: 'term-1', date: '1.6.2026', time: '09:00', canRegisterNow: true }],
        }])]);
        render(<ExamsScreen />);
        expect(screen.getByText('Algoritmizace')).toBeInTheDocument();
        expect(screen.queryByText('Přihlásit')).not.toBeInTheDocument();
    });

    it('shows Přihlásit on a registerable term once the card is expanded', () => {
        setExams([subject([{
            id: 'sec-1', name: 'zkouška', type: 'exam', status: 'available',
            terms: [{ id: 'term-1', date: '1.6.2026', time: '09:00', canRegisterNow: true }],
        }])]);
        render(<ExamsScreen />);
        fireEvent.click(screen.getByText('Algoritmizace'));
        expect(screen.getByText('Přihlásit')).toBeInTheDocument();
    });

    it('shows obsazeno and no register button for a full term', () => {
        setExams([subject([{
            id: 'sec-1', name: 'zkouška', type: 'exam', status: 'available',
            terms: [{ id: 'term-1', date: '1.6.2026', time: '09:00', canRegisterNow: true, full: true }],
        }])]);
        render(<ExamsScreen />);
        fireEvent.click(screen.getByText('Algoritmizace'));
        expect(screen.getByText('obsazeno')).toBeInTheDocument();
        expect(screen.queryByText('Přihlásit')).not.toBeInTheDocument();
    });

    it('renders the watch button for a term carrying a watchdogUrl', () => {
        setExams([subject([{
            id: 'sec-1', name: 'zkouška', type: 'exam', status: 'available',
            terms: [{ id: 'term-1', date: '1.6.2026', time: '09:00', canRegisterNow: false, watchdogUrl: 'https://is.mendelu.cz/x?aktivace=1' }],
        }])]);
        render(<ExamsScreen />);
        fireEvent.click(screen.getByText('Algoritmizace'));
        expect(screen.getByTestId('watch-toggle')).toBeInTheDocument();
    });

    // Unregistering is destructive, so it lives behind the card's chevron
    // rather than sitting on every collapsed registered card.
    it('reveals Odhlásit for a registered section only once expanded', () => {
        useAppStore.setState({
            examClassmates: { 'term-1': [] },
            lastExamClassmatesFetchedAt: { 'term-1': Date.now() },
        });
        setExams([subject([{
            id: 'sec-1', name: 'zkouška', type: 'exam', status: 'registered',
            registeredTerm: { id: 'term-1', date: '1.6.2026', time: '09:00' },
            terms: [{ id: 'term-1', date: '1.6.2026', time: '09:00' }],
        }])]);
        render(<ExamsScreen />);
        expect(screen.queryByText('Odhlásit')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { expanded: false }));
        expect(screen.getByText('Odhlásit')).toBeInTheDocument();
    });

    it('puts a registered section under Nadcházející and a non-registered one under Ostatní', () => {
        useAppStore.setState({
            examClassmates: { 'term-1': [] },
            lastExamClassmatesFetchedAt: { 'term-1': Date.now() },
        });
        setExams([
            subject([{
                id: 'sec-reg', name: 'zkouška', type: 'exam', status: 'registered',
                registeredTerm: { id: 'term-1', date: '1.6.2026', time: '09:00' },
                terms: [{ id: 'term-1', date: '1.6.2026', time: '09:00' }],
            }], { id: 'sub-reg', name: 'RegisteredSubject', code: 'REG-1' }),
            subject([{
                id: 'sec-avail', name: 'zkouška', type: 'exam', status: 'available',
                terms: [{ id: 'term-2', date: '2.6.2026', time: '10:00', canRegisterNow: true }],
            }], { id: 'sub-avail', name: 'AvailableSubject', code: 'AVL-1' }),
        ]);
        render(<ExamsScreen />);
        const text = screen.getByTestId('exams-screen').textContent ?? '';
        const upcomingIdx = text.indexOf('Nadcházející');
        const otherIdx = text.indexOf('Ostatní');
        const regIdx = text.indexOf('RegisteredSubject');
        const availIdx = text.indexOf('AvailableSubject');

        expect(upcomingIdx).toBeGreaterThanOrEqual(0);
        expect(otherIdx).toBeGreaterThan(upcomingIdx);
        expect(regIdx).toBeGreaterThan(upcomingIdx);
        expect(regIdx).toBeLessThan(otherIdx);
        expect(availIdx).toBeGreaterThan(otherIdx);
    });

    it('marks the matching term as "tvůj termín" once a registered section is expanded', () => {
        useAppStore.setState({
            examClassmates: { 'term-1': [] },
            lastExamClassmatesFetchedAt: { 'term-1': Date.now() },
        });
        setExams([subject([{
            id: 'sec-1', name: 'zkouška', type: 'exam', status: 'registered',
            registeredTerm: { id: 'term-1', date: '1.6.2026', time: '09:00' },
            terms: [{ id: 'term-1', date: '1.6.2026', time: '09:00' }],
        }])]);
        render(<ExamsScreen />);
        fireEvent.click(screen.getByText('Algoritmizace'));
        expect(screen.getByText('tvůj termín')).toBeInTheDocument();
    });
});

// Positioning and clustering are `layoutExamTimeline`'s job and are covered in
// utils/mobile/__tests__/examTimelineLayout.test.ts against real widths. These
// cover what only rendering can: jsdom reports a zero-width rail (no layout
// engine), so the component must still paint via the even-spacing fallback.
describe('ExamTimeline', () => {
    const NOW = new Date('2026-05-25T09:00:00');

    it('renders nothing for zero points', () => {
        const { container } = render(<ExamTimeline points={[]} now={NOW} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('centres a single point at 50% of the inset span', () => {
        render(<ExamTimeline points={[point({ id: 'only' })]} now={NOW} />);
        // Renders the short label; the full date+time would not fit alongside
        // its neighbours once there is more than one point.
        const wrapper = screen.getByText('1.6.').parentElement;
        expect(wrapper).toHaveStyle({ left: '50%' });
    });

    it('still lays points out when the rail width is unmeasurable', () => {
        render(<ExamTimeline points={[
            point({ id: 'first', shortLabel: 'first-label' }),
            point({ id: 'second', shortLabel: 'second-label' }),
        ]} now={NOW} />);
        expect(screen.getByText('first-label').parentElement).toHaveStyle({ left: '0%' });
        expect(screen.getByText('second-label').parentElement).toHaveStyle({ left: '100%' });
    });

    it('centres the points between the two ends', () => {
        render(<ExamTimeline points={[
            point({ id: 'a', shortLabel: 'a-label' }),
            point({ id: 'b', shortLabel: 'b-label' }),
            point({ id: 'c', shortLabel: 'c-label' }),
        ]} now={NOW} />);
        expect(screen.getByText('b-label').parentElement).toHaveStyle({ left: '50%' });
    });
});
