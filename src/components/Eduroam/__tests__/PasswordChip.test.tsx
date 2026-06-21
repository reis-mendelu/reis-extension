import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { PasswordChip } from '../PasswordChip';

afterEach(cleanup);

describe('PasswordChip', () => {
  it('renders the password and an optional label', () => {
    render(<PasswordChip password="9fK2-pQ7m" label="Your password" />);
    expect(screen.getByText('9fK2-pQ7m')).toBeTruthy();
    expect(screen.getByText('Your password')).toBeTruthy();
  });

  it('copies the password to the clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<PasswordChip password="abc123" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('abc123'));
    vi.unstubAllGlobals();
  });
});
