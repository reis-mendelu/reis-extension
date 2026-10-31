import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const native = vi.hoisted(() => ({ setBackgroundCheckEnabled: vi.fn(async () => {}) }));
vi.mock('../../../../../mobile/backgroundCheckNative', () => native);

import { BackgroundCheckRow } from '../BackgroundCheckRow';
import { useAppStore } from '../../../../../store/useAppStore';

/** The one switch for the phone's background look into IS. */
describe('background check row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ language: 'cz', backgroundCheck: 'unknown' } as never);
  });

  it('shows nothing where there is no background check (iPhone, unread state)', () => {
    const { container } = render(<BackgroundCheckRow />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says what it does, including that it uses the IS sign-in', () => {
    useAppStore.setState({ backgroundCheck: 'on' } as never);
    render(<BackgroundCheckRow />);
    expect(screen.getByText('Kontrola na pozadí')).toBeInTheDocument();
    expect(screen.getByText(/Používá k tomu tvé přihlášení do ISu/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Kontrola na pozadí' })).toBeChecked();
  });

  it('turning it off tells the phone and follows', async () => {
    useAppStore.setState({ backgroundCheck: 'on' } as never);
    render(<BackgroundCheckRow />);
    fireEvent.click(screen.getByRole('switch', { name: 'Kontrola na pozadí' }));
    await waitFor(() => expect(useAppStore.getState().backgroundCheck).toBe('off'));
    expect(native.setBackgroundCheckEnabled).toHaveBeenCalledWith(false);
  });

  it('stays as it was when the phone refuses', async () => {
    native.setBackgroundCheckEnabled.mockRejectedValueOnce(new Error('nope'));
    useAppStore.setState({ backgroundCheck: 'off' } as never);
    render(<BackgroundCheckRow />);
    fireEvent.click(screen.getByRole('switch', { name: 'Kontrola na pozadí' }));
    await waitFor(() => expect(native.setBackgroundCheckEnabled).toHaveBeenCalledWith(true));
    expect(useAppStore.getState().backgroundCheck).toBe('off');
  });
});
