/**
 * Where the extension's "Ohodnotit reIS" link goes: the store the student
 * installed from. The extension has no in-app rating dialog like the phone's
 * (src/mobile/storeReview.ts), so it is a plain link the student chooses.
 *
 * The protocol of the page reIS runs in tells the two apart: the iframe app is
 * `moz-extension:` on Firefox and `chrome-extension:` on Chrome and Edge. Edge
 * is not a store target; it installs from the Chrome Web Store.
 *
 * Firefox gets the add-on page, not `/reviews/`: AMO's rating control sits on
 * the add-on page, and its reviews list only reads.
 */
const CHROME = 'https://chromewebstore.google.com/detail/feildjaginpppijbpplcghalabdeibdb/reviews';
const FIREFOX = 'https://addons.mozilla.org/firefox/addon/reis/';

export function extensionReviewUrl(protocol: string): string {
  return protocol === 'moz-extension:' ? FIREFOX : CHROME;
}
