import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ExternalLinkOverlay } from '../ExternalLinkOverlay';
import { useAppStore } from '../../../store/useAppStore';

/**
 * What answers the tap while an IS link is on its way to the in-app browser.
 *
 * The browser cannot appear any sooner — the plugin rejects the call that would
 * present it before the page has loaded (see mobile/openExternal) — so reIS has
 * to say it is working, or the student taps again: "while waiting for a vyveska
 * item to open in IS there's no loading so it seems the button is not working".
 */
describe('ExternalLinkOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({ externalOpening: false } as never);
  });
  afterEach(() => {
    act(() => {
      useAppStore.setState({ externalOpening: false } as never);
    });
    vi.useRealTimers();
  });

  const open = () =>
    act(() => {
      useAppStore.setState({ externalOpening: true } as never);
    });
  const settle = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it('shows nothing while nothing is opening', () => {
    render(<ExternalLinkOverlay />);
    expect(screen.queryByTestId('external-opening')).not.toBeInTheDocument();
  });

  it('holds back briefly, so a link that opens at once does not flash a spinner', () => {
    // Most taps on a cached or small page are over in well under this. A
    // spinner that appears and vanishes is its own kind of broken.
    render(<ExternalLinkOverlay />);
    open();
    settle(120);
    expect(screen.queryByTestId('external-opening')).not.toBeInTheDocument();
  });

  it('appears once the wait is long enough to need explaining', () => {
    render(<ExternalLinkOverlay />);
    open();
    settle(400);
    expect(screen.getByTestId('external-opening')).toBeInTheDocument();
  });

  it('goes away when the browser is up', () => {
    render(<ExternalLinkOverlay />);
    open();
    settle(400);
    act(() => {
      useAppStore.setState({ externalOpening: false } as never);
    });
    expect(screen.queryByTestId('external-opening')).not.toBeInTheDocument();
  });

  it('never appears at all for a link that resolved inside the delay', () => {
    render(<ExternalLinkOverlay />);
    open();
    settle(100);
    act(() => {
      useAppStore.setState({ externalOpening: false } as never);
    });
    settle(1000);
    expect(screen.queryByTestId('external-opening')).not.toBeInTheDocument();
  });
});
