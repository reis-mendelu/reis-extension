import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useAppStore } from '../../../store/useAppStore';
import { RouteDismiss } from '../RouteDismiss';

/**
 * The way back out of a drawn route.
 *
 * The × used to live on the route card, and the card was removed with every
 * sentence it said. The line it dismissed was not removed with it: once a walk
 * was drawn there was no control anywhere in the sheet that could take it off
 * the map — measured on the flow, three buttons in the sheet and none of them
 * this one — and tapping the map did nothing either. The route stayed until
 * the app was killed.
 */
describe('RouteDismiss', () => {
  beforeEach(() => {
    useAppStore.getState().clearRoute();
    useAppStore.setState({ language: 'cz' });
  });

  it('is not there when there is nothing to dismiss', () => {
    const { container } = render(<RouteDismiss />);
    expect(container.firstChild).toBeNull();
  });

  it('appears as soon as a walk is on the map, and takes it off again', () => {
    useAppStore.setState({
      routeStatus: 'ready',
      routeWalk: { coords: [], lengthM: 400, gates: [] },
    } as never);
    render(<RouteDismiss />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('idle');
    expect(s.routeWalk).toBeNull();
  });

  it('appears while the fix is still in flight, so a slow locate can be abandoned', () => {
    useAppStore.setState({ routeStatus: 'locating' } as never);
    render(<RouteDismiss />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('meets the 44px target the rest of this map holds itself to', () => {
    useAppStore.setState({ routeStatus: 'ready' } as never);
    render(<RouteDismiss />);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('min-h-11');
    expect(cls).toContain('min-w-11');
  });
});
