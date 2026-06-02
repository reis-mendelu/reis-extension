import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

vi.mock('../../../services/storage', () => ({
    IndexedDBService: {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockResolvedValue(undefined),
    },
}));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (k: string) => k, language: 'en' }) }));
const toggle = vi.fn();
vi.mock('../../../hooks/data/useOutlookSync', () => ({ useOutlookSync: () => ({ isEnabled: false, toggle, isLoading: false }) }));

import { IndexedDBService } from '../../../services/storage';
import { OutlookNudge } from '../OutlookNudge';

const idb = IndexedDBService as unknown as { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

describe('OutlookNudge', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the nudge when not previously dismissed', async () => {
        idb.get.mockResolvedValue(undefined);
        render(<OutlookNudge />);
        expect(await screen.findByText('calendar.outlookNudgeTitle')).toBeInTheDocument();
    });

    it('persists dismissal and hides on close', async () => {
        idb.get.mockResolvedValue(undefined);
        render(<OutlookNudge />);
        const close = await screen.findByLabelText('common.close');
        await act(async () => { fireEvent.click(close); });
        expect(idb.set).toHaveBeenCalledWith('meta', 'outlook_nudge_dismissed', true);
        await waitFor(() => expect(screen.queryByText('calendar.outlookNudgeTitle')).not.toBeInTheDocument());
    });

    it('does not render when already dismissed', async () => {
        idb.get.mockResolvedValue(true);
        render(<OutlookNudge />);
        await act(async () => { await Promise.resolve(); });
        expect(screen.queryByText('calendar.outlookNudgeTitle')).not.toBeInTheDocument();
    });
});
