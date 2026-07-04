import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { buildConfirmationUrl, downloadConfirmation } from '../confirmationOfStudy';

describe('buildConfirmationUrl', () => {
  it('builds the Czech instant-print URL without jazyk=eng', () => {
    expect(buildConfirmationUrl('143752', 'cz')).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1;studium=143752;lang=cz'
    );
  });

  it('adds jazyk=eng when lang is en', () => {
    expect(buildConfirmationUrl('143752', 'en')).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1;jazyk=eng;studium=143752;lang=en'
    );
  });
});

describe('downloadConfirmation', () => {
  let srcSetter: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    srcSetter = vi.spyOn(HTMLIFrameElement.prototype, 'src', 'set');
  });
  afterEach(() => {
    srcSetter.mockRestore();
    vi.useRealTimers();
  });

  it('appends a hidden iframe navigating to the given URL', () => {
    downloadConfirmation('https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk=1;studium=1;lang=cz');
    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe!.style.display).toBe('none');
    expect(srcSetter).toHaveBeenCalledTimes(1);
  });

  it('reuses the same iframe across calls to different URLs instead of piling up new ones', () => {
    downloadConfirmation('https://is.mendelu.cz/first');
    downloadConfirmation('https://is.mendelu.cz/second');
    expect(document.querySelectorAll('iframe').length).toBe(1);
    expect(srcSetter).toHaveBeenCalledTimes(2);
  });

  it('ignores a duplicate call for the same URL fired immediately after (double-tap/ghost-click guard)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    downloadConfirmation('https://is.mendelu.cz/dup');
    vi.setSystemTime(50); // 50ms later -- same click's ghost-click window
    downloadConfirmation('https://is.mendelu.cz/dup');
    // Only ONE real navigation should have happened, not two.
    expect(srcSetter).toHaveBeenCalledTimes(1);
  });

  it('allows a repeat call for the same URL after the dedupe window has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    downloadConfirmation('https://is.mendelu.cz/dup2');
    vi.setSystemTime(3000);
    downloadConfirmation('https://is.mendelu.cz/dup2');
    expect(srcSetter).toHaveBeenCalledTimes(2);
  });
});
