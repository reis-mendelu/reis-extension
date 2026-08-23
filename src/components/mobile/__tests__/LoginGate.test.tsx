import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginGate } from '../LoginGate';
import { useAppStore } from '../../../store/useAppStore';

describe('LoginGate', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', demoMode: false });
  });

  it('offers sign-in and demo, and says the app is unofficial', () => {
    render(<LoginGate onSignIn={() => {}} onDemoStarted={() => {}} />);

    expect(screen.getByRole('button', { name: 'Přihlásit se' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prohlédnout ukázku' })).toBeInTheDocument();
    expect(screen.getByText(/Neoficiální studentská aplikace/)).toBeInTheDocument();
  });

  it('calls onSignIn when sign-in is tapped', () => {
    const onSignIn = vi.fn();
    render(<LoginGate onSignIn={onSignIn} onDemoStarted={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Přihlásit se' }));

    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it('enters demo mode when the demo is tapped', async () => {
    const enterDemo = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ enterDemo });
    render(<LoginGate onSignIn={() => {}} onDemoStarted={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Prohlédnout ukázku' }));

    expect(enterDemo).toHaveBeenCalledOnce();
    // Let the pending-state reset (added for the in-flight guard below) settle
    // inside act, instead of leaking into the next test as an unawaited update.
    await waitFor(() => expect(enterDemo).toHaveBeenCalledOnce());
  });

  it('ignores a second tap while enterDemo is still in flight', async () => {
    let resolveDemo: () => void = () => {};
    const enterDemo = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDemo = resolve;
        })
    );
    useAppStore.setState({ enterDemo });
    render(<LoginGate onSignIn={() => {}} onDemoStarted={() => {}} />);

    const demoButton = screen.getByRole('button', { name: 'Prohlédnout ukázku' });
    fireEvent.click(demoButton);
    fireEvent.click(demoButton);
    fireEvent.click(demoButton);

    expect(enterDemo).toHaveBeenCalledOnce();
    expect(demoButton).toBeDisabled();

    resolveDemo();
    await waitFor(() => expect(demoButton).not.toBeDisabled());
  });

  it('re-enables the demo button so the student can retry after enterDemo rejects', async () => {
    let rejectDemo: (err: Error) => void = () => {};
    const enterDemo = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectDemo = reject;
        })
    );
    useAppStore.setState({ enterDemo });
    render(<LoginGate onSignIn={() => {}} onDemoStarted={() => {}} />);

    const demoButton = screen.getByRole('button', { name: 'Prohlédnout ukázku' });
    fireEvent.click(demoButton);

    expect(demoButton).toBeDisabled();

    rejectDemo(new Error('IDB wipe failed'));
    await waitFor(() => expect(demoButton).not.toBeDisabled());

    fireEvent.click(demoButton);
    expect(enterDemo).toHaveBeenCalledTimes(2);
  });

  it('starts the app once demo data is seeded', async () => {
    const onDemoStarted = vi.fn();
    useAppStore.setState({ enterDemo: vi.fn().mockResolvedValue(undefined) });
    render(<LoginGate onSignIn={() => {}} onDemoStarted={onDemoStarted} />);

    fireEvent.click(screen.getByRole('button', { name: 'Prohlédnout ukázku' }));
    await vi.waitFor(() => expect(onDemoStarted).toHaveBeenCalledOnce());
  });
});
