import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
      notifications: {
        data: [notification],
        status: 'success',
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
      },
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
      notifications: {
        data: [],
        status: 'success',
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
      },
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

  // The badge on the bell counts `notifications.data` minus `readIds`. On the
  // phone the bell calls `pushSheet`, never `useNotificationFeed().toggle()` —
  // which is the only thing that ever marked the feed read — so the dot
  // survived reading it and only a reinstall cleared it. Opening the surface IS
  // the read, so the surface owns it.
  it('marks the feed read once it is open, so the header badge clears', async () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    // Explicit timeout, above waitFor's 1000ms default. The sheet's mark-read
    // effect is gated on `settingsLoading` from useSpolkySettings, which
    // resolves off an IndexedDB read — fast locally, not always inside a second
    // on a loaded CI runner. This test failed intermittently on three separate
    // PRs for that reason alone (measured once at 1046ms), which costs a re-run
    // and, worse, teaches everyone that a red check might mean nothing. It
    // asserts that the feed gets marked read, not how quickly.
    await waitFor(() => expect(useAppStore.getState().notifications.readIds.has('n1')).toBe(true), {
      timeout: 5000,
    });
  });

  // Marking runs off the FILTERED feed, which is empty until useSpolkySettings
  // has read the subscriptions out of IndexedDB. Marking before that lands
  // marks nothing, and the badge would persist exactly as it did before —
  // a fix that passes with seeded state and fails on the device.
  it('also marks notifications that only arrive after it opened', async () => {
    useAppStore.setState({
      notifications: {
        data: [],
        status: 'success',
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
      },
    } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    useAppStore.setState({
      notifications: {
        ...useAppStore.getState().notifications,
        data: [notification],
      },
    } as never);
    // 8000, like the deadline-alert assertion below: marking the feed read is
    // an IndexedDB write behind an effect, and on a loaded CI runner it lands
    // just past waitFor's 1000ms default — this failed at 1046ms while passing
    // locally every time.
    await waitFor(() => expect(useAppStore.getState().notifications.readIds.has('n1')).toBe(true), {
      timeout: 8000,
    });
  });
});

describe('NotificationsSheet — deadline alerts', () => {
  function pad(n: number) {
    return String(n).padStart(2, '0');
  }
  const inHours = (h: number) => {
    const d = new Date(Date.now() + h * 3_600_000);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // The bell now counts deadlines as well as society news, because the
  // calendar's strip is gone and this sheet is the only place they appear. A
  // badge that cannot be cleared by opening the thing it points at is the same
  // bug as the one that started this: it just moved to the other half.
  it('marks deadline alerts seen while it is open', async () => {
    useAppStore.setState({
      language: 'cz',
      notifications: {
        data: [],
        status: 'success',
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
      },
      exams: { data: [] },
      cvicneTests: [],
      now: new Date(),
      odevzdavarny: [
        {
          odevzdavarnaId: 'o1',
          courseId: 'ALG',
          courseNameCs: 'Algoritmizace',
          courseNameEn: 'Algorithms',
          name: 'Semestrální projekt',
          type: 'Odevzdávárna',
          deadline: inHours(5),
          fileCount: 0,
          uploadUrl: 'https://is.mendelu.cz/x',
        },
      ],
    } as never);

    render(<NotificationsSheet onClose={vi.fn()} />);
    await waitFor(
      () =>
        expect(useAppStore.getState().notifications.seenDeadlineAlertIds.has('odev-o1')).toBe(true),
      { timeout: 8000 }
    );
  }, 15000);
});
