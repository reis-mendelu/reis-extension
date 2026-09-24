import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AdaptiveDrawer } from '../AdaptiveDrawer';
import { FeedbackModal } from '../../Feedback/FeedbackModal';
import { useAppStore } from '../../../store/useAppStore';

/**
 * Escape closes the side drawer — the branch a keyboard meets: the extension,
 * an iPad with a keyboard, and the Mac app, which reports `pointer: fine` and so
 * never takes the vaul branch. Before this the subject drawer in the extension
 * ignored the key entirely.
 */
const escape = () => fireEvent.keyDown(document, { key: 'Escape' });

describe('Escape on the side drawer', () => {
  beforeEach(() => {
    useAppStore.setState({ isTouch: false, isNarrow: false, language: 'cz' } as never);
  });

  it('closes an open drawer', () => {
    const onClose = vi.fn();
    render(
      <AdaptiveDrawer open onClose={onClose}>
        <p>content</p>
      </AdaptiveDrawer>
    );
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only the drawer on top — a classmate over the subject that listed them', () => {
    const subject = vi.fn();
    const classmate = vi.fn();
    const { rerender } = render(
      <>
        <AdaptiveDrawer open onClose={subject}>
          <p>subject</p>
        </AdaptiveDrawer>
        <AdaptiveDrawer open={false} onClose={classmate}>
          <p>classmate</p>
        </AdaptiveDrawer>
      </>
    );
    rerender(
      <>
        <AdaptiveDrawer open onClose={subject}>
          <p>subject</p>
        </AdaptiveDrawer>
        <AdaptiveDrawer open onClose={classmate}>
          <p>classmate</p>
        </AdaptiveDrawer>
      </>
    );
    escape();
    expect(classmate).toHaveBeenCalledTimes(1);
    expect(subject).not.toHaveBeenCalled();
  });

  it('leaves the key to a field inside that used it', () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <AdaptiveDrawer open onClose={onClose}>
        <input
          aria-label="nickname"
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.preventDefault();
          }}
        />
      </AdaptiveDrawer>
    );
    fireEvent.keyDown(getByRole('textbox'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the feedback form closes on Escape, above a drawer, leaving the drawer', () => {
    const drawer = vi.fn();
    const form = vi.fn();
    const { rerender } = render(
      <>
        <AdaptiveDrawer open onClose={drawer}>
          <p>subject</p>
        </AdaptiveDrawer>
        <FeedbackModal isOpen={false} onClose={form} />
      </>
    );
    rerender(
      <>
        <AdaptiveDrawer open onClose={drawer}>
          <p>subject</p>
        </AdaptiveDrawer>
        <FeedbackModal isOpen onClose={form} />
      </>
    );
    escape();
    expect(form).toHaveBeenCalledTimes(1);
    expect(drawer).not.toHaveBeenCalled();
  });
});
