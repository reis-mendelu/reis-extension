import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SheetHeader } from '../SheetHeader';

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('SheetHeader', () => {
  it('renders the title block', () => {
    render(<SheetHeader title="Internet věcí" eyebrow="EBC-IV" subtitle="Ing. Gallus" />);
    expect(screen.getByText('Internet věcí')).toBeInTheDocument();
    expect(screen.getByText('EBC-IV')).toBeInTheDocument();
  });

  /**
   * Load-bearing and easy to delete by accident. With the default touch-action
   * the browser claims a downward drag as a pan and fires pointercancel partway
   * through — measured on an Android device, a 350px swipe reached Sheet's
   * handler as ~20px, well under the dismiss threshold, so the drag pill this
   * component renders was pure decoration. Scoped to the header on purpose:
   * putting it on the panel would disable scrolling in the content below.
   */
  it('opts the header out of browser touch panning so the sheet can be dragged', () => {
    const { container } = render(<SheetHeader title="Internet věcí" />);
    const header = container.firstElementChild as HTMLElement;
    expect(header.className).toContain('touch-none');
  });
});

/**
 * A screen is left by going back, not by being dismissed, so its header shows a
 * back chevron rather than a close X — and drops the drag pill, which would be
 * promising a gesture the screen variant deliberately does not have.
 */
describe('SheetHeader onBack', () => {
  it('renders a back control instead of the close X', () => {
    const onBack = vi.fn();
    render(<SheetHeader title="Internet věcí" onBack={onBack} />);
    fireEvent.click(screen.getByLabelText('mobile.sheet.back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('mobile.sheet.close')).not.toBeInTheDocument();
  });

  it('drops the drag pill, which a screen cannot honour', () => {
    const { container } = render(<SheetHeader title="Internet věcí" onBack={() => {}} />);
    expect(container.querySelector('.w-9.rounded-full')).toBeNull();
  });

  it('keeps the pill and the X for ordinary sheets', () => {
    const { container } = render(<SheetHeader title="Internet věcí" onClose={() => {}} />);
    expect(screen.getByLabelText('mobile.sheet.close')).toBeInTheDocument();
    expect(container.querySelector('.w-9.rounded-full')).not.toBeNull();
  });
});

/**
 * Back and close are alternatives, not a pair — a screen is left by going back,
 * a sheet by being closed. Rendering both would put two competing controls in
 * one header, so onBack wins and the X is suppressed.
 */
it('renders only the back control when given both onBack and onClose', () => {
  render(<SheetHeader title="Internet věcí" onBack={() => {}} onClose={() => {}} />);
  expect(screen.getByLabelText('mobile.sheet.back')).toBeInTheDocument();
  expect(screen.queryByLabelText('mobile.sheet.close')).not.toBeInTheDocument();
});
