import { describe, it, expect } from 'vitest';
import { toDirectDownloadUrl } from '../isDocumentUrl';

// Shapes taken from a live IS response (folder 153920, document 359057).
const VIEWER =
  'https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?id=153920;on=0;dok=359057;serializace=203435621:1785671035:120344:user:f344a126;lang=cz';
const DIRECT =
  'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=359057;id=153920;z=1;lang=cz';

describe('toDirectDownloadUrl', () => {
  it('rewrites a viewer URL to the direct download, so reIS never shows the old IS', () => {
    expect(toDirectDownloadUrl(VIEWER)).toBe(DIRECT);
  });

  it('drops the session-scoped serializace token, which the download does not need', () => {
    expect(toDirectDownloadUrl(VIEWER)).not.toContain('serializace');
  });

  it('preserves the requested language', () => {
    expect(toDirectDownloadUrl(VIEWER.replace('lang=cz', 'lang=en'))).toContain('lang=en');
  });

  it('defaults to cz when the viewer URL carries no lang', () => {
    expect(
      toDirectDownloadUrl(
        'https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?id=1;dok=2;serializace=x',
      ),
    ).toBe('https://is.mendelu.cz/auth/dok_server/slozka.pl?download=2;id=1;z=1;lang=cz');
  });

  it('handles &-separated params as well as IS\'s usual ;', () => {
    expect(
      toDirectDownloadUrl(
        'https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?id=153920&on=0&dok=359057&lang=cz',
      ),
    ).toBe(DIRECT);
  });

  it('returns an already-direct download URL unchanged', () => {
    expect(toDirectDownloadUrl(DIRECT)).toBe(DIRECT);
  });

  it('returns null for a URL it cannot rewrite, rather than guessing', () => {
    expect(toDirectDownloadUrl('https://is.mendelu.cz/auth/student/moje_studium.pl')).toBeNull();
  });

  it('returns null when dok is present but id is missing', () => {
    expect(
      toDirectDownloadUrl('https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?dok=359057'),
    ).toBeNull();
  });
});
