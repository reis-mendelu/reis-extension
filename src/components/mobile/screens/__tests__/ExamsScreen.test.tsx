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

    it('shows Odhlásit for a registered section', () => {
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
        expect(screen.getByText('Odhlásit')).toBeInTheDocument();
    });
});

describe('ExamTimeline', () => {
    it('renders nothing for zero points', () => {
        const { container } = render(<ExamTimeline points={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('centres a single point at 50% of the inset span', () => {
        render(<ExamTimeline points={[point({ id: 'only' })]} />);
        const dotLabel = screen.getByText('1.6.2026 09:00');
        const wrapper = dotLabel.parentElement;
        expect(wrapper).toHaveStyle({ left: '50%' });
    });

    it('positions two points at the start and end of the inset span', () => {
        render(<ExamTimeline points={[
            point({ id: 'first', label: 'first-label' }),
            point({ id: 'second', label: 'second-label' }),
        ]} />);
        expect(screen.getByText('first-label').parentElement).toHaveStyle({ left: '0%' });
        expect(screen.getByText('second-label').parentElement).toHaveStyle({ left: '100%' });
    });
});
