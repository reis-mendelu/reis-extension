/**
 * Offscreen document script for background Google Drive sync.
 *
 * This runs in an offscreen document context, allowing:
 * - Full DOM/Blob API access
 * - File operations without visible tabs
 * - Background sync even when IS Mendelu tabs are closed
 */

import {
  GoogleDriveService,
  type DriveSettings,
} from "./services/drive/GoogleDriveService";
import { DRIVE_CONSTANTS } from "./constants/drive";
import { cleanSubjectFolderName, hasFilesToSync } from "./utils/driveUtils";
// import { StorageService, STORAGE_KEYS } from "./services/storage"; // Removed - unused

// ============================================================================
// Types
// ============================================================================

interface SubjectData {
  subjectCode: string;
  fullName: string;
  folderUrl?: string;
}

interface FileGroup {
  subfolder?: string;
  files: {
    name: string;
    link: string;
  }[];
}

interface SyncProgress {
  isSyncing: boolean;
  lastSyncTime: number | null;
  error: string | null;
  currentSubject?: string;
  progress?: { current: number; total: number };
}

// ============================================================================
// Message Passing Helpers
// (Offscreen documents don't have direct chrome.storage access)
// ============================================================================

/**
 * Send message to background service worker and get response.
 */
async function sendToBackground<T>(message: object): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response as T);
      }
    });
  });
}

/**
 * Get storage values via background service worker.
 */
async function getStorage<T>(keys: string[]): Promise<T> {
  return sendToBackground<T>({ type: "GET_STORAGE", keys });
}

/**
 * Set storage values via background service worker.
 */
async function setStorage(data: Record<string, unknown>): Promise<void> {
  await sendToBackground({ type: "SET_STORAGE", data });
}

/**
 * Get Drive settings via background service worker.
 */
async function getDriveSettings(): Promise<DriveSettings> {
  return sendToBackground<DriveSettings>({ type: "GET_DRIVE_SETTINGS" });
}

/**
 * Save Drive settings via background service worker.
 */
async function saveDriveSettings(settings: DriveSettings): Promise<void> {
  await sendToBackground({ type: "SAVE_DRIVE_SETTINGS", settings });
}

// ============================================================================
// Message Handler
// ============================================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log(`[Offscreen] Message received: ${message.type}`);

  if (message.target !== "offscreen") return false;

  if (message.type === "EXECUTE_DRIVE_SYNC") {
    console.log("[Offscreen] ✅ Received EXECUTE_DRIVE_SYNC, starting sync...");

    // Extract data from payload (passed from background via content script)
    const { subjects, files } = message.payload || {};
    const subjectCount = subjects ? Object.keys(subjects).length : 0;
    const fileCount = files ? Object.keys(files).length : 0;
    console.log(
      `[Offscreen] Payload: ${subjectCount} subjects, ${fileCount} file groups`
    );

    executeSync(subjects, files)
      .then(() => {
        console.log("[Offscreen] ✅ Sync completed successfully");
        sendResponse({ success: true });
      })
      .catch((e) => {
        console.error(`[Offscreen] ❌ Sync failed: ${e.message}`);
        sendResponse({ error: e.message });
      });
    return true; // Async response
  }

  return false;
});

// ============================================================================
// Sync Logic
// ============================================================================

/**
 * Execute full Drive sync for all subjects.
 */
