import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { PdfViewer } from '../PdfViewer';
import { useEscapeLayer, hasOpenEscapeLayer } from '../../../hooks/ui/useEscapeLayer';

vi.mock('react-pdf', () => ({
  Document: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
  Page: () => <div />,
  pdfjs: { GlobalWorkerOptions: {} },
}));
vi.mock('../pdfWorkerSource', () => ({
  resolvePdfWorkerSource: () => Promise.resolve('blob:worker'),
}));

afterEach(cleanup);

/** Stands in for what the reader opens over: the subject sheet or drawer. */
function Underneath({ onClose }: { onClose: () => void }) {
  useEscapeLayer(true, onClose);
  return null;
}

/**
 * Escape closes the reader, and only the reader — the order Back already keeps
 * on Android. Before, the reader was no Escape layer, so on the phone tree the
 * sheet stack popped the whole subject with the PDF in it, and on the
 * extension the side drawer closed under the reader. The pdf.js reader is the
 * extension's, Android's and the fallback on an iPad or a Mac; both trees get
 * this from here.
 */
describe('PdfViewer and Escape', () => {
  it('is an Escape layer while open', () => {
    const { unmount } = render(<PdfViewer blobUrl="blob:doc" onClose={() => {}} />);
    expect(hasOpenEscapeLayer()).toBe(true);
    unmount();
    expect(hasOpenEscapeLayer()).toBe(false);
  });

  it('closes itself on Escape and leaves what it opened over alone', () => {
    const below = vi.fn();
    const close = vi.fn();
    const { rerender } = render(<Underneath onClose={below} />);
    rerender(
      <>
        <Underneath onClose={below} />
        <PdfViewer blobUrl="blob:doc" onClose={close} />
      </>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
    expect(below).not.toHaveBeenCalled();
  });
});
