import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationsSheet } from '../NotificationsSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { SpolekNotification } from '../../../../services/spolky';

// 'admin' notifications bypass the spolky-subscription filter (always shown),
// keeping this test independent of useSpolkySettings' async IDB-backed state.
const notification: SpolekNotification = {
    id: 'n1',
    associationId: 'admin',
    title: 'ESN party tonight',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    link: 'https://example.com/party',
} as SpolekNotification;

describe('NotificationsSheet', () => {
    beforeEach(() => {
        useAppStore.setState({
            language: 'cz',
            notifications: { data: [notification], status: 'success', readIds: new Set(), viewedIds: new Set(), seenDeadlineAlertIds: new Set() },
            exams: { data: [] },
            odevzdavarny: [],
            cvicneTests: [],
            now: new Date(),
        } as never);
    });

    it('shows the title and a notification from the feed', () => {
        render(<NotificationsSheet onClose={vi.fn()} />);
        expect(screen.getByText('Novinky')).toBeInTheDocument();
        expect(screen.getByText('ESN party tonight')).toBeInTheDocument();
    });

    it('shows the empty state when there is nothing to show', () => {
        useAppStore.setState({
            notifications: { data: [], status: 'success', readIds: new Set(), viewedIds: new Set(), seenDeadlineAlertIds: new Set() },
        } as never);
        render(<NotificationsSheet onClose={vi.fn()} />);
        expect(screen.getByText('Žádné nové novinky')).toBeInTheDocument();
    });

    it('closes via the header close button', () => {
        const onClose = vi.fn();
        render(<NotificationsSheet onClose={onClose} />);
        fireEvent.click(screen.getByLabelText('Zavřít'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
