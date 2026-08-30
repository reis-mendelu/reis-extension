import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MobileBulletinOverlay } from '../MobileBulletinOverlay';

/**
 * The overlay must not re-decide "am I mobile" from the viewport width.
 *
 * Both call sites have already made that decision in JS before rendering it:
 * BulletinBanner only reaches it under `isNarrow` (`max-width: 767px`), and
 * CalendarScreen is inside the phone tree, which the native app renders at ANY
 * width (see resolvePhoneViewport — the app ships only the phone tree, so an
 * iPad runs it at 810–1080pt).
 *
 * A `md:hidden` on the root therefore did nothing in the extension and made the
 * overlay `display: none` on every iPad: tapping the vývěska pin flipped
 * `bulletinExpanded` to true, mounted this component, and showed a 0×0 box.
 * Verified in the dev webapp at 810px before the fix.
 */
describe('MobileBulletinOverlay', () => {
  const posts = [{ title: 'Post', categories: ['Inzerce'], url: 'https://example.com/1' }];

  it('does not hide itself by viewport width — the caller has already gated', () => {
    render(
      <MobileBulletinOverlay
        isOpen
        onClose={() => {}}
        posts={posts}
        loading={false}
        error={false}
      />
    );

    const root = screen.getByText('Post').closest('div.fixed');
    expect(root).not.toBeNull();
    const hiding = [...root!.classList].filter((c) => /^(sm|md|lg|xl|2xl):hidden$/.test(c));
    expect(hiding).toEqual([]);
  });
});
