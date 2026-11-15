import { describe, it, expect } from 'vitest';
import { extensionReviewUrl } from '../extensionReviewUrl';

describe('extensionReviewUrl', () => {
  it("Chrome (and Edge, which installs from the Chrome Web Store) gets the listing's reviews", () => {
    expect(extensionReviewUrl('chrome-extension:')).toBe(
      'https://chromewebstore.google.com/detail/feildjaginpppijbpplcghalabdeibdb/reviews'
    );
  });

  it('Firefox gets the AMO page, where its rating control is', () => {
    expect(extensionReviewUrl('moz-extension:')).toBe(
      'https://addons.mozilla.org/firefox/addon/reis/'
    );
  });

  it('anything else (the dev webapp) falls back to Chrome', () => {
    expect(extensionReviewUrl('http:')).toContain('chromewebstore.google.com');
  });
});
