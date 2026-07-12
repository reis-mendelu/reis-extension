import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposerPlaceSearch } from '../ComposerPlaceSearch';
import type { PlaceResult } from '../../../api/placeSearch';

vi.mock('../../../api/placeSearch', () => ({ searchPlaces: vi.fn() }));
import { searchPlaces } from '../../../api/placeSearch';

const t = (k: string) => k;
const RESULT: PlaceResult = {
  id: 'N42',
  name: 'Bar, který neexistuje',
  context: 'Brno, Dvořákova',
  coord: [16.6097, 49.1959],
};

describe('ComposerPlaceSearch', () => {
  beforeEach(() => {
    vi.mocked(searchPlaces).mockReset();
    vi.mocked(searchPlaces).mockResolvedValue([RESULT]);
  });

  it('searches as you type and returns {name, coord} on select', async () => {
    const onSelect = vi.fn();
    render(<ComposerPlaceSearch selected={null} onSelect={onSelect} onClear={() => {}} t={t} />);
    fireEvent.change(screen.getByPlaceholderText('map.searchPlace'), {
      target: { value: 'bar který neexistuje' },
    });
    // Debounced fetch → result row appears.
    const hit = await screen.findByText('Bar, který neexistuje');
    expect(searchPlaces).toHaveBeenCalledWith('bar který neexistuje');
    fireEvent.click(hit);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({
      name: 'Bar, který neexistuje',
      coord: [16.6097, 49.1959],
    });
  });

  it('does not search for a query shorter than 2 chars', async () => {
    render(<ComposerPlaceSearch selected={null} onSelect={() => {}} onClear={() => {}} t={t} />);
    fireEvent.change(screen.getByPlaceholderText('map.searchPlace'), { target: { value: 'a' } });
    // give any debounce a chance to (not) fire
    await new Promise((r) => setTimeout(r, 350));
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it('shows the selected place with a change button', () => {
    const onClear = vi.fn();
    render(
      <ComposerPlaceSearch
        selected={{ name: 'Lužánky' }}
        onSelect={() => {}}
        onClear={onClear}
        t={t}
      />
    );
    expect(screen.getByText('Lužánky')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'map.changePlace' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
