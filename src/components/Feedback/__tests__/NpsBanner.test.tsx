import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NpsBanner } from '../NpsBanner';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

afterEach(() => {
    cleanup();
});

function setStoreState(overrides: Record<string, unknown> = {}) {
    useAppStore.setState({
        language: 'en',
        feedbackEligible: true,
        feedbackDismissed: false,
        submitNps: vi.fn().mockResolvedValue(undefined),
        dismissFeedback: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    });
}

describe('NpsBanner', () => {
    it('renders nothing when not eligible', () => {
        setStoreState({ feedbackEligible: false });
        const { container } = render(<NpsBanner />);
        expect(container.firstChild).toBeNull();
    });

    it('tapping rating 5 shows the share prompt, not category chips', () => {
        setStoreState();
        render(<NpsBanner />);
        fireEvent.click(screen.getByRole('button', { name: '5' }));
        expect(screen.getByText(/classmate/i)).toBeTruthy();
        expect(screen.queryByText("Doesn't work")).toBeNull();
        expect(useAppStore.getState().submitNps).not.toHaveBeenCalled();
    });

    it('tapping a rating of 1-3 shows category chips instead of submitting immediately', () => {
        setStoreState();
        render(<NpsBanner />);
        fireEvent.click(screen.getByRole('button', { name: '2' }));
        expect(useAppStore.getState().submitNps).not.toHaveBeenCalled();
        expect(screen.getByText("Doesn't work")).toBeTruthy();
        expect(screen.getByText('Confusing')).toBeTruthy();
    });

    it('tapping a category submits the rating together with the reason code', () => {
        setStoreState();
        render(<NpsBanner />);
        fireEvent.click(screen.getByRole('button', { name: '2' }));
        fireEvent.click(screen.getByText('Confusing'));
        expect(useAppStore.getState().submitNps).toHaveBeenCalledWith(2, 'confusing');
    });
});
