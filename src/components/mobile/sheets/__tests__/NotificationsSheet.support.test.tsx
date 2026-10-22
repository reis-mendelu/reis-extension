import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import cs from '../../../../i18n/locales/cs.json';
import { NotificationsSheet } from '../NotificationsSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { SpolekNotification } from '../../../../services/spolky';

const trackFeatureSignal = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../../../api/featureUsage', () => ({ trackFeatureSignal }));
vi.mock('../../../../services/storage/IndexedDBService', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(async () => {}) },
}));

const support = cs.support;

const notification = {
  id: 'n1',
  associationId: 'admin',
  title: 'ESN party tonight',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
} as SpolekNotification;

function feed(data: SpolekNotification[]) {
  return {
    data,
    status: 'success',
    readIds: new Set<string>(),
    viewedIds: new Set<string>(),
    seenDeadlineAlertIds: new Set<string>(),
  };
}

/**
 * The phone's (and iPad's) Novinky asks "would you support reIS?" as a row
 * the student answers, instead of a line in Profil (2026-10-22).
 */
describe('NotificationsSheet: the support question', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      notifications: feed([notification]),
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

  // First, so it is on screen without scrolling however long the feed is.
  it('asks it above everything else in the feed', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    const question = screen.getByText(support.question);
    const party = screen.getByText('ESN party tonight');
    expect(question.compareDocumentPosition(party) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Opening Novinky clears the badge, as it does for every other row; the
  // row itself stays until it is answered.
  it('clears its badge on open but keeps the row', async () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    await waitFor(() => expect(useAppStore.getState().supportQuestion.badgeSeen).toBe(true));
    expect(screen.getByText(support.question)).toBeInTheDocument();
  });

  it('thanks on "Ano" and is gone the next time Novinky opens', async () => {
    const first = render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: support.yes }));

    await waitFor(() => expect(useAppStore.getState().supportQuestion.status).toBe('yes'));
    expect(screen.getByText(support.thanks)).toBeInTheDocument();
    expect(trackFeatureSignal).toHaveBeenCalledWith('support_prompt_yes');

    first.unmount();
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.queryByText(support.thanks)).toBeNull();
    expect(screen.queryByText(support.question)).toBeNull();
  });

  it('goes away on "Ne" and sends nothing', async () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: support.no }));

    await waitFor(() => expect(screen.queryByText(support.question)).toBeNull());
    expect(useAppStore.getState().supportQuestion.status).toBe('dismissed');
    expect(trackFeatureSignal).not.toHaveBeenCalled();
  });

  it.each(['loading', 'yes', 'dismissed'] as const)('is not asked when %s', (status) => {
    useAppStore.setState({ supportQuestion: { status, badgeSeen: true } } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.queryByText(support.question)).toBeNull();
  });

  // A live question under "Žádné nové novinky" would contradict itself.
  it('is content: a feed holding only the question is not empty', () => {
    useAppStore.setState({ notifications: feed([]) } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.getByText(support.question)).toBeInTheDocument();
    expect(screen.queryByText(cs.notifications.empty)).toBeNull();
  });
});
