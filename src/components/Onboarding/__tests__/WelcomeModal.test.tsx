import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('../../../services/storage', () => ({
    IndexedDBService: { get: vi.fn().mockResolvedValue(undefined), set: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (k: string) => k, language: 'cz' }),
}));
vi.mock('../../../store/useAppStore', () => ({
    useAppStore: (sel: (s: { setLanguage: () => void }) => unknown) => sel({ setLanguage: vi.fn() }),
}));

import { WelcomeModal } from '../WelcomeModal';

describe('WelcomeModal', () => {
    beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });

    it('shows welcome + language only, with no Outlook or Drive ask', async () => {
        render(<WelcomeModal />);
        await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(900); });
        expect(screen.getByText('onboarding.welcome')).toBeInTheDocument();
        expect(screen.getByText('onboarding.getStarted')).toBeInTheDocument();
        expect(screen.queryByText('onboarding.syncTitle')).not.toBeInTheDocument();
        expect(screen.queryByText('onboarding.driveTitle')).not.toBeInTheDocument();
        vi.useRealTimers();
    });

    it('has no step-2 commitment-ask machinery', async () => {
        render(<WelcomeModal />);
        await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(900); });
        expect(screen.queryByText('onboarding.syncToggle')).not.toBeInTheDocument();
        expect(screen.queryByText('drive.connect')).not.toBeInTheDocument();
        vi.useRealTimers();
    });
});
