import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailPanel } from '../DetailPanel';
import { useAppStore } from '../../../store/useAppStore';

beforeEach(() => useAppStore.setState({ mapSelection: null }));

describe('DetailPanel', () => {
  it('renders a POI with a "no floor plan" note', () => {
    useAppStore.setState({
      mapSelection: {
        kind: 'poi',
        poi: { id: 1, name: 'FRRMS', type: 'building', url: 'http://x', phone: null, email: null },
        coord: [16.6, 49.2],
      },
    });
    render(<DetailPanel />);
    expect(screen.getByText('FRRMS')).toBeInTheDocument();
    expect(screen.getByText(/no floor plan|Žádný plán/i)).toBeInTheDocument();
  });

  // Shown for a timetable room with no floor plan: the room is the heading, the
  // building a single-letter pin names ("T") is spelled out under it.
  it('names the room it was shown for, over the building', () => {
    useAppStore.setState({
      language: 'cz',
      mapSelection: {
        kind: 'poi',
        poi: { id: 1572, name: 'T', type: 'building', url: null, phone: null, email: null },
        coord: [16.6, 49.2],
        forRoom: 'T18',
      },
    });
    render(<DetailPanel />);
    expect(screen.getByRole('heading', { name: 'T18' })).toBeInTheDocument();
    expect(screen.getByText('Budova T')).toBeInTheDocument();
    expect(screen.getByText(/Žádný plán/)).toBeInTheDocument();
  });

  it('keeps a full place name as it is', () => {
    useAppStore.setState({
      language: 'cz',
      mapSelection: {
        kind: 'poi',
        poi: {
          id: -102,
          name: 'Zahradnická fakulta – Lednice',
          type: 'Valtická 337, Lednice',
          url: null,
          phone: null,
          email: null,
        },
        coord: [16.8, 48.8],
        forRoom: 'ZFAC1',
      },
    });
    render(<DetailPanel />);
    expect(screen.getByRole('heading', { name: 'ZFAC1' })).toBeInTheDocument();
    expect(screen.getByText('Zahradnická fakulta – Lednice')).toBeInTheDocument();
  });
});
