import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ln, openExams, openPoints } = vi.hoisted(() => ({
  ln: { addListener: vi.fn() },
  openExams: vi.fn(),
  openPoints: vi.fn(),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
vi.mock('../examReminders', () => ({ openExamsFromNotification: openExams }));
vi.mock('../zaznamnikNotifications', () => ({ openFromNotification: openPoints }));

import { installNotificationTaps } from '../notificationTaps';

/**
 * A tap that cold-starts the app is retained by Capacitor and handed only to
 * the FIRST listener registered for it, so one listener per feature lost the
 * other feature's taps. One listener hands every tap to every feature, and
 * each ignores the kinds that are not its own.
 */
describe('notification taps', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers exactly one tap listener', () => {
    installNotificationTaps();
    expect(ln.addListener).toHaveBeenCalledTimes(1);
    expect(ln.addListener.mock.calls[0]![0]).toBe('localNotificationActionPerformed');
  });

  it.each([
    [{ kind: 'exam-opening', key: 'k' }],
    [{ kind: 'zaznamnik-new-points', courseCode: 'EBC-PS' }],
  ])('hands %o to both features', (extra) => {
    installNotificationTaps();
    const handler = ln.addListener.mock.calls[0]![1];
    handler({ notification: { extra } });
    expect(openExams).toHaveBeenCalledWith(extra);
    expect(openPoints).toHaveBeenCalledWith(extra);
  });
});
