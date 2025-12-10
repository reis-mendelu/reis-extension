/**
 * Google Drive constants for synchronization.
 */

export const DRIVE_CONSTANTS = {
  /** OAuth2 Client ID (Web application type for launchWebAuthFlow) */
  CLIENT_ID:
    "997458327786-9aj0ftqndiv41uth7al38vjtkgld4ubr.apps.googleusercontent.com",

  /** Root folder name where all synced files are stored */
  DEFAULT_FOLDER_NAME: "Soubory Mendelu (Synchronizováno)",

  /** MIME type for Google Drive folders */
  MIME_TYPE_FOLDER: "application/vnd.google-apps.folder",

  /** OAuth2 scopes - drive.file only accesses files created by this app */
  SCOPES: [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
  ],

  /** Delay between API requests to avoid rate limits (ms) */
  INTER_REQUEST_DELAY_MS: 100,

  /** Maximum concurrent file uploads */
  CONCURRENCY_LIMIT: 3,

  /** Auto-sync interval in minutes */
  SYNC_INTERVAL_MINUTES: 5,
};
