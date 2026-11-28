import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReisForClaudeRow } from '../ReisForClaudeRow';
import { useAppStore } from '../../../store/useAppStore';
import { overlayWrite } from '../../../store/overlay/overlayGuard';
import { identityOverlay } from '../../../store/overlay/identityOverlay';
import { useReisForClaude } from '../../../hooks/useReisForClaude';
import {
  REIS_FOR_CLAUDE_KEY,
  type ReisForClaudeState,
} from '../../../store/slices/createReisForClaudeSlice';
import { IndexedDBService } from '../../../services/storage/IndexedDBService';
import { trackFeatureSignal } from '../../../api/featureUsage';

vi.mock('../../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn() }));
vi.mock('../../../services/storage/IndexedDBService', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) },
}));

function Badge() {
  return <span data-testid="badge">{useReisForClaude().badge}</span>;
}

const setUp = (
  programme: string | null,
  state: ReisForClaudeState = 'new',
  faculty: string | null = 'PEF'
) =>
  useAppStore.setState(
    overlayWrite({
      userFaculty: faculty,
      userProgramme: programme,
      reisForClaude: state,
      impersonation: null,
    })
  );

/** A persona as createImpersonationSlice applies it: the identity is in the store. */
const impersonate = (selection: { faculty: string; shortCode: string }) =>
  useAppStore.setState(
    overlayWrite({
      impersonation: { selection, result: {} } as never,
      ...identityOverlay(selection),
    })
  );

describe('ReisForClaudeRow', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['B-OI', 'B-OI-ZBOI', 'B-AII', 'N-OI'])('shows for %s, linking the guide', (p) => {
    setUp(p);
    render(<ReisForClaudeRow />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://reisapp.cz/navody/reis-v-claude');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it.each([null, 'B-EKO', 'N-OIX'])('shows nothing for %s', (p) => {
    setUp(p);
    const { container } = render(<ReisForClaudeRow />);
    expect(container.innerHTML).toBe('');
  });

  // The audience is PEF tokens now (matchesAudience): an unknown faculty
  // matches nothing, so a programme alone no longer shows the row.
  it.each([null, 'XYZ'])('shows nothing when the faculty is %s', (faculty) => {
    setUp('B-OI', 'new', faculty);
    expect(render(<ReisForClaudeRow />).container.innerHTML).toBe('');
  });

  it('follows the impersonated student, not the admin', () => {
    setUp('B-EKO', 'new', 'AF');
    impersonate({ faculty: 'PEF', shortCode: 'B-AII' });
    expect(render(<ReisForClaudeRow />).container.innerHTML).not.toBe('');
    // …and an admin in the launch programme sees what a B-EKO student would.
    setUp('B-OI', 'new', 'PEF');
    impersonate({ faculty: 'PEF', shortCode: 'B-EKO' });
    expect(render(<ReisForClaudeRow />).container.innerHTML).toBe('');
  });

  it('shows nothing before boot has read the device, or once done', () => {
    setUp('B-OI', 'loading');
    expect(render(<ReisForClaudeRow />).container.innerHTML).toBe('');
    setUp('B-OI', 'done');
    expect(render(<ReisForClaudeRow />).container.innerHTML).toBe('');
  });

  it('opening counts the install and hides it for good', async () => {
    setUp('B-OI');
    const { container } = render(<ReisForClaudeRow />);
    fireEvent.click(screen.getByRole('link'));
    expect(trackFeatureSignal).toHaveBeenCalledWith('reis_for_claude_guide_opened');
    expect(useAppStore.getState().reisForClaude).toBe('done');
    expect(container.innerHTML).toBe('');
    await vi.waitFor(() =>
      expect(IndexedDBService.set).toHaveBeenCalledWith('meta', REIS_FOR_CLAUDE_KEY, 'done')
    );
  });

  it('the cross hides it for good without counting', () => {
    setUp('B-OI');
    render(<ReisForClaudeRow />);
    fireEvent.click(screen.getByRole('button'));
    expect(trackFeatureSignal).not.toHaveBeenCalled();
    expect(useAppStore.getState().reisForClaude).toBe('done');
  });

  it('counts on the bell until Novinky has shown it', async () => {
    setUp('B-OI');
    const { rerender } = render(<Badge />);
    expect(screen.getByTestId('badge').textContent).toBe('1');
    useAppStore.getState().markReisForClaudeSeen();
    rerender(<Badge />);
    expect(screen.getByTestId('badge').textContent).toBe('0');
    await vi.waitFor(() =>
      expect(IndexedDBService.set).toHaveBeenCalledWith('meta', REIS_FOR_CLAUDE_KEY, 'seen')
    );
  });

  it("a stale tab's 'seen' does not undo another tab's dismissal", async () => {
    setUp('B-OI');
    vi.mocked(IndexedDBService.get).mockResolvedValueOnce('done');
    useAppStore.getState().markReisForClaudeSeen();
    await vi.waitFor(() => expect(IndexedDBService.get).toHaveBeenCalled());
    await Promise.resolve();
    expect(IndexedDBService.set).not.toHaveBeenCalled();
  });

  it('boot restores what the device saved', async () => {
    setUp('B-OI', 'loading');
    vi.mocked(IndexedDBService.get).mockResolvedValueOnce('done');
    await useAppStore.getState().loadReisForClaude();
    expect(useAppStore.getState().reisForClaude).toBe('done');
    setUp('B-OI', 'loading');
    vi.mocked(IndexedDBService.get).mockResolvedValueOnce(undefined);
    await useAppStore.getState().loadReisForClaude();
    expect(useAppStore.getState().reisForClaude).toBe('new');
  });
});
