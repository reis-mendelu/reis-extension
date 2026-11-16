import { useEffect } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PdfViewer } from '../PdfViewer';

// react-pdf's Document reports success once pdf.js has parsed the bytes; a
// failed load calls onLoadError instead and never onLoadSuccess.
let loads = true;
vi.mock('react-pdf', () => ({
  Document: (props: {
    onLoadSuccess: (pdf: unknown) => void;
    onLoadError: (e: Error) => void;
    inputRef: React.Ref<HTMLDivElement>;
    children: React.ReactNode;
  }) => {
    const { onLoadSuccess, onLoadError } = props;
    useEffect(() => {
      if (!loads) return onLoadError(new Error('bad pdf'));
      onLoadSuccess({
        numPages: 1,
        getPage: async () => ({ getViewport: () => ({ width: 595, height: 842 }) }),
      });
      // Once per mount, as react-pdf reports one load per file.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div data-testid="document" ref={props.inputRef}>
        {props.children}
      </div>
    );
  },
  Page: () => <div data-testid="page" />,
  pdfjs: { GlobalWorkerOptions: {} },
}));
vi.mock('../pdfWorkerSource', () => ({
  resolvePdfWorkerSource: () => Promise.resolve('blob:worker'),
}));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

afterEach(cleanup);

// The phone's store-rating dwell clock starts when the document is on screen,
// so a PDF that never loads never counts as read.
describe('PdfViewer onDocumentLoaded', () => {
  it('fires once the document has loaded', async () => {
    loads = true;
    const onDocumentLoaded = vi.fn();
    render(<PdfViewer blobUrl="blob:doc" onClose={() => {}} onDocumentLoaded={onDocumentLoaded} />);
    await screen.findAllByTestId('page');
    expect(onDocumentLoaded).toHaveBeenCalledTimes(1);
  });

  it('never fires for a document that failed to load', async () => {
    loads = false;
    const onDocumentLoaded = vi.fn();
    render(<PdfViewer blobUrl="blob:doc" onClose={() => {}} onDocumentLoaded={onDocumentLoaded} />);
    await screen.findByTestId('document');
    expect(onDocumentLoaded).not.toHaveBeenCalled();
  });
});
