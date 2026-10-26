import { describe, it, expect } from 'vitest';
import { isPersonProfileUrl } from '../isPersonProfileUrl';

describe('isPersonProfileUrl', () => {
  it("builds the person's IS page in the app's language", () => {
    expect(isPersonProfileUrl('42', 'cz')).toBe(
      'https://is.mendelu.cz/auth/lide/clovek.pl?id=42;lang=cz'
    );
    expect(isPersonProfileUrl(42, 'en')).toBe(
      'https://is.mendelu.cz/auth/lide/clovek.pl?id=42;lang=en'
    );
  });
});
