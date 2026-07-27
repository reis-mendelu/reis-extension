import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DocsSheet } from '../DocsSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { useDocumentDownload } from '../../../../hooks/data/useDocumentDownload';

vi.mock('../../../../hooks/data/useDocumentDownload', () => ({
    useDocumentDownload: vi.fn(),
}));

const mockedUseDocumentDownload = vi.mocked(useDocumentDownload);

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('DocsSheet', () => {
    it('lists the official study documents with a download button each', () => {
        mockedUseDocumentDownload.mockReturnValue({ status: {}, run: vi.fn() });
        useAppStore.setState({ language: 'cz', studiumId: '12345' } as never);

        render(<DocsSheet onClose={vi.fn()} />);

        expect(screen.getByText('Potvrzení o studiu')).toBeInTheDocument();
        expect(screen.getByText('Přehled studia')).toBeInTheDocument();
        expect(screen.getAllByText('Stáhnout').length).toBeGreaterThan(0);
    });

    it('triggers a download for the clicked document', () => {
        const run = vi.fn();
        mockedUseDocumentDownload.mockReturnValue({ status: {}, run });
        useAppStore.setState({ language: 'cz', studiumId: '12345' } as never);

        render(<DocsSheet onClose={vi.fn()} />);
        fireEvent.click(screen.getAllByText('Stáhnout')[0]);

        expect(run).toHaveBeenCalledWith('potvrzeni-cz', expect.stringContaining('12345'), 'Potvrzeni_o_studiu.pdf');
    });

    it('disables the download buttons when studiumId is not yet known', () => {
        mockedUseDocumentDownload.mockReturnValue({ status: {}, run: vi.fn() });
        useAppStore.setState({ language: 'cz', studiumId: null } as never);

        render(<DocsSheet onClose={vi.fn()} />);

        expect(screen.getAllByText('Stáhnout')[0].closest('button')).toBeDisabled();
    });

    it('closes via the header close button', () => {
        mockedUseDocumentDownload.mockReturnValue({ status: {}, run: vi.fn() });
        useAppStore.setState({ language: 'cz', studiumId: '12345' } as never);

        const onClose = vi.fn();
        render(<DocsSheet onClose={onClose} />);
        fireEvent.click(screen.getByLabelText('Zavřít'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
