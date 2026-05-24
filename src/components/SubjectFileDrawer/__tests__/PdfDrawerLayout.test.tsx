import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PdfDrawerLayout } from '../PdfDrawerLayout';

vi.mock('../PdfViewer', () => ({
    PdfViewer: ({ blobUrl }: { blobUrl: string }) => <div data-testid="pdf-viewer">{blobUrl}</div>,
}));

afterEach(cleanup);

const fileList = <div data-testid="file-list">files</div>;

describe('PdfDrawerLayout', () => {
    it('phone: PDF takes over full-screen — no file list, no resize handle', async () => {
        render(<PdfDrawerLayout isPhone activePdfUrl="blob:x" onClosePdf={() => {}} fileList={fileList} />);
        expect(await screen.findByTestId('pdf-viewer')).toBeInTheDocument();
        expect(screen.queryByTestId('file-list')).toBeNull();
        expect(document.querySelector('[data-slot="resizable-handle"]')).toBeNull();
    });

    it('desktop: split layout keeps file list + PDF + resize handle', async () => {
        render(<PdfDrawerLayout isPhone={false} activePdfUrl="blob:x" onClosePdf={() => {}} fileList={fileList} />);
        expect(await screen.findByTestId('pdf-viewer')).toBeInTheDocument();
        expect(screen.getByTestId('file-list')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="resizable-handle"]')).not.toBeNull();
    });
});
