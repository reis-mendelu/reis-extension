import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useEscapeLayer } from '../useEscapeLayer';
import { useAppStore } from '../../../store/useAppStore';
import { MobileBulletinOverlay } from '../../../components/Bulletin/MobileBulletinOverlay';
import { CustomEventModal } from '../../../components/CustomEventModal';
import { BulletinBanner } from '../../../components/Bulletin/BulletinBanner';

/** What the overlay opens over — a drawer, a sheet or a panel: a layer under it. */
function Under({ onClose }: { onClose: () => void }) {
  useEscapeLayer(true, onClose);
  return null;
}

const escape = () => fireEvent.keyDown(document, { key: 'Escape' });

/**
 * Overlays that used to answer Escape with their own listener, without keeping
 * the key, so one press closed them AND the drawer or sheet under them. They
 * are Escape layers now: the one opened last closes, alone.
 */
describe('overlays with their own Escape are layers', () => {
  let under: () => void;
  beforeEach(() => {
    under = vi.fn();
    useAppStore.setState({ language: 'cz' } as never);
  });
  afterEach(cleanup);

  it('MobileBulletinOverlay: the overlay closes, what is under it stays', () => {
    const onClose = vi.fn();
    render(
      <>
        <Under onClose={under} />
        <MobileBulletinOverlay isOpen onClose={onClose} posts={[]} loading={false} error={false} />
      </>
    );
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(under).not.toHaveBeenCalled();
  });

  it('CustomEventModal: the editor closes, what is under it stays', () => {
    const onClose = vi.fn();
    render(
      <>
        <Under onClose={under} />
        <CustomEventModal
          mode="create"
          initialDate="20261026"
          onSave={() => {}}
          onClose={onClose}
        />
      </>
    );
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(under).not.toHaveBeenCalled();
  });

  it('BulletinBanner: the open dropdown closes, what is under it stays', () => {
    useAppStore.setState({
      isNarrow: false,
      bulletinPosts: [],
      bulletinExpanded: true,
      bulletinLoading: false,
      bulletinError: false,
      bulletinHydrated: true,
      setBulletinExpanded: async (val: boolean) => {
        useAppStore.setState({ bulletinExpanded: val });
      },
      loadBulletinIfStale: async () => {},
    } as never);
    render(
      <>
        <Under onClose={under} />
        <BulletinBanner inline />
      </>
    );
    escape();
    expect(useAppStore.getState().bulletinExpanded).toBe(false);
    expect(under).not.toHaveBeenCalled();
  });
});
