import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailPanel } from '../DetailPanel';
import { useAppStore } from '../../../store/useAppStore';

beforeEach(() => useAppStore.setState({ mapSelection: null }));

describe('DetailPanel', () => {
  it('renders a POI with a "no floor plan" note', () => {
    useAppStore.setState({ mapSelection: { kind: 'poi',
      poi: { id: 1, name: 'FRRMS', type: 'building', url: 'http://x', phone: null, email: null },
      coord: [16.6, 49.2] } });
    render(<DetailPanel />);
    expect(screen.getByText('FRRMS')).toBeInTheDocument();
    expect(screen.getByText(/no floor plan|Žádný plán/i)).toBeInTheDocument();
  });
});
