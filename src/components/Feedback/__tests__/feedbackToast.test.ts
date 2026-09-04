import { describe, it, expect } from 'vitest';
import { feedbackErrorKey } from '../feedbackErrorKey';

describe('feedbackErrorKey', () => {
  // All three failures showed one toast: "Nepodařilo se odeslat zpětnou
  // vazbu." A student reads that as "it broke, try again" and retries — which
  // for the two that are not breakages is exactly the wrong move, and for the
  // rate limit cannot succeed however many times they do it.
  it('tells a student who is offline what to do about it', () => {
    expect(feedbackErrorKey('offline')).toBe('feedback.toastOffline');
  });

  it('says "too many, wait" rather than "failed" for the flood guard', () => {
    expect(feedbackErrorKey('rate_limited')).toBe('feedback.toastRateLimited');
  });

  // An upstream error IS a breakage and keeps the original copy.
  it('keeps the plain failure for a genuine upstream error', () => {
    expect(feedbackErrorKey('upstream')).toBe('feedback.toastError');
    expect(feedbackErrorKey('invalid')).toBe('feedback.toastError');
  });

  // The catch-all path in the modal has no error value at all.
  it('falls back to the plain failure for anything else', () => {
    expect(feedbackErrorKey(undefined)).toBe('feedback.toastError');
  });
});
