import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginGate } from '../LoginGate';
import { useAppStore } from '../../../store/useAppStore';

describe('LoginGate', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', demoMode: false });
  });

  it('offers sign-in and demo, and says the app is unofficial', () => {
    render(<LoginGate onSignIn={() => {}} />);

    expect(screen.getByRole('button', { name: 'Přihlásit se' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prohlédnout ukázku' })).toBeInTheDocument();
    expect(screen.getByText(/Neoficiální studentská aplikace/)).toBeInTheDocument();
  });

  it('calls onSignIn when sign-in is tapped', () => {
    const onSignIn = vi.fn();
    render(<LoginGate onSignIn={onSignIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Přihlásit se' }));

    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it('enters demo mode when the demo is tapped', async () => {
    const enterDemo = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ enterDemo });
    render(<LoginGate onSignIn={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Prohlédnout ukázku' }));

    expect(enterDemo).toHaveBeenCalledOnce();
  });
});
