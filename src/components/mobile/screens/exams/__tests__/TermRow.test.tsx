import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { TermRow } from '../TermRow';
import { useWatchdog } from '../../../../../hooks/data/useWatchdog';
import { useAppStore } from '../../../../../store/useAppStore';
import type { ExamSection, ExamTerm } from '../../../../../types/exams';

vi.mock('../../../../../hooks/data/useWatchdog', () => ({
    useWatchdog: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

const mockedUseWatchdog = vi.mocked(useWatchdog);

const term: ExamTerm = {
    id: 't1',
    date: '20.5.2026',
    time: '10:00',
    watchdogUrl: 'https://is.mendelu.cz/watchdog?aktivace=1',
};

const section: ExamSection = {
    id: 's1',
    name: 'zkouška',
    type: 'exam',
    status: 'open',
    terms: [term],
};

function baseHookState() {
    return {
        armed: false,
        firing: false,
        feedback: null as 'activated' | 'deactivated' | 'failed' | null,
        errorMessage: null as string | null,
        toggle: vi.fn(),
    };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('TermRow', () => {
    beforeEach(() => {
        useAppStore.setState({ language: 'cz' } as never);
    });

    it('shows a success toast when the watchdog is activated', () => {
        mockedUseWatchdog.mockReturnValue({ ...baseHookState(), armed: true, feedback: 'activated' });
        render(<TermRow term={term} section={section} isProcessing={false} onRegister={vi.fn()} />);
        expect(toast.success).toHaveBeenCalledWith('Hlídač aktivován. IS pošle e-mail, až bude termín volný.');
    });

    it('shows an info toast when the watchdog is deactivated', () => {
        mockedUseWatchdog.mockReturnValue({ ...baseHookState(), armed: false, feedback: 'deactivated' });
        render(<TermRow term={term} section={section} isProcessing={false} onRegister={vi.fn()} />);
        expect(toast.info).toHaveBeenCalledWith('Hlídač deaktivován.');
    });

    it('shows an error toast with the specific message when the toggle fails, instead of silently reverting', () => {
        mockedUseWatchdog.mockReturnValue({
            ...baseHookState(),
            feedback: 'failed',
            errorMessage: 'Session expired',
        });
        render(<TermRow term={term} section={section} isProcessing={false} onRegister={vi.fn()} />);
        expect(toast.error).toHaveBeenCalledWith('Session expired');
    });

    it('falls back to the generic failure message when the toggle fails with no specific error', () => {
        mockedUseWatchdog.mockReturnValue({ ...baseHookState(), feedback: 'failed', errorMessage: null });
        render(<TermRow term={term} section={section} isProcessing={false} onRegister={vi.fn()} />);
        expect(toast.error).toHaveBeenCalledWith('Hlídače se nepodařilo aktivovat.');
    });

    it('does not toast when there is no feedback yet', () => {
        mockedUseWatchdog.mockReturnValue(baseHookState());
        render(<TermRow term={term} section={section} isProcessing={false} onRegister={vi.fn()} />);
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.info).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('still renders the watch toggle button', () => {
        mockedUseWatchdog.mockReturnValue(baseHookState());
        render(<TermRow term={term} section={section} isProcessing={false} onRegister={vi.fn()} />);
        expect(screen.getByTestId('watch-toggle')).toBeInTheDocument();
    });
});
