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

  it('puts a leading element before the title, in the same row', () => {
    render(<SheetHeader title="Jan Novák" leading={<span data-testid="avatar">JN</span>} />);
    const avatar = screen.getByTestId('avatar');
    const title = screen.getByText('Jan Novák');
    // Same row: the title block is a later sibling of the leading slot.
    expect(avatar.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(avatar.closest('.flex.items-start')).toBe(title.closest('.flex.items-start'));
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

/**
 * The subject sheet's title links to the subject's syllabus in IS, as the
 * extension's drawer title always has. Opt-in per sheet: most sheets share this
 * header and have no page in IS to point at.
 *
 * Left inside the touch-none header on purpose. touch-action only stops the
 * browser panning; a tap still fires its click. On a sheet that drags, the
 * click that ends a drag is swallowed by useSheetDrag's click capture.
 */
describe('SheetHeader titleHref', () => {
  const href = 'https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=159410;lang=cz';

  it('makes the title a link that leaves through the external-link handler', () => {
    render(<SheetHeader title="Algoritmizace" titleHref={href} onBack={() => {}} />);
    const link = screen.getByRole('link', { name: /Algoritmizace/ });
    expect(link).toHaveAttribute('href', href);
    // target=_blank is what installExternalLinkHandler intercepts on native.
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps the title plain text without one', () => {
    render(<SheetHeader title="Algoritmizace" onBack={() => {}} />);
    expect(screen.getByText('Algoritmizace').closest('a')).toBeNull();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
