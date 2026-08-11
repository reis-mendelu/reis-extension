import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MobileAdminConsole } from '../MobileAdminConsole';

// Leaflet needs a laid-out DOM jsdom does not provide. These assertions are
// about which surface is mounted, not about tiles, so stub the pane and mark it.
vi.mock('../AdminConsoleMap', () => ({
  AdminConsoleMap: () => <div data-testid="console-map" />,
}));

beforeEach(() => {
  useAppStore.setState({
    language: 'cz',
    adminConsoleOpen: true,
    adminRole: 'association',
    adminAssociationId: 'supef',
    adminActiveAssociationId: 'supef',
    societyMapEvents: [],
    composerOpen: false,
    editEventId: null,
    placingEvent: false,
    draftCoord: null,
  });
});

describe('MobileAdminConsole', () => {
  it('starts on the list, with the map one tap away', () => {
    render(<MobileAdminConsole />);
    expect(screen.getByRole('button', { name: 'Vytvořit akci' })).toBeInTheDocument();
    expect(screen.queryByTestId('console-map')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByTestId('console-map')).toBeInTheDocument();
  });

  it('shows the map automatically while placing a pin, and hides the toggle', () => {
    useAppStore.setState({ placingEvent: true });
    render(<MobileAdminConsole />);
    expect(screen.getByTestId('console-map')).toBeInTheDocument();
    // The placing flow has its own banner and Cancel; a second way out is
    // ambiguous, so the list/map toggle is suppressed.
    expect(screen.queryByRole('tab', { name: 'Mapa' })).toBeNull();
  });

  // The bug this guards: EventComposer keeps the entire form in local useState.
  // Swapping the list out for the map unmounted it, so tapping "pick on the map"
  // silently wiped everything typed and returned an empty form.
  it('keeps the composer mounted (and its typed input) while the map is shown', () => {
    useAppStore.setState({ composerOpen: true, closeComposer: vi.fn() });
    render(<MobileAdminConsole />);

    const title = screen.getByPlaceholderText('Název akce') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Spring Party' } });
    expect(title.value).toBe('Spring Party');

    // Go to the map — via the placing flow, which is exactly how the composer
    // asks for an off-campus coordinate. act() so the store change is flushed
    // to the tree before the assertion reads it.
    act(() => useAppStore.setState({ placingEvent: true }));
    expect(screen.getByTestId('console-map')).toBeInTheDocument();

    // …and come back. The field must still hold what was typed.
    act(() => useAppStore.setState({ placingEvent: false }));
    expect((screen.getByPlaceholderText('Název akce') as HTMLInputElement).value).toBe(
      'Spring Party'
    );
  });
});