async function executeSync(
  subjects: Record<string, SubjectData> | null,
  files: Record<string, unknown[]> | null
): Promise<void> {
  console.log("[Offscreen] ========== Starting Drive sync ==========");

  const driveService = GoogleDriveService.getInstance();

  // Check authorization (use message passing, not direct storage)
  const settings = await getDriveSettings();
  console.log(
    "[Offscreen] Current settings:",
    JSON.stringify(settings, null, 2)
  );

  if (!settings.isAuthorized) {
    console.log("[Offscreen] ❌ Drive not authorized, skipping sync");
    return;
  }

  // If no root folder configured, create one
  if (!settings.rootFolderId) {
    console.log("[Offscreen] No root folder configured, creating one...");
    try {
      const folderName =
        settings.rootFolderName || DRIVE_CONSTANTS.DEFAULT_FOLDER_NAME;

      // Check if folder already exists
      let folder = await driveService.searchFolder(folderName, "root");
      if (folder) {
        console.log(`[Offscreen] Found existing folder: ${folder.id}`);
      } else {
        folder = await driveService.createFolder(folderName, "root");
        console.log(`[Offscreen] Created new folder: ${folder.id}`);
      }

      // Update settings with folder info
      settings.rootFolderId = folder.id;
      settings.rootFolderName = folderName;
      await saveDriveSettings(settings);
      console.log("[Offscreen] ✅ Root folder configured:", folderName);
    } catch (e) {
      console.error("[Offscreen] ❌ Failed to create root folder:", e);
      await updateSyncStatus({ error: "Failed to create root folder" });
      return;
    }
  }

  // Validate root folder still exists
  console.log("[Offscreen] Validating root folder:", settings.rootFolderId);
  const folderValid = await driveService.validateFolderId(
    settings.rootFolderId
  );
  if (!folderValid) {
    console.log(
      "[Offscreen] ⚠️ Root folder invalid, searching for existing..."
    );
    const existing = await driveService.searchFolder(
      settings.rootFolderName || DRIVE_CONSTANTS.DEFAULT_FOLDER_NAME,
      "root"
    );
    if (existing) {
      settings.rootFolderId = existing.id;
      await saveDriveSettings(settings);
      console.log("[Offscreen] ✅ Found existing folder:", existing.id);
    } else {
      console.error("[Offscreen] ❌ Root folder not found");
      await updateSyncStatus({ error: "Root folder not found" });
      return;
    }
  }

  console.log(
    "[Offscreen] Subjects found:",
    subjects ? Object.keys(subjects).length : 0
  );

  if (!subjects || Object.keys(subjects).length === 0) {
    console.log("[Offscreen] No subjects to sync");
    await updateSyncStatus({ lastSyncTime: Date.now() });
    return;
  }

  await updateSyncStatus({ isSyncing: true });

  const subjectList = Object.values(subjects);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < subjectList.length; i++) {
    const subject = subjectList[i];
    if (!subject.subjectCode) continue;

    await updateSyncStatus({
      currentSubject: subject.fullName,
      progress: { current: i + 1, total: subjectList.length },
    });

    try {
      // Get files for this subject from passed data
      const subjectFiles = files
        ? (files[subject.subjectCode] as FileGroup[])
        : [];
      await syncSubject(subject, subjectFiles, settings, driveService);
      successCount++;
    } catch (e) {
      console.error(`[Offscreen] Failed to sync ${subject.subjectCode}:`, e);
      errorCount++;
    }
  }

  console.log(
    `[Offscreen] Sync complete. Success: ${successCount}, Errors: ${errorCount}`
  );
  await updateSyncStatus({
    isSyncing: false,
    lastSyncTime: Date.now(),
    error: errorCount > 0 ? `${errorCount} subjects failed to sync` : null,
  });
}

/**
 * Sync a single subject's files to Drive.
 */
/**
 * Sync a single subject's files to Drive.
 */
