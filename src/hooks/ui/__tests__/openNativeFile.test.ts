import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { openNativeFile } from '../openNativeFile';
import { openIsFileNatively } from '../../../mobile/openIsFile';

vi.mock('../../../mobile/openIsFile', () => ({
  openIsFileNatively: vi.fn(async () => ({ usedFallback: false, delivered: 'downloads' })),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

const t = (key: string) => key;

describe('openNativeFile success feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * The regression this pins: on Android the ONLY sign a download succeeded was
   * a system notification, and POST_NOTIFICATIONS is a runtime grant the app
   * never asked for. Measured on device: the file saved (577500 bytes into
   * content://media/external/downloads/...) while the student saw nothing at
   * all. Feedback must not depend on a permission that can be denied.
   */
  it('confirms a Downloads delivery with a toast', async () => {
    vi.mocked(openIsFileNatively).mockResolvedValue({
      usedFallback: false,
      delivered: 'downloads',
    });

    await openNativeFile('slozka.pl?download=1', 'Test.open', t);

    expect(toast.success).toHaveBeenCalledWith('course.file.savedToDownloads');
    expect(toast.error).not.toHaveBeenCalled();
  });

  /**
   * iOS hands the file to the share sheet, which is itself the confirmation.
   * A toast on top of it would be noise about something the student can see.
   */
  it('stays silent for a share-sheet delivery', async () => {
    vi.mocked(openIsFileNatively).mockResolvedValue({
      usedFallback: false,
      delivered: 'share',
    });

    await openNativeFile('slozka.pl?download=1', 'Test.open', t);

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('still reports a failure and never claims success', async () => {
    vi.mocked(openIsFileNatively).mockRejectedValue(new Error('IS did not return a file'));

    await openNativeFile('slozka.pl?download=1', 'Test.open', t);

    expect(toast.error).toHaveBeenCalledWith('course.file.openFailed');
    expect(toast.success).not.toHaveBeenCalled();
  });

  /**
   * A lapsed session already raised the recovery prompt with the token the
   * request used, so this path must stay quiet — and must certainly not
   * announce a download that did not happen.
   */
  it('stays silent on a lapsed session', async () => {
    const err = new Error('HTTP 401') as Error & { sessionExpired?: boolean };
    err.sessionExpired = true;
    vi.mocked(openIsFileNatively).mockRejectedValue(err);

    await openNativeFile('slozka.pl?download=1', 'Test.open', t);

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
