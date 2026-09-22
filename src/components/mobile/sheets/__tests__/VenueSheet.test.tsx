import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VenueSheet } from '../VenueSheet';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The venue sheet offers the map apps and nothing else. It used to carry a
 * "Zapamatovat volbu" checkbox; ticked, it stored the choice and every later
 * tap skipped this sheet — the opposite of "always ask".
 */
describe('VenueSheet', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));

  it('offers Apple Mapy and Google Maps, and no way to stop being asked', () => {
    render(
      <VenueSheet
        sheet={{ kind: 'venue', coord: [16.59, 49.22], label: 'Q01', platform: 'ios' }}
        onClose={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /Apple/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Google/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
