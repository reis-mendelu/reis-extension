import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { RouteCard } from '../RouteCard';
import type { Walk } from '../../../utils/routing/shortestWalk';

const set = (patch: Record<string, unknown>) => useAppStore.setState(patch);
const walk = (lengthM: number, gates: string[] = []): Walk => ({
  coords: [
    [16.6, 49.21],
    [16.6, 49.211],
  ],
  lengthM,
  gates,
});

describe('RouteCard', () => {
  beforeEach(() => {
    useAppStore.getState().clearRoute();
    useAppStore.setState({ language: 'cz' });
  });

  it('shows nothing at all while idle', () => {
    const { container } = render(<RouteCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says it is looking while the fix is in flight', () => {
    set({ routeStatus: 'locating' });
    render(<RouteCard />);
    expect(screen.getByText(/Hledám/)).toBeTruthy();
  });

  it('shows the walk time and the destination when ready', () => {
    set({ routeStatus: 'ready', routeTargetBuilding: 'Q', routeWalk: walk(1326) });
    render(<RouteCard />);
    // 1326 m at 100 m/min.
    expect(screen.getByText(/13 min/)).toBeTruthy();
    // The building INTERPOLATED, not the placeholder. A loose /Q/ matched the
    // literal "do {Q}" and let a broken substitution ship — this codebase uses
    // single braces, and the first version of this key used double.
    expect(screen.getByText(/do Q$/)).toBeTruthy();
    expect(screen.queryByText(/\{/)).toBeNull();
  });

  it('explains a denied permission instead of failing silently', () => {
    set({ routeStatus: 'denied' });
    render(<RouteCard />);
    expect(screen.getByText(/polohu/i)).toBeTruthy();
  });

  it('says plainly when you are not near the campus', () => {
    set({ routeStatus: 'too-far' });
    render(<RouteCard />);
    expect(screen.getByText(/kampusu/)).toBeTruthy();
  });

  it('names the tram when the GATE is what is shut', () => {
    // The Saturday FRRMS case: the garden is the only way in, so there is no
    // walk right now. A bare "no route" would leave the student stuck.
    set({ routeStatus: 'gate-shut' });
    render(<RouteCard />);
    expect(screen.getByText(/tramvají 9 z Bieblovy/)).toBeTruthy();
  });

  it('does NOT blame the garden when the garden is not the problem', () => {
    // Standing on a disconnected stretch of path is a different failure, and
    // telling that student to catch a tram from Bieblova is a lie.
    set({ routeStatus: 'no-route' });
    render(<RouteCard />);
    expect(screen.queryByText(/tramvají|Zahrada/)).toBeNull();
    expect(screen.getByText(/cesta nevede/)).toBeTruthy();
  });

  it('tells the student the ISIC gets them through the garden', () => {
    set({ routeStatus: 'ready', routeTargetBuilding: 'Q', routeWalk: walk(1326, ['garden']) });
    render(<RouteCard />);
    expect(screen.getByText(/ISIC/)).toBeTruthy();
  });

  it('does not mention the garden on a route that does not use it', () => {
    set({ routeStatus: 'ready', routeTargetBuilding: 'Q', routeWalk: walk(300) });
    render(<RouteCard />);
    expect(screen.queryByText(/ISIC/)).toBeNull();
  });

  it('says you are already there rather than drawing a one-metre walk', () => {
    set({ routeStatus: 'ready', routeTargetBuilding: 'Q', routeWalk: walk(8) });
    render(<RouteCard />);
    expect(screen.getByText(/Už jsi tam/)).toBeTruthy();
  });
});
