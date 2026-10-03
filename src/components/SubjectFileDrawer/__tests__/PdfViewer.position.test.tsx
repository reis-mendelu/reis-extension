import { useEffect } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import { PdfViewer } from '../PdfViewer';

const PAGES = 10;
const PAGE_HEIGHT = 1000;
/** Per test: a landscape slide on a phone is far shorter than the pane. */
let pageHeight = PAGE_HEIGHT;
const VIEWPORT = 900;

vi.mock('react-pdf', () => ({
  Document: (props: {
    onLoadSuccess: (pdf: unknown) => void;
    inputRef: React.Ref<HTMLDivElement>;
    children: React.ReactNode;
  }) => {
    const { onLoadSuccess } = props;
    useEffect(() => {
      onLoadSuccess({
        numPages: PAGES,
        getPage: async () => ({ getViewport: () => ({ width: 595, height: 842 }) }),
      });
    }, [onLoadSuccess]);
    return <div ref={props.inputRef}>{props.children}</div>;
  },
  Page: () => <div data-testid="page" />,
  pdfjs: { GlobalWorkerOptions: {} },
}));

vi.mock('../pdfWorkerSource', () => ({
  resolvePdfWorkerSource: () => Promise.resolve('blob:worker'),
}));

// jsdom lays nothing out: every page row is PAGE_HEIGHT tall, stacked, and the
// scroll area shows VIEWPORT of them.
beforeEach(() => {
  pageHeight = PAGE_HEIGHT;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const area = document.querySelector<HTMLElement>('[data-testid="pdf-scroll-area"]');
    const index = this.dataset.pageIndex;
    const top = index === undefined ? 0 : Number(index) * pageHeight - (area?.scrollTop ?? 0);
    return {
      top,
      bottom: top + pageHeight,
      left: 0,
      right: 600,
      width: 600,
      height: pageHeight,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(VIEWPORT);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function mountViewer(props: {
  initialPage?: number | null;
  onPageChange?: (p: number) => void;
}) {
  const view = render(<PdfViewer blobUrl="blob:doc" onClose={() => {}} {...props} />);
  await screen.findAllByTestId('page');
  return { area: screen.getByTestId('pdf-scroll-area'), ...view };
}

function scrollTo(area: HTMLElement, top: number) {
  act(() => {
    area.scrollTop = top;
    area.dispatchEvent(new Event('scroll'));
  });
}

describe('PdfViewer reading position', () => {
  it('reopens on the page the student left', async () => {
    const { area } = await mountViewer({ initialPage: 6 });
    await waitFor(() => expect(area.scrollTop).toBe(6 * PAGE_HEIGHT), { timeout: 2000 });
  });

  it('lands on the last page when the saved one is past the end', async () => {
    const { area } = await mountViewer({ initialPage: 40 });
    await waitFor(() => expect(area.scrollTop).toBe((PAGES - 1) * PAGE_HEIGHT), {
      timeout: 2000,
    });
  });

  // The viewer mounts at the top, and the restore waits for the fit-to-width
  // zoom. Reporting from that first frame would save page 0 over the page it
  // is about to restore — the bug that would make this feature never work.
  it('never reports a page before the saved one is restored', async () => {
    const onPageChange = vi.fn();
    const { area } = await mountViewer({ initialPage: 6, onPageChange });
    scrollTo(area, 0);
    await waitFor(() => expect(area.scrollTop).toBe(6 * PAGE_HEIGHT), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 400));
    expect(onPageChange).not.toHaveBeenCalledWith(0);
  });

  it('reports the page being read once scrolling settles', async () => {
    const onPageChange = vi.fn();
    const { area } = await mountViewer({ initialPage: 2, onPageChange });
    await waitFor(() => expect(area.scrollTop).toBe(2 * PAGE_HEIGHT), { timeout: 2000 });

    act(() => {
      area.dispatchEvent(new Event('wheel'));
    });
    scrollTo(area, 4 * PAGE_HEIGHT + 100);

    await waitFor(() => expect(onPageChange).toHaveBeenLastCalledWith(4));
  });

  it('reports the last page read when closed mid-scroll', async () => {
    const onPageChange = vi.fn();
    const { area, unmount } = await mountViewer({ onPageChange });
    await new Promise((r) => setTimeout(r, 400));

    scrollTo(area, 8 * PAGE_HEIGHT);
    unmount();

    expect(onPageChange).toHaveBeenLastCalledWith(8);
  });

  // A 16:9 slide on a phone is ~235 px in an ~800 px pane. Restore puts slide N
  // at the top; a reading line a third of the way down sits in slide N+1, and
  // each reopen then saved one slide further on.
  describe('with slides shorter than a third of the pane', () => {
    it('saves nothing when the student only looks', async () => {
      pageHeight = 200;
      const onPageChange = vi.fn();
      const { area } = await mountViewer({ initialPage: 6, onPageChange });
      await waitFor(() => expect(area.scrollTop).toBe(6 * 200), { timeout: 2000 });
      // The browser fires scroll for the restore's own scrollTop write.
      scrollTo(area, area.scrollTop);
      await new Promise((r) => setTimeout(r, 400));
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('saves the slide at the top of the pane, the one a restore puts there', async () => {
      pageHeight = 200;
      const onPageChange = vi.fn();
      const { area } = await mountViewer({ onPageChange });
      await new Promise((r) => setTimeout(r, 400));

      act(() => {
        area.dispatchEvent(new Event('wheel'));
      });
      scrollTo(area, 6 * 200);

      await waitFor(() => expect(onPageChange).toHaveBeenLastCalledWith(6));
    });
  });
});
