import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useEscapeLayer } from '../useEscapeLayer';
import { useAppStore } from '../../../store/useAppStore';
import { GardenPlaceCard } from '../../../components/CampusMap/GardenPlaceCard';
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

  it('GardenPlaceCard: the full-screen photo closes, the panel stays', () => {
    render(
      <>
        <Under onClose={under} />
        <GardenPlaceCard
          place={{
            id: 'rokle',
            name: { cz: 'Rokle', en: 'Rokle' },
            lon: 0,
            lat: 0,
            photo: 'r.jpg',
          }}
        />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rokle' }));
    expect(screen.getAllByAltText('Rokle')).toHaveLength(2);
    escape();
    expect(screen.getAllByAltText('Rokle')).toHaveLength(1);
    expect(under).not.toHaveBeenCalled();
  });

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
