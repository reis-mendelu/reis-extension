import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const perm = vi.hoisted(() => ({ enableNotifications: vi.fn() }));
vi.mock('../../../../../mobile/notificationPermission', () => perm);

import { SystemNotificationsRow } from '../SystemNotificationsRow';
import { NotificationsOffBanner } from '../../../sheets/NotificationsOffBanner';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * A student's Android phone had reIS notifications switched off and nothing in
 * reIS said so. The row in Nastavení and the banner in the bell say it, and
 * offer the one button that fixes it.
 */
describe('system notifications row and banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ language: 'cz', systemNotifications: 'unknown' } as never);
  });

  it('the row shows nothing before the system has answered', () => {
    const { container } = render(<SystemNotificationsRow />);
    expect(container).toBeEmptyDOMElement();
  });

  it('the row says On, with no button, when granted', () => {
    useAppStore.setState({ systemNotifications: 'granted' } as never);
    render(<SystemNotificationsRow />);
    expect(screen.getByText('Oznámení v telefonu')).toBeInTheDocument();
    expect(screen.getByText('Zapnutá')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zapnout' })).toBeNull();
  });

  it.each(['denied', 'prompt'] as const)('the row offers Zapnout when %s', (status) => {
    useAppStore.setState({ systemNotifications: status } as never);
    render(<SystemNotificationsRow />);
    expect(screen.getByText('Vypnutá')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zapnout' }));
    expect(perm.enableNotifications).toHaveBeenCalledTimes(1);
  });

  it.each(['unknown', 'granted'] as const)('the banner is absent when %s', (status) => {
    useAppStore.setState({ systemNotifications: status } as never);
    const { container } = render(<NotificationsOffBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['denied', 'prompt'] as const)(
    'the banner explains and offers Zapnout when %s',
    (status) => {
      useAppStore.setState({ systemNotifications: status } as never);
      render(<NotificationsOffBanner />);
      expect(screen.getByText(/Oznámení jsou vypnutá/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Zapnout' }));
      expect(perm.enableNotifications).toHaveBeenCalledTimes(1);
    }
  );

  it('speaks English', () => {
    useAppStore.setState({ language: 'en', systemNotifications: 'denied' } as never);
    render(<SystemNotificationsRow />);
    expect(screen.getByText('Phone notifications')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument();
  });
});
