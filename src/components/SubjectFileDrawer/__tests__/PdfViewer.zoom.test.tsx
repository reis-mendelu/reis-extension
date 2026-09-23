import { useEffect } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { PdfViewer } from '../PdfViewer';

// A two-page document, so the page rows actually render. `inputRef` goes on
// the root div, as react-pdf's own Document does (Document.js: `ref: inputRef`).
vi.mock('react-pdf', () => ({
  Document: (props: {
    onLoadSuccess: (pdf: unknown) => void;
    inputRef: React.Ref<HTMLDivElement>;
    children: React.ReactNode;
  }) => {
    const { onLoadSuccess } = props;
    useEffect(() => {
      onLoadSuccess({
        numPages: 2,
        getPage: async () => ({ getViewport: () => ({ width: 595, height: 842 }) }),
      });
    }, [onLoadSuccess]);
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

afterEach(cleanup);

type Point = [number, number];

/** A touch event carrying `touches`, which jsdom cannot construct itself. */
function touch(el: Element, type: string, points: Point[]): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'touches', {
    value: points.map(([clientX, clientY]) => ({ clientX, clientY })),
  });
  act(() => {
    el.dispatchEvent(ev);
  });
  return ev;
}

async function mountViewer() {
  render(<PdfViewer blobUrl="blob:doc" onClose={() => {}} />);
  await screen.findAllByTestId('page');
  return screen.getByTestId('pdf-scroll-area');
}

describe('PdfViewer pinch zoom', () => {
  // Capacitor turns the WebView's own pinch-zoom off (iOS disables the scroll
  // view's pinchGestureRecognizer, Android leaves builtInZoomControls false),
  // so on the phone app a pinch reaches nothing unless the viewer handles it.
  it('zooms by the ratio the fingers spread', async () => {
    const area = await mountViewer();
    expect(screen.getByText('100%')).toBeInTheDocument();

    touch(area, 'touchstart', [
      [100, 300],
      [200, 300],
    ]);
    const move = touch(area, 'touchmove', [
      [50, 300],
      [250, 300],
    ]);
    touch(area, 'touchend', [[50, 300]]);

    expect(screen.getByText('200%')).toBeInTheDocument();
    // Claimed, or a mobile browser would zoom the whole app instead.
    expect(move.defaultPrevented).toBe(true);
  });

  it('previews the zoom under the fingers before they lift', async () => {
    const area = await mountViewer();
    const doc = screen.getByTestId('document');

    touch(area, 'touchstart', [
      [100, 300],
      [200, 300],
    ]);
    touch(area, 'touchmove', [
      [50, 300],
      [250, 300],
    ]);

    // Scaled around the pinch midpoint, and not yet committed.
    expect(doc.style.transform).toBe('scale(2)');
    expect(doc.style.transformOrigin).toBe('150px 300px');
    expect(screen.getByText('100%')).toBeInTheDocument();

    touch(area, 'touchend', []);
    expect(doc.style.transform).toBe('');
    expect(doc.style.transformOrigin).toBe('');
    expect(screen.getByText('200%')).toBeInTheDocument();
  });

  it('clamps to the same bounds as the buttons', async () => {
    const area = await mountViewer();

    touch(area, 'touchstart', [
      [190, 300],
      [200, 300],
    ]);
    touch(area, 'touchmove', [
      [0, 300],
      [390, 300],
    ]);
    touch(area, 'touchend', []);

    expect(screen.getByText('300%')).toBeInTheDocument();
  });

  it('leaves a one-finger drag to native scrolling', async () => {
    const area = await mountViewer();

    touch(area, 'touchstart', [[100, 300]]);
    const move = touch(area, 'touchmove', [[100, 200]]);
    touch(area, 'touchend', []);

    expect(move.defaultPrevented).toBe(false);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('keeps zoom buttons working', async () => {
    await mountViewer();
    // The toolbar's second button; the zoom buttons carry no accessible name.
    const zoomIn = screen.getAllByRole('button')[1];
    if (!zoomIn) throw new Error('zoom-in button not rendered');
    fireEvent.click(zoomIn);
    expect(screen.getByText('125%')).toBeInTheDocument();
  });
});

describe('PdfViewer page rows', () => {
  // `justify-content: center` overflows a page wider than the pane equally to
  // BOTH sides, and overflow to the left of a scroll container cannot be
  // scrolled to: at 116% on a 390px screen the page began 148.5px off-screen
  // with scrollLeft at 0 — measured in a production build. The Page's own
  // `mx-auto` centres it instead; auto margins go to 0 rather than negative.
  it('does not centre pages with justify-content', async () => {
    await mountViewer();
    for (const page of screen.getAllByTestId('page')) {
      expect(page.parentElement?.className).not.toMatch(/justify-center/);
    }
  });
});