async function syncSubject(
  subject: SubjectData,
  fileGroups: FileGroup[] | null,
  settings: DriveSettings,
  driveService: GoogleDriveService
): Promise<void> {
  // Skip if no files
  if (!hasFilesToSync(fileGroups)) {
    console.log(`[Offscreen] ${subject.subjectCode}: No files, skipping`);
    return;
  }

  // Clean folder name (remove subject code)
  const folderName = cleanSubjectFolderName(subject.fullName);

  // Get or create subject folder
  let subjectFolder = await driveService.searchFolder(
    folderName,
    settings.rootFolderId!
  );
  if (!subjectFolder) {
    subjectFolder = await driveService.createFolder(
      folderName,
      settings.rootFolderId!
    );
  }

  // Flatten files
  const allFiles: { name: string; link: string; subfolder?: string }[] = [];
  fileGroups?.forEach((group) => {
    group.files.forEach((f) => {
      allFiles.push({
        name: f.name,
        link: f.link,
        subfolder: group.subfolder,
      });
    });
  });

  console.log(
    `[Offscreen] ${subject.subjectCode}: Syncing ${allFiles.length} files`
  );

  // Sync files with concurrency limit
  const CONCURRENCY = DRIVE_CONSTANTS.CONCURRENCY_LIMIT;
  const queue = [...allFiles];
  const activePromises: Promise<void>[] = [];

  const processFile = async (file: (typeof allFiles)[0]) => {
    try {
      // Fetch file content
      console.log(`[Offscreen] Fetching ${file.name} from ${file.link}`);
      const response = await fetch(file.link, { credentials: "include" });

      console.log(
        `[Offscreen] Response for ${file.name}: status=${
          response.status
        }, type=${response.headers.get("content-type")}, redirected=${
          response.redirected
        }`
      );

      if (!response.ok) {
        console.warn(
          `[Offscreen] Failed to download: ${file.name} (status ${response.status})`
        );
        return;
      }

      // Check if we got the login page
      const contentType = response.headers.get("content-type");
      let blob: Blob;

      if (contentType && contentType.includes("text/html")) {
        console.warn(
          `[Offscreen] ⚠️ Got HTML (login page) for ${file.name}. Attempting fallback download via Content Script...`
        );

        // Fallback: Ask Content Script to download (via Background)
        const result = await chrome.runtime.sendMessage({
          type: "PROXY_DOWNLOAD_FILE",
          url: file.link,
        });

        if (result && result.success && result.dataUrl) {
          console.log("[Offscreen] ✅ Fallback download successful!");
          const res = await fetch(result.dataUrl);
          blob = await res.blob();
        } else {
          console.error(
            "[Offscreen] ❌ Fallback failed:",
            result?.error || "Unknown error"
          );
          return;
        }
      } else {
        blob = await response.blob();
      }

      console.log(`[Offscreen] Blob size for ${file.name}: ${blob.size} bytes`);

      // (Duplicates removed)

      // Upload to Drive
      await driveService.uploadOrUpdateFile(
        blob,
        file.name,
        subjectFolder!.id,
        file.subfolder,
        blob.type || "application/octet-stream"
      );

      // Add delay between requests
      await new Promise((resolve) =>
        setTimeout(resolve, DRIVE_CONSTANTS.INTER_REQUEST_DELAY_MS)
      );
    } catch (e) {
      console.error(`[Offscreen] Failed to sync file ${file.name}:`, e);
    }
  };

  while (queue.length > 0 || activePromises.length > 0) {
    // Start new tasks up to concurrency limit
    while (queue.length > 0 && activePromises.length < CONCURRENCY) {
      const file = queue.shift()!;
      const promise = processFile(file).then(() => {
        const idx = activePromises.indexOf(promise);
        if (idx > -1) activePromises.splice(idx, 1);
      });
      activePromises.push(promise);
    }

    // Wait for at least one to complete
    if (activePromises.length > 0) {
      await Promise.race(activePromises);
    }
  }
}

// ============================================================================
// Storage Helpers (using message passing to background)
// ============================================================================

// (Storage helpers removed - data passed via message payload)

async function updateSyncStatus(update: Partial<SyncProgress>): Promise<void> {
  try {
    const result = await getStorage<Record<string, unknown>>([
      "driveSyncStatus",
    ]);
    const current: SyncProgress = (result.driveSyncStatus as SyncProgress) || {
      isSyncing: false,
      lastSyncTime: null,
      error: null,
    };

    await setStorage({
      driveSyncStatus: { ...current, ...update },
    });
  } catch (e) {
    console.error("[Offscreen] Failed to update sync status:", e);
  }
}

console.log("[Offscreen] Script loaded");
