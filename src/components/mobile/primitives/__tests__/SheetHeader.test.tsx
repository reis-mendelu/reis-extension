import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    expect(header.style.touchAction).toBe('none');
  });
});
