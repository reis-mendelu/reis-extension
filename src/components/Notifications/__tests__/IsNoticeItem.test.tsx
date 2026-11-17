import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationRow } from '../NotificationRow';
import { useAppStore } from '../../../store/useAppStore';
import type { SpolekNotification } from '../../../services/spolky/types';

vi.stubGlobal(
  'IntersectionObserver',
  vi.fn(function (this: Record<string, unknown>) {
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  })
);

const isRow: SpolekNotification = {
  id: 'is:zasadka:157890',
  associationId: 'mendelu',
  title: 'Nový design UIS',
  body: 'Vážení uživatelé,\nv průběhu listopadu bude nasazena nová podoba designu.',
  link: 'https://test.is.mendelu.cz',
  createdAt: '2026-11-09T09:00',
  expiresAt: '2026-11-30',
  priority: 'normal',
  source: 'is',
};

beforeEach(() => useAppStore.setState({ language: 'cz' } as never));

describe('an IS notice in Novinky', () => {
  it('shows its text on tap, and opens nothing yet', () => {
    const onOpen = vi.fn();
    render(<NotificationRow notification={isRow} onOpen={onOpen} clickable />);
    const row = screen.getByRole('button', { name: /Nový design UIS/ });
    expect(screen.queryByText(/nová podoba designu/)).toBeNull();
    expect(row).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/nová podoba designu/)).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens the link only from the button under the text', () => {
    const onOpen = vi.fn();
    render(<NotificationRow notification={isRow} onOpen={onOpen} clickable />);
    fireEvent.click(screen.getByRole('button', { name: /Nový design UIS/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Otevřít odkaz' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('names the button after IS when the link goes to IS', () => {
    render(
      <NotificationRow
        notification={{ ...isRow, link: 'https://is.mendelu.cz/auth/kontrola/?lang=cz' }}
        onOpen={vi.fn()}
        clickable
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Nový design UIS/ }));
    expect(screen.getByRole('button', { name: 'Otevřít v IS' })).toBeInTheDocument();
  });

  it('collapses again on a second tap', () => {
    render(<NotificationRow notification={isRow} onOpen={vi.fn()} clickable />);
    const row = screen.getByRole('button', { name: /Nový design UIS/ });
    fireEvent.click(row);
    fireEvent.click(row);
    expect(screen.queryByText(/nová podoba designu/)).toBeNull();
  });

  it('leaves a society row as it was: the tap opens it', () => {
    const onOpen = vi.fn();
    render(
      <NotificationRow
        notification={{ ...isRow, id: 'e1', associationId: 'esn', source: undefined }}
        onOpen={onOpen}
        clickable
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Nový design UIS/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/nová podoba designu/)).toBeNull();
  });
});
