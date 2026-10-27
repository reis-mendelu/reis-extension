import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EduroamSheet } from '../EduroamSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { useEduroamSetup } from '../../../../hooks/data/useEduroamSetup';
import cs from '../../../../i18n/locales/cs.json';

/**
 * reIS on a Mac (the iOS app): step 3 must say what actually happened to the
 * profile. Usually macOS took it and opened Device Management; if macOS would
 * not open it, the student saved it with the Save panel and nothing opened
 * System Settings, so the sentence that says it did would be false.
 */

vi.mock('../../../../hooks/data/useEduroamSetup', () => ({ useEduroamSetup: vi.fn() }));
vi.mock('../../../../utils/platform', () => ({
  isMac: vi.fn(() => true),
  isMobile: vi.fn(() => false),
}));
vi.mock('../../../../platform', () => ({ getPlatform: () => ({ kind: 'capacitor' }) }));
vi.mock('../../../../mobile/eduroamNative', () => ({
  canConfigureEduroamNatively: vi.fn(() => false),
  nativeEduroamTarget: vi.fn(() => null),
}));

type HookState = ReturnType<typeof useEduroamSetup>;

function onMac(over: Partial<HookState>) {
  vi.mocked(useEduroamSetup).mockReturnValue({
    status: 'idle',
    target: 'mac',
    selectTarget: vi.fn(),
    password: null,
    error: null,
    networkFailure: null,
    outcome: null,
    expiredAt: null,
    expiresSoonAt: null,
    run: vi.fn(),
    renew: vi.fn(),
    reset: vi.fn(),
    openProfilesSettings: vi.fn(),
    profileRoute: null,
    ...over,
  });
  useAppStore.setState({ language: 'cz' } as never);
  render(<EduroamSheet onClose={vi.fn()} />);
}

const { installStep, savedStep } = cs.eduroam.macApp;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EduroamSheet on a Mac', () => {
  it('before the run, says macOS will open Device Management', () => {
    onMac({});
    expect(screen.getByText(installStep)).toBeInTheDocument();
  });

  it('after macOS took the profile, keeps saying so', () => {
    onMac({ status: 'done', profileRoute: 'opened' });
    expect(screen.getByText(installStep)).toBeInTheDocument();
  });

  it('after a Save-panel fallback, says to open the saved file — not that Settings opened', () => {
    onMac({ status: 'done', profileRoute: 'saved' });
    expect(screen.getByText(savedStep)).toBeInTheDocument();
    expect(screen.queryByText(installStep)).toBeNull();
  });
});
