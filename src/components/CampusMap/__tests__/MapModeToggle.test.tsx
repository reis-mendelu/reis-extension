import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MapModeToggle } from '../MapModeToggle';

describe('MapModeToggle', () => {
  beforeEach(() => {
    useAppStore.setState({ adminRole: null, adminAssociationId: null, mapMode: 'student', language: 'en' });
  });

  it('renders nothing when no association is logged in', () => {
    const { container } = render(<MapModeToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it('switches to society mode on click when logged in', () => {
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef' });
    render(<MapModeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /society/i }));
    expect(useAppStore.getState().mapMode).toBe('society');
  });
});
