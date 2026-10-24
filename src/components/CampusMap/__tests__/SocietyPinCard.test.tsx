import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SocietyPinCard } from '../SocietyPinCard';
import { MapPanelBody } from '../../mobile/screens/map/MapPanelBody';
import { useAppStore } from '../../../store/useAppStore';
import type { SocietyPin } from '../../../types/campusMap';

const pin: SocietyPin = {
  id: 'p1',
  societyId: 'vazbic',
  title: 'Vazbič na kampusu',
  description: 'Spolek, který váže knihy.',
  url: 'https://vazbic.example',
  coord: [16.6142, 49.2098],
};

afterEach(cleanup);

describe('SocietyPinCard', () => {
  it('shows the title, the description and "Více informací" to the website', () => {
    useAppStore.setState({ language: 'cz' } as never);
    render(<SocietyPinCard pin={pin} />);
    expect(screen.getByText('Vazbič na kampusu')).toBeTruthy();
    expect(screen.getByText('Spolek, který váže knihy.')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Více informací/ });
    expect(link.getAttribute('href')).toBe('https://vazbic.example');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('has no link button when the pin has no link', () => {
    render(<SocietyPinCard pin={{ ...pin, url: null }} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  // The phone's sheet and the iPad's rail share MapPanelBody: a tapped pin
  // must open its card there, not leave the events list in place.
  it('is what the phone and iPad panel shows for a tapped pin', () => {
    render(<MapPanelBody selectedEvent={null} selectedSocietyPin={pin} />);
    expect(screen.getByTestId('society-pin-card')).toBeTruthy();
  });
});
