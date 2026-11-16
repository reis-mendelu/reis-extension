import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';

const setup = vi.hoisted(() => ({ status: 'idle' as string }));
vi.mock('../../../hooks/data/useEduroamSetup', () => ({
  useEduroamSetup: () => ({
    status: setup.status,
    password: null,
    error: 'IS odmítl požadavek',
    networkFailure: null,
    expiredAt: null,
    expiresSoonAt: null,
    run: vi.fn(),
    renew: vi.fn(),
    reset: vi.fn(),
    selectTarget: vi.fn(),
    openProfilesSettings: vi.fn(),
  }),
}));

const { EduroamDrawer } = await import('../../Eduroam/EduroamDrawer');
const { EduroamSheetStatus } = await import('../../mobile/sheets/EduroamSheetStatus');
const { EduroamExpiredNotice } = await import('../../Eduroam/EduroamExpiredNotice');

const TROUBLESHOOT = 'https://reisapp.cz/navody/eduroam?z=app&utm_source=reis-app#nefunguje';

/** eduroam did not go through: each surface offers the guide's "nefunguje" section. */
describe('eduroam — Proč to nejde?', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' }));
  afterEach(() => {
    cleanup();
    setup.status = 'idle';
    useAppStore.setState({ isEduroamOpen: false });
  });

  it('the phone sheet links it from the error', () => {
    render(
      <EduroamSheetStatus
        status="error"
        outcome="failed"
        error={null}
        networkFailure={null}
        native
        target="android"
      />
    );
    expect(screen.getByRole('link', { name: 'Proč to nejde?' })).toHaveAttribute(
      'href',
      TROUBLESHOOT
    );
  });

  it('the phone sheet has no link when nothing went wrong', () => {
    render(
      <EduroamSheetStatus
        status="done"
        outcome="saved"
        error={null}
        networkFailure={null}
        native
        target="android"
      />
    );
    expect(screen.queryByRole('link', { name: 'Proč to nejde?' })).toBeNull();
  });

  it('the extension drawer links it from the error', () => {
    setup.status = 'error';
    useAppStore.setState({ isEduroamOpen: true, isTouch: false, isNarrow: false });
    render(<EduroamDrawer />);
    expect(screen.getByRole('link', { name: 'Proč to nejde?' })).toHaveAttribute(
      'href',
      TROUBLESHOOT
    );
  });

  it('the shared expired-certificate notice links it', () => {
    render(<EduroamExpiredNotice at={new Date(2026, 0, 1)} kind="expired" onRenew={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Proč to nejde?' })).toHaveAttribute(
      'href',
      TROUBLESHOOT
    );
  });

  it('but not the early "expires soon" offer, which is only information', () => {
    render(<EduroamExpiredNotice at={new Date(2026, 0, 1)} kind="soon" onRenew={vi.fn()} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
