import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErasmusSheet } from '../ErasmusSheet';
import { useAppStore } from '../../../../store/useAppStore';

// ErasmusPanel is a heavy desktop component with its own network-backed hooks
// (useErasmus, useStudyPlan, kontrola fetch); it isn't redesigned here (see
// task brief) and isn't the sheet's own responsibility to test. Mocking it
// keeps this test focused on ErasmusSheet's own job: the `full` Sheet shell,
// the header, and wiring `onOpenSubject` to the mobile subjectDrawer sheet.
vi.mock('../../../ErasmusPanel', () => ({
    ErasmusPanel: ({ onOpenSubject }: { onOpenSubject: (code: string, name?: string, id?: string) => void }) => (
        <button onClick={() => onOpenSubject('ALG', 'Algoritmizace', '159410')}>open-subject</button>
    ),
}));

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('ErasmusSheet', () => {
    it('hosts ErasmusPanel inside a full sheet', () => {
        useAppStore.setState({ language: 'cz', mobileSheets: [] } as never);
        render(<ErasmusSheet onClose={vi.fn()} />);
        expect(screen.getByText('open-subject')).toBeInTheDocument();
    });

    it('pushes the subjectDrawer sheet when ErasmusPanel opens a subject', () => {
        useAppStore.setState({ language: 'cz', mobileSheets: [] } as never);
        render(<ErasmusSheet onClose={vi.fn()} />);

        fireEvent.click(screen.getByText('open-subject'));

        expect(useAppStore.getState().mobileSheets).toEqual([
            { kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace', courseId: '159410' },
        ]);
    });

    it('closes via the header close button', () => {
        useAppStore.setState({ language: 'cz', mobileSheets: [] } as never);
        const onClose = vi.fn();
        render(<ErasmusSheet onClose={onClose} />);
        fireEvent.click(screen.getByLabelText('Zavřít'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
