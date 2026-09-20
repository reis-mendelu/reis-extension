import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { PdfViewer } from '../PdfViewer';

// Records what PdfViewer actually hands <Document>. The real react-pdf is not
// exercised here — the whole point is the props contract, which is what a
// version bump silently changes.
const documentProps: Record<string, unknown>[] = [];

vi.mock('react-pdf', () => ({
  Document: (props: Record<string, unknown>) => {
    documentProps.push(props);
    return (
      <div data-testid="document">
        <div data-testid="loading-slot">{props.loading as React.ReactNode}</div>
        {props.children as React.ReactNode}
      </div>
    );
  },
  Page: () => <div data-testid="page" />,
  pdfjs: { GlobalWorkerOptions: {} },
}));

vi.mock('../pdfWorkerSource', () => ({
  resolvePdfWorkerSource: () => Promise.resolve('blob:worker'),
}));

afterEach(() => {
  documentProps.length = 0;
  cleanup();
});

// Indexed access is checked (noUncheckedIndexedAccess), and "Document never
// rendered" deserves a clearer failure than `undefined is not false`.
function firstDocumentProps(): Record<string, unknown> {
  const props = documentProps[0];
  if (!props) throw new Error('<Document> was never rendered');
  return props;
}

describe('PdfViewer opts out of react-pdf 11 Suspense', () => {
  // react-pdf 11 turned Suspense on by default, which retires `loading` and
  // `onLoadError`. This component is mounted inside a single <Suspense>
  // boundary that wraps the WHOLE pane, and its pages mount lazily while
  // scrolling — so with Suspense on, each newly mounted Page would suspend
  // that one boundary and blank the viewer mid-scroll. Nothing else in the
  // suite renders <Document>, so without this test removing the opt-out is
  // invisible: the drawer tests all replace PdfViewer with a stub.
  it('passes suspense={false} so loading stays inline and per-page', async () => {
    render(<PdfViewer blobUrl="blob:doc" onClose={() => {}} />);

    await waitFor(() => expect(documentProps.length).toBeGreaterThan(0));
    expect(firstDocumentProps().suspense).toBe(false);
  });

  it('still supplies the inline loading fallback and an error handler', async () => {
    render(<PdfViewer blobUrl="blob:doc" onClose={() => {}} />);

    await waitFor(() => expect(documentProps.length).toBeGreaterThan(0));
    // Both are dead props once Suspense is on, so their presence is only
    // meaningful together with suspense={false} above.
    const props = firstDocumentProps();
    expect(props.loading).toBeTruthy();
    expect(typeof props.onLoadError).toBe('function');
    expect(await screen.findByTestId('loading-slot')).toBeInTheDocument();
  });
});
