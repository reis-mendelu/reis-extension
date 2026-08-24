import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DemoBanner } from '../DemoBanner';
import { useAppStore } from '../../../store/useAppStore';

describe('DemoBanner', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz', demoMode: false }));

  it('renders nothing when demo mode is off', () => {
    const { container } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the demo label when demo mode is on', () => {
    useAppStore.setState({ demoMode: true });
    render(<DemoBanner />);
    expect(screen.getByText('Ukázka')).toBeInTheDocument();
  });

  it('leaves demo mode when sign-in is tapped', () => {
    const exitDemo = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ demoMode: true, exitDemo });
    render(<DemoBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'Přihlásit se' }));

    expect(exitDemo).toHaveBeenCalledOnce();
  });
});
