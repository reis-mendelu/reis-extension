import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonSheet } from '../PersonSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { BlockLesson } from '../../../../types/calendarTypes';

const taughtLesson: BlockLesson = {
    id: 'ev1',
    date: '20260401',
    startTime: '10:00',
    endTime: '11:50',
    courseName: 'Algoritmizace',
    courseCode: 'ALG',
    courseId: '159410',
    room: 'Q01 (Poříčí)',
    roomStructured: { name: 'Q01', id: 'Q01' },
    teachers: [{ fullName: 'Jan Novák', shortName: 'Novák', id: '42' }],
    periodId: '1',
    studyId: '1',
    campus: 'Poříčí',
    isDefaultCampus: 'true',
    facultyCode: 'PEF',
    isSeminar: 'false',
    isConsultation: 'false',
    isExam: false,
};

describe('PersonSheet', () => {
    const setMobileTab = vi.fn();
    const focusRoomByCode = vi.fn();

    beforeEach(() => {
        setMobileTab.mockClear();
        focusRoomByCode.mockClear();
        useAppStore.setState({
            language: 'cz',
            schedule: { data: [taughtLesson], status: 'success', weekStart: null },
            personProfiles: {
                42: {
                    data: {
                        personId: 42,
                        name: 'Jan Novák',
                        universityEmail: 'novak@mendelu.cz',
                        privateEmail: null,
                        programmeCode: null,
                        programmeName: null,
                        studyTypeSentence: 'Vyučující',
                        yearSemesterSentence: null,
                    },
                    fetchedAt: Date.now(),
                },
            },
            personProfilesLoading: {},
            setMobileTab,
            focusRoomByCode,
        } as never);
    });

    it('shows the person name and email', () => {
        render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
        expect(screen.getByText('Jan Novák')).toBeInTheDocument();
        expect(screen.getByText('novak@mendelu.cz')).toBeInTheDocument();
    });

    it('shows a mailto link for the email', () => {
        render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
        expect(screen.getByText('Napsat e-mail').closest('a')).toHaveAttribute('href', 'mailto:novak@mendelu.cz');
    });

    it('deep-links to the map at their taught lesson\'s room and closes the stack', () => {
        render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);

        fireEvent.click(screen.getByText('Ukázat kancelář na mapě'));

        expect(setMobileTab).toHaveBeenCalledWith('map');
        expect(focusRoomByCode).toHaveBeenCalledWith('Q01');
    });

    it('does not show the map button when no room can be resolved', () => {
        useAppStore.setState({ schedule: { data: [], status: 'success', weekStart: null } } as never);
        render(<PersonSheet sheet={{ kind: 'person', personId: '42' }} onClose={vi.fn()} />);
        expect(screen.queryByText('Ukázat kancelář na mapě')).not.toBeInTheDocument();
    });
});
