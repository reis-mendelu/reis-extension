import { describe, it, expect, vi } from 'vitest';
import {
  deliverEduroamProfile,
  PROFILES_DOWNLOADED_URL,
  PROFILE_SETTLE_MS,
  type ProfileDelivery,
} from '../eduroamProfile';
import { ShareCanceledError } from '../../errors/shareCanceled';

function deps(over: Partial<ProfileDelivery> = {}): ProfileDelivery {
  return {
    kind: 'capacitor',
    anchorSave: vi.fn(),
    nativeSave: vi.fn(async () => 'file:///c/Documents/eduroam-reis.mobileconfig'),
    assertExists: vi.fn(async () => true),
    share: vi.fn(async () => {}),
    isMac: vi.fn(async () => false),
    openOnMac: vi.fn(async () => true),
    saveWithPanel: vi.fn(async () => {}),
    wait: vi.fn(async () => {}),
    ...over,
  };
}

const blob = () => new Blob(['<plist/>'], { type: 'application/x-apple-aspen-config' });

describe('deliverEduroamProfile', () => {
  it('downloads through the anchor off Capacitor, where a[download] works', async () => {
    const d = deps({ kind: 'web' });
    await deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d);
    expect(d.anchorSave).toHaveBeenCalled();
    expect(d.nativeSave).not.toHaveBeenCalled();
    expect(d.share).not.toHaveBeenCalled();
  });

  /**
   * A blob URL and `a[download]` do NOTHING inside a WKWebView — the same
   * measured fact `saveDocument.ts` exists for. On a Mac that was the whole
   * feature failing silently, so the app writes the file itself.
   */
  it('writes the file natively inside the app', async () => {
    const d = deps();
    await deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d);
    expect(d.nativeSave).toHaveBeenCalledWith(expect.any(Blob), 'eduroam-reis.mobileconfig');
    expect(d.anchorSave).not.toHaveBeenCalled();
  });

  /**
   * The app's Documents directory is NOT exposed to Files: `UIFileSharingEnabled`
   * is absent from Info.plist, so a profile written there sits in a container
   * path no student will ever open. Handing it to the share sheet is what makes
   * it reachable — and on macOS, opening the saved .mobileconfig is what starts
   * the install in System Settings. Writing without sharing would be a worse
   * outcome than the error banner it replaces.
   */
  it('hands the saved file to the share sheet, or the student cannot reach it', async () => {
    const d = deps();
    await deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d);
    expect(d.share).toHaveBeenCalledWith('file:///c/Documents/eduroam-reis.mobileconfig');
  });

  it('shares only after the write is confirmed', async () => {
    const order: string[] = [];
    const d = deps({
      nativeSave: vi.fn(async () => {
        order.push('save');
        return 'file:///c/x';
      }),
      assertExists: vi.fn(async () => {
        order.push('assert');
        return true;
      }),
      share: vi.fn(async () => {
        order.push('share');
      }),
    });
    await deliverEduroamProfile(blob(), 'x.mobileconfig', d);
    expect(order).toEqual(['save', 'assert', 'share']);
  });

  /** Same reason saveBlob asserts: a silent no-op is the failure that ships. */
  it('throws when the file did not land, rather than sharing nothing', async () => {
    const d = deps({ assertExists: vi.fn(async () => false) });
    await expect(deliverEduroamProfile(blob(), 'x.mobileconfig', d)).rejects.toThrow(
      /x\.mobileconfig/
    );
    expect(d.share).not.toHaveBeenCalled();
  });

  /**
   * A dismissed share sheet is a choice, not a fault. The file is already on
   * disk and the sheet's instructions still apply, so swallowing this keeps the
   * flow on its success branch instead of showing an error for a tap the
   * student deliberately made.
   */
  it('treats a dismissed share sheet as done, not as a failure', async () => {
    const d = deps({ share: vi.fn(async () => Promise.reject(new Error('canceled'))) });
    await expect(deliverEduroamProfile(blob(), 'x.mobileconfig', d)).resolves.toBe('shared');
  });

  describe('on a Mac', () => {
    const mac = (over: Partial<ProfileDelivery> = {}) =>
      deps({ isMac: vi.fn(async () => true), ...over });

    /**
     * Measured on the Mac app (macOS 26, 2026-10-26): `UIApplication.open` on
     * the written .mobileconfig hands it to ProfileHelper, and mdmclient files
     * it as "Profile Downloaded" under System Settings › General › Device
     * Management. Then the settings link opens that pane, so the student lands
     * on the Install button with no file to find and no share sheet.
     */
    it('hands the profile to macOS and opens Device Management, with no share sheet', async () => {
      const d = mac();
      await expect(deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d)).resolves.toBe(
        'opened'
      );
      expect(d.openOnMac).toHaveBeenNthCalledWith(
        1,
        'file:///c/Documents/eduroam-reis.mobileconfig'
      );
      expect(d.openOnMac).toHaveBeenNthCalledWith(2, PROFILES_DOWNLOADED_URL);
      expect(d.share).not.toHaveBeenCalled();
      expect(d.saveWithPanel).not.toHaveBeenCalled();
    });

    /**
     * The open resolves when the file is handed over, before macOS has listed
     * it; the pane opened at once could show nothing yet. So: the open first,
     * fully, then the settle wait, then the pane — never overlapping.
     */
    it('opens the settings pane only after the open resolved and the settle wait', async () => {
      const order: string[] = [];
      let finishOpen: (v: boolean) => void = () => {};
      const d = mac({
        openOnMac: vi.fn((url: string) => {
          order.push(url === PROFILES_DOWNLOADED_URL ? 'pane' : 'open:start');
          if (url === PROFILES_DOWNLOADED_URL) return Promise.resolve(true);
          return new Promise<boolean>((r) => {
            finishOpen = (v) => {
              order.push('open:done');
              r(v);
            };
          });
        }),
        wait: vi.fn(async (ms: number) => {
          order.push(`wait:${ms}`);
        }),
      });
      const done = deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d);
      await new Promise((r) => setTimeout(r, 0));
      expect(order).toEqual(['open:start']);
      finishOpen(true);
      await done;
      expect(order).toEqual(['open:start', 'open:done', `wait:${PROFILE_SETTLE_MS}`, 'pane']);
      expect(PROFILE_SETTLE_MS).toBeGreaterThanOrEqual(1000);
    });

    it('falls back to the Save panel when macOS will not open the profile', async () => {
      const d = mac({ openOnMac: vi.fn(async () => false) });
      await expect(deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d)).resolves.toBe(
        'saved'
      );
      expect(d.wait).not.toHaveBeenCalled();
      expect(d.saveWithPanel).toHaveBeenCalledWith('file:///c/Documents/eduroam-reis.mobileconfig');
      expect(d.openOnMac).toHaveBeenCalledTimes(1);
      expect(d.share).not.toHaveBeenCalled();
    });

    /** Only a profile is something macOS installs; any other file is saved. */
    it('saves a non-profile file with the Save panel', async () => {
      const d = mac();
      await deliverEduroamProfile(blob(), 'eduroam-reis.eap-config', d);
      expect(d.saveWithPanel).toHaveBeenCalled();
      expect(d.openOnMac).not.toHaveBeenCalled();
    });

    /**
     * Unlike a dismissed iPhone share sheet, a cancelled Save panel leaves the
     * profile only in the app's container, which no student can reach. Nothing
     * was delivered, so the flow must not report it as done.
     */
    it('rejects with ShareCanceledError when the Save panel is cancelled', async () => {
      const d = mac({
        openOnMac: vi.fn(async () => false),
        saveWithPanel: vi.fn(async () => {
          throw new ShareCanceledError();
        }),
      });
      await expect(
        deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d)
      ).rejects.toBeInstanceOf(ShareCanceledError);
    });

    it('keeps the share sheet on an iPhone or iPad', async () => {
      const d = deps({ isMac: vi.fn(async () => false) });
      await expect(deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d)).resolves.toBe(
        'shared'
      );
      expect(d.share).toHaveBeenCalled();
      expect(d.openOnMac).not.toHaveBeenCalled();
    });
  });
});
