import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const viewerCtor = vi.fn();
const destroy = vi.fn();
vi.mock('openseadragon', () => ({
  default: {
    Point: vi.fn().mockImplementation(function (this: { x: number; y: number }, x, y) {
      this.x = x;
      this.y = y;
    }),
    Viewer: vi.fn().mockImplementation(function (opts: unknown) {
      viewerCtor(opts);
      return {
        destroy,
        addHandler: vi.fn(),
        removeHandler: vi.fn(),
        container: { clientWidth: 390, clientHeight: 844 },
        viewport: {
          zoomTo: vi.fn(),
          panTo: vi.fn(),
          applyConstraints: vi.fn(),
          getZoom: () => 3,
          // Every place lands at the same spot on screen: enough to know a pin was drawn.
          pixelFromPoint: () => ({ x: 120, y: 200 }),
        },
      };
    }),
  },
}));

import { IsoMapButton } from '../../components/CampusMap/iso/IsoMapButton';
import { IsoMapView } from '../../components/CampusMap/iso/IsoMapView';
import { useAppStore } from '../../store/useAppStore';
import { ISO_ATTRIBUTION } from '../../data/map/isoMap';
import cs from '../../i18n/locales/cs.json';
import { MOCK_MAP_EVENTS } from '../../components/CampusMap/__tests__/fixtures/mockMapEvents';
import { localTodayIso } from '../../components/CampusMap/eventWindow';

/**
 * How the isometric map behaves as an overlay: what closes it, and that it is a proper modal.
 * (Dormant/on-state and the cube's reachability are in isoMapIsDormantAndOnBothTrees.test.tsx.)
 */
afterEach(() => {
  vi.unstubAllEnvs();
  viewerCtor.mockClear();
  destroy.mockClear();
  useAppStore.setState({ isoMapOpen: false });
});

describe('the isometric map closes itself, and is a proper modal', () => {
  it('closes when an event is shown, even one with no place to fly to', () => {
    on();
    useAppStore.setState({
      isoMapOpen: true,
      mapEvents: [
        { ...MOCK_MAP_EVENTS[0]!, id: 'ev1', coord: null, date: localTodayIso(), endDate: null },
      ],
    } as never);
    useAppStore.getState().focusEventById('ev1', { fly: true });
    expect(useAppStore.getState().isoMapOpen).toBe(false);
  });

  it('closes, rather than sit empty, when the viewer cannot start', async () => {
    const osd = (await import('openseadragon')).default as unknown as {
      Viewer: ReturnType<typeof vi.fn>;
    };
    osd.Viewer.mockImplementationOnce(function () {
      throw new Error('chunk failed');
    });
    await open();
    expect(useAppStore.getState().isoMapOpen).toBe(false);
  });

  it('keeps Tab inside the dialog, wrapping at both ends and pulling stray focus back in', async () => {
    on();
    useAppStore.setState({ isoMapOpen: true });
    await act(async () => {
      render(
        <div>
          <button data-testid="outside">outside</button>
          <IsoMapView />
        </div>
      );
    });
    const close = screen.getByTestId('iso-map-close');
    const link = screen.getByRole('link');
    expect(document.activeElement).toBe(close);
    link.focus();
    fireEvent.keyDown(link, { key: 'Tab' });
    expect(document.activeElement).toBe(close); // last -> first
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(link); // first -> last
    screen.getByTestId('outside').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close); // stray focus comes back
  });

  it('leaves Tab alone while focus is in another dialog opened over it', async () => {
    on();
    useAppStore.setState({ isoMapOpen: true });
    await act(async () => {
      render(<IsoMapView />);
    });
    // The pop-up is portalled to the body, outside what the map makes inert.
    const popup = document.createElement('div');
    popup.setAttribute('role', 'alertdialog');
    const btn = document.createElement('button');
    popup.append(btn);
    document.body.append(popup);
    btn.focus();
    const proceed = fireEvent.keyDown(btn, { key: 'Tab' });
    expect(document.activeElement).toBe(btn); // not pulled back into the map
    expect(proceed).toBe(true); // not preventDefault-ed
    popup.remove();
  });

  const on = () => vi.stubEnv('VITE_ISO_MAP_URL', 'http://localhost:8793/tiles');
  const open = async (ui = <IsoMapView />) => {
    on();
    useAppStore.setState({ isoMapOpen: true });
    let r!: ReturnType<typeof render>;
    await act(async () => {
      r = render(ui);
    });
    return r;
  };

  it('closes on Escape', async () => {
    await open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().isoMapOpen).toBe(false);
  });

  it('closes when the screen hosting it goes away, so the flag cannot outlive it', async () => {
    const r = await open();
    r.unmount();
    expect(useAppStore.getState().isoMapOpen).toBe(false);
  });

  it('closes on a "show on map" request, which would otherwise land underneath', async () => {
    await open();
    act(() =>
      useAppStore.setState({ mapFocusRequest: useAppStore.getState().mapFocusRequest + 1 })
    );
    expect(useAppStore.getState().isoMapOpen).toBe(false);
  });

  it('is a labelled modal dialog that takes focus, shuts out what is behind it and gives focus back', async () => {
    on();
    useAppStore.setState({ isoMapOpen: false });
    const r = render(
      <div>
        <div data-testid="behind">
          <IsoMapButton />
        </div>
        <IsoMapView />
      </div>
    );
    const opener = screen.getByTestId('iso-map-open');
    opener.focus();
    await act(async () => {
      fireEvent.click(opener);
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByTestId('iso-map-close'));
    expect((screen.getByTestId('behind') as HTMLElement & { inert: boolean }).inert).toBe(true);
    fireEvent.click(screen.getByTestId('iso-map-close'));
    expect((screen.getByTestId('behind') as HTMLElement & { inert: boolean }).inert).toBe(false);
    expect(document.activeElement).toBe(opener);
    r.unmount();
  });

  it("does not zoom on a plain click, and the credit is a link in the student's language", async () => {
    await open();
    const opts = viewerCtor.mock.calls[0]![0] as { gestureSettingsMouse: { clickToZoom: boolean } };
    expect(opts.gestureSettingsMouse.clickToZoom).toBe(false);
    const credit = screen.getByRole('link', { name: ISO_ATTRIBUTION });
    expect(credit.getAttribute('href')).toBe('https://www.openstreetmap.org/copyright');
    // The constant is the required wording; the Czech string must not drift from it.
    expect(cs.map.isoCredit).toBe(ISO_ATTRIBUTION);
  });
});
