import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { EduroamSheet } from '../EduroamSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { useEduroamSetup } from '../../../../hooks/data/useEduroamSetup';
import { isMac, isMobile } from '../../../../utils/platform';

vi.mock('../../../../hooks/data/useEduroamSetup', () => ({
    useEduroamSetup: vi.fn(),
}));

vi.mock('../../../../utils/platform', () => ({
    isMac: vi.fn(),
    isMobile: vi.fn(),
}));

const mockedUseEduroamSetup = vi.mocked(useEduroamSetup);
const mockedIsMac = vi.mocked(isMac);
const mockedIsMobile = vi.mocked(isMobile);

function baseHookState() {
    return {
        status: 'idle' as const,
        target: 'windows' as const,
        selectTarget: vi.fn(),
        password: null,
        qrDataUrl: null,
        error: null,
        run: vi.fn(),
        reset: vi.fn(),
        openProfilesSettings: vi.fn(),
    };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('EduroamSheet', () => {
    it('renders the three numbered steps (credentials, download, install hint)', () => {
        mockedIsMobile.mockReturnValue(false);
        mockedIsMac.mockReturnValue(false);
        mockedUseEduroamSetup.mockReturnValue({
            ...baseHookState(),
            password: 'abc123',
        });
        useAppStore.setState({ language: 'cz' } as never);

        render(<EduroamSheet onClose={vi.fn()} />);

        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('abc123')).toBeInTheDocument();
        expect(screen.getByText('Stáhnout eduroam profil')).toBeInTheDocument();
        expect(screen.getByText('Na fakultě se připoj k eduroam Wi-Fi')).toBeInTheDocument();
    });

    it('copies the credentials to the clipboard when the copy button is clicked', async () => {
        mockedIsMobile.mockReturnValue(false);
        mockedIsMac.mockReturnValue(false);
        mockedUseEduroamSetup.mockReturnValue({
            ...baseHookState(),
            password: 'my-secret-pw',
        });
        useAppStore.setState({ language: 'cz' } as never);

        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        render(<EduroamSheet onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Zkopírovat'));

        await waitFor(() => expect(writeText).toHaveBeenCalledWith('my-secret-pw'));
        vi.unstubAllGlobals();
    });

    it('downloads the platform-appropriate profile for a detected Windows device', () => {
        mockedIsMobile.mockReturnValue(false);
        mockedIsMac.mockReturnValue(false);
        const run = vi.fn();
        mockedUseEduroamSetup.mockReturnValue({ ...baseHookState(), run });
        useAppStore.setState({ language: 'cz' } as never);

        render(<EduroamSheet onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Stáhnout eduroam profil'));

        expect(run).toHaveBeenCalledWith('windows');
    });

    it('downloads the platform-appropriate profile for a detected iOS device', () => {
        mockedIsMobile.mockReturnValue(true);
        mockedIsMac.mockReturnValue(true);
        const run = vi.fn();
        mockedUseEduroamSetup.mockReturnValue({ ...baseHookState(), run });
        useAppStore.setState({ language: 'cz' } as never);

        render(<EduroamSheet onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Stáhnout eduroam profil'));

        expect(run).toHaveBeenCalledWith('ios');
    });

    it('calls useEduroamSetup with the detected target so the password prefetch runs immediately', () => {
        mockedIsMobile.mockReturnValue(false);
        mockedIsMac.mockReturnValue(false);
        mockedUseEduroamSetup.mockReturnValue(baseHookState());
        useAppStore.setState({ language: 'cz' } as never);

        render(<EduroamSheet onClose={vi.fn()} />);

        expect(mockedUseEduroamSetup).toHaveBeenCalledWith('windows');
    });

    it('shows an error alert with the message when status is error, instead of failing silently', () => {
        mockedIsMobile.mockReturnValue(false);
        mockedIsMac.mockReturnValue(false);
        mockedUseEduroamSetup.mockReturnValue({
            ...baseHookState(),
            status: 'error',
            error: 'Session expired',
        });
        useAppStore.setState({ language: 'cz' } as never);

        render(<EduroamSheet onClose={vi.fn()} />);

        expect(screen.getByText(/Session expired/)).toBeInTheDocument();
    });

    it('closes via the header close button', () => {
        mockedIsMobile.mockReturnValue(false);
        mockedIsMac.mockReturnValue(false);
        mockedUseEduroamSetup.mockReturnValue(baseHookState());
        useAppStore.setState({ language: 'cz' } as never);

        const onClose = vi.fn();
        render(<EduroamSheet onClose={onClose} />);
        fireEvent.click(screen.getByLabelText('Zavřít'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
