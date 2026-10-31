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

  it('says in plain words what it notifies about', () => {
    useAppStore.setState({ backgroundCheck: 'on' } as never);
    render(<BackgroundCheckRow />);
    expect(screen.getByText('Oznámení')).toBeInTheDocument();
    expect(screen.getByText(/Nové body, odevzdávárny a termíny zkoušek/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Oznámení' })).toBeChecked();
  });

  it('turning it off tells the phone and follows', async () => {
    useAppStore.setState({ backgroundCheck: 'on' } as never);
    render(<BackgroundCheckRow />);
    fireEvent.click(screen.getByRole('switch', { name: 'Oznámení' }));
    await waitFor(() => expect(useAppStore.getState().backgroundCheck).toBe('off'));
    expect(native.setBackgroundCheckEnabled).toHaveBeenCalledWith(false);
  });

  it('stays as it was when the phone refuses', async () => {
    native.setBackgroundCheckEnabled.mockRejectedValueOnce(new Error('nope'));
    useAppStore.setState({ backgroundCheck: 'off' } as never);
    render(<BackgroundCheckRow />);
    fireEvent.click(screen.getByRole('switch', { name: 'Oznámení' }));
    await waitFor(() => expect(native.setBackgroundCheckEnabled).toHaveBeenCalledWith(true));
    expect(useAppStore.getState().backgroundCheck).toBe('off');
  });

  it('ignores a second tap until the phone has answered the first', async () => {
    let release: () => void = () => {};
    native.setBackgroundCheckEnabled.mockReturnValueOnce(new Promise<void>((r) => (release = r)));
    useAppStore.setState({ backgroundCheck: 'on' } as never);
    render(<BackgroundCheckRow />);
    const toggle = screen.getByRole('switch', { name: 'Oznámení' });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeDisabled());
    fireEvent.click(toggle);
    expect(native.setBackgroundCheckEnabled).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(useAppStore.getState().backgroundCheck).toBe('off'));
    expect(toggle).not.toBeDisabled();
  });
});
