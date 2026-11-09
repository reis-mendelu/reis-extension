/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { NotificationFeed } from '../../components/NotificationFeed';
import { NotificationsSheet } from '../../components/mobile/sheets/NotificationsSheet';
import { useAppStore } from '../../store/useAppStore';
import { trackNotificationClick, trackNotificationsViewed } from '../../services/spolky';
import { openExternal } from '../../mobile/openExternal';
import type { IsNotice } from '../../types/isNotices';

/**
 * The notices on a student's own IS home page are shown in Novinky under
 * MENDELU (utils/isNoticeRows), on both trees. Some are for that student alone
 * ("Kontrola osobních údajů"), so what IS shows a student must never reach
 * Supabase. The society feed's view and click counters send a row id, and an
 * IS row's id names the notice: this pins that neither counter ever sees one,
 * on the extension's bell and on the phone's Novinky sheet.
 */
vi.mock('../../mobile/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('../../services/spolky', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/spolky')>()),
  fetchNotifications: vi.fn().mockResolvedValue([]),
  trackNotificationClick: vi.fn(),
  trackNotificationsViewed: vi.fn(),
}));
vi.mock('../../api/isNotices', () => ({ fetchIsNotices: vi.fn().mockResolvedValue([]) }));
vi.mock('../../api/isNoticeMutes', () => ({ fetchIsNoticeMutes: vi.fn().mockResolvedValue([]) }));
vi.stubGlobal(
  'IntersectionObserver',
  vi.fn(function (this: Record<string, unknown>) {
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  })
);

const KONTROLA: IsNotice = {
  key: 'link:/auth/kontrola/',
  title: 'Kontrola osobních údajů',
  text: 'Potvrďte správnost osobních údajů.',
  link: 'https://is.mendelu.cz/auth/kontrola/?lang=cz',
  severity: 'crit',
  from: null,
  until: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    language: 'cz',
    now: new Date(),
    isNotices: { cz: [KONTROLA], en: [] },
    isNoticeMutes: [],
    // Fresh, so the feed's refresh does not go to IS in a unit test.
    isNoticesFetchedAt: Date.now(),
    notifications: {
      data: [],
      readIds: new Set(),
      viewedIds: new Set(),
      seenDeadlineAlertIds: new Set(),
      status: 'success',
    },
    exams: { data: [] },
    odevzdavarny: [],
    cvicneTests: [],
    mapEvents: [],
    mapEventsLoaded: true,
  } as any);
});

describe('IS notices stay on the device', () => {
  it('extension: opens the notice link and counts nothing', async () => {
    render(<NotificationFeed onShowMap={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Notifications'));
    });
    await waitFor(() => expect(screen.getByText('Kontrola osobních údajů')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Kontrola osobních údajů'));
    });
    expect(openExternal).toHaveBeenCalledWith(KONTROLA.link);
    expect(trackNotificationClick).not.toHaveBeenCalled();
  });

  it('phone: shows the notice under MENDELU, opens it and counts nothing', async () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Kontrola osobních údajů'));
    });
    expect(openExternal).toHaveBeenCalledWith(KONTROLA.link);
    expect(trackNotificationClick).not.toHaveBeenCalled();
  });

  it('the view counter refuses an IS row id', async () => {
    await useAppStore.getState().markNotificationViewed('is:link:/auth/kontrola/');
    expect(trackNotificationsViewed).not.toHaveBeenCalled();
  });

  it('a muted notice is not shown', () => {
    useAppStore.setState({
      isNoticeMutes: [{ key: KONTROLA.key, title: KONTROLA.title }],
    } as any);
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.queryByText('Kontrola osobních údajů')).toBeNull();
  });
});
