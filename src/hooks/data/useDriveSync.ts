/**
 * useDriveSync - Hook for Google Drive sync status and control.
 *
 * Provides current auth status and toggle function.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { GoogleDriveService } from "../../services/drive/GoogleDriveService";

export interface UseDriveSyncResult {
  /** Whether Drive is authenticated and enabled */
  isEnabled: boolean;
  /** Whether status is being updated (auth flow in progress) */
  isLoading: boolean;
  /** Toggle sync on/off (triggers auth flow) */
  toggle: () => Promise<void>;
}

export function useDriveSync(): UseDriveSyncResult {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const driveService = GoogleDriveService.getInstance();

  // Initial check
  useEffect(() => {
    checkStatus();
  }, []);

  // Listen for storage changes to update UI across tabs/popups
  useEffect(() => {
    const handleStorageChange = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.driveSettings) {
        const settings = changes.driveSettings.newValue as
          | { isAuthorized?: boolean }
          | undefined;
        setIsEnabled(!!settings?.isAuthorized);
      }
    };

    chrome.storage.local.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.local.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const checkStatus = async () => {
    try {
      const settings = await driveService.getSettings();
      setIsEnabled(!!settings.isAuthorized);
    } catch (e) {
      console.error("[useDriveSync] Failed to check status:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = useCallback(async () => {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      setIsLoading(true);
      try {
        if (isEnabled) {
          // Disable: Sign out
          await driveService.signOut();
          setIsEnabled(false);
          toast.success("Odhlášeno z Google Drive");
        } else {
          // Enable: Sign in
          await driveService.authenticate();
          // State will be updated via storage listener, but we set it here too
          // to reflect immediate success
          setIsEnabled(true);
          toast.success("Připojeno ke Google Drive");
        }
        // If successful, break retry loop
        break;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(
          `[useDriveSync] Toggle failed (attempt ${
            attempt + 1
          }/${maxRetries}):`,
          message
        );

        // Retry only if context invalidated or connection failed
        if (
          attempt < maxRetries - 1 &&
          (message.includes("context invalidated") ||
            message.includes("restarting"))
        ) {
          // Exponential backoff: 200ms, 400ms, ...
          await new Promise((resolve) =>
            setTimeout(resolve, 200 * Math.pow(2, attempt))
          );
          attempt++;
          continue;
        }

        toast.error("Chyba při komunikaci s Google Drive");
      } finally {
        setIsLoading(false);
      }
    }
  }, [isEnabled, driveService]);

  return { isEnabled, isLoading, toggle };
}
