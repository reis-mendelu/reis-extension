import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { NotificationsSheet } from '../../mobile/sheets/NotificationsSheet';
import { NotificationFeed } from '../../NotificationFeed';
import { HeaderActions } from '../../mobile/screens/HeaderActions';
import { useAppStore } from '../../../store/useAppStore';
import type { Question } from '../../../types/questions';

const { countQuestion, fetchQuestions } = vi.hoisted(() => ({
  countQuestion: vi.fn(async () => true),
  fetchQuestions: vi.fn(async () => null),
}));
vi.mock('../../../api/questions', () => ({ countQuestion, fetchQuestions }));
vi.mock('../../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn(async () => {}) }));
vi.mock('../../../services/storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => {}),
    setMany: vi.fn(async () => {}),
  },
}));
vi.mock('../../../services/spolky', () => ({
  fetchNotifications: vi.fn(async () => []),
  trackNotificationsViewed: vi.fn(),
  trackNotificationClick: vi.fn(),
}));

const scale: Question = {
  id: 'sat',
  promptCz: 'Jak jsi spokojený/á s reIS?',
  promptEn: 'How happy are you with reIS?',
  noteCz: '1 = vůbec, 5 = moc',
  noteEn: '1 = not at all, 5 = very',
  buttons: ['1', '2', '3', '4', '5'].map((k) => ({ key: k, cz: k, en: k })),
  startsAt: new Date(Date.now() - 3_600_000).toISOString(),
  endsAt: new Date(Date.now() + 86_400_000).toISOString(),
  faculties: null,
};

function state(over: Partial<{ allowed: boolean; list: Question[] }> = {}) {
  useAppStore.setState({
    language: 'cz',
    notifications: {
      data: [],
      status: 'success',
      readIds: new Set<string>(),
      viewedIds: new Set<string>(),
      seenDeadlineAlertIds: new Set<string>(),
    },
    questions: {
      status: 'ready',
      list: [scale],
      answers: {},
      badgeSeen: [],
      allowed: true,
      ...over,
    },
    exams: { data: [] },
    odevzdavarny: [],
    cvicneTests: [],
    now: new Date(),
  } as never);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('a console question on the phone and iPad (NotificationsSheet)', () => {
  beforeEach(() => state());

  it('is asked, and a tap thanks with the answer and stays', async () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    await waitFor(() => expect(useAppStore.getState().questions.answers).toEqual({ sat: '4' }));
    expect(countQuestion).toHaveBeenCalledWith('sat', '4');
    expect(screen.getByRole('status')).toHaveTextContent('4');
    expect(screen.getByText(scale.promptCz)).toBeInTheDocument();
  });

  it('clears its badge once Novinky shows it', async () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    await waitFor(() => expect(useAppStore.getState().questions.badgeSeen).toEqual(['sat']));
  });

  // Firefox with technical data off: not asked at all.
  it('is not asked without consent', () => {
    state({ allowed: false });
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.queryByText(scale.promptCz)).toBeNull();
  });
});

describe('a console question in the extension (NotificationFeed)', () => {
  beforeEach(() => state());
  const bell = () => screen.getByRole('button', { name: 'Notifications' });

  it('counts on the bell until the dropdown is opened, and is asked there', async () => {
    render(<NotificationFeed onShowMap={vi.fn()} />);
    expect(bell()).toHaveTextContent('1');
    fireEvent.click(bell());
    expect(screen.getByText(scale.promptCz)).toBeInTheDocument();
    await waitFor(() => expect(bell()).not.toHaveTextContent('1'));
  });

  // Review #587: a question published a moment ago shows on the next open.
  it('fetches questions again when the bell opens Novinky', async () => {
    render(<NotificationFeed onShowMap={vi.fn()} />);
    fireEvent.click(bell());
    await waitFor(() => expect(fetchQuestions).toHaveBeenCalled());
  });

  it('does not count an answered question', () => {
    state();
    useAppStore.setState({
      questions: { ...useAppStore.getState().questions, answers: { sat: '5' } },
    } as never);
    render(<NotificationFeed onShowMap={vi.fn()} />);
    expect(bell()).not.toHaveTextContent('1');
  });
});

describe('the phone bell (HeaderActions)', () => {
  beforeEach(() => state());

  it('counts the question and fetches questions again when it opens Novinky', async () => {
    render(<HeaderActions />);
    const phoneBell = screen.getByRole('button', { name: 'Oznámení' });
    expect(phoneBell).toHaveTextContent('1');
    fireEvent.click(phoneBell);
    await waitFor(() => expect(fetchQuestions).toHaveBeenCalled());
  });
});
