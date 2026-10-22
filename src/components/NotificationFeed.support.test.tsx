import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import cs from '../i18n/locales/cs.json';
import { NotificationFeed } from './NotificationFeed';
import { useAppStore } from '../store/useAppStore';

vi.mock('../api/featureUsage', () => ({ trackFeatureSignal: vi.fn(async () => {}) }));
vi.mock('../services/storage/IndexedDBService', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(async () => {}) },
}));
vi.mock('../services/spolky', () => ({
  fetchNotifications: vi.fn(async () => []),
  trackNotificationsViewed: vi.fn(),
  trackNotificationClick: vi.fn(),
}));

const support = cs.support;

/**
 * The extension's bell: an unanswered support question counts in the badge
 * until Novinky is opened, and is asked at the top of the dropdown.
 */
describe('NotificationFeed: the support question', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      notifications: {
        data: [],
        status: 'success',
        readIds: new Set<string>(),
        viewedIds: new Set<string>(),
        seenDeadlineAlertIds: new Set<string>(),
      },
      supportQuestion: { status: 'open', badgeSeen: false },
      exams: { data: [] },
      odevzdavarny: [],
      cvicneTests: [],
      now: new Date(),
    } as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const bell = () => screen.getByRole('button', { name: 'Notifications' });

  it('counts an unseen question on the bell', () => {
    render(<NotificationFeed onShowMap={vi.fn()} />);
    expect(bell()).toHaveTextContent('1');
  });

  it('asks it in the dropdown, and opening clears the badge', async () => {
    render(<NotificationFeed onShowMap={vi.fn()} />);
    fireEvent.click(bell());

    expect(screen.getByText(support.question)).toBeInTheDocument();
    await waitFor(() => expect(bell()).not.toHaveTextContent('1'));
    expect(screen.getByText(support.question)).toBeInTheDocument();
  });

  it('does not count a question already answered', () => {
    useAppStore.setState({ supportQuestion: { status: 'dismissed', badgeSeen: false } } as never);
    render(<NotificationFeed onShowMap={vi.fn()} />);
    expect(bell()).not.toHaveTextContent('1');
  });
});
