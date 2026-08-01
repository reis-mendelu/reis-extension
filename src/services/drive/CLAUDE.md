# Google Drive Backup

One-way mirror of the student's **current-semester** IS files into their own Google Drive. Phase 0 (OAuth plumbing), Phase 1 (file backup), and Phase 2 (notes → one Google Doc + JSON sidecar per subject) are all done.

> The two hard prohibitions — never escalate past the `drive.file` scope, never build bidirectional sync — live in the root `CLAUDE.md`.

- **Scope = `drive.file` only** — non-sensitive, no Google verification/CASA. The app can see only files it created.
- **Auth:** `launchWebAuthFlow` + PKCE, run in the **background SW** (`chrome.identity` is not exposed to the iframe). Token exchange/refresh goes through the **Supabase `google-oauth` Edge Function**, which holds `GOOGLE_CLIENT_SECRET` — the secret never ships in the bundle. Tokens live in `chrome.storage.local`.
- **Where it runs:** the **content script** (`syncService.ts` → `syncDriveBackup`), the only context with IS cookies (binary `fetchWithAuth`), the Google token, and the googleapis host permission. It reuses listings already in `cachedData.files` — no extra IS crawling.
- **Idempotency (the core invariant):** the manifest (`reis_drive_manifest` in `chrome.storage.local`) is a **cache, not the source of truth**. Folders are **find-or-create by name+parent**; files are deduped by an **`appProperties.reisLink` hash** checked before upload. An interrupted run therefore cannot create duplicates. **Never dedupe files by filename** — IS legitimately serves many files with the same display name (e.g. several "Materiály"); only the IS-link hash is unique. Structure mirrors IS one level: `reIS/<CODE - name>/<subfolder?>/<file>`.

| Role | File |
|------|------|
| Pure diff/flatten/hash logic | `src/services/drive/driveDiff.ts` (tested) |
| Manifest persistence | `src/services/drive/driveManifest.ts` |
| Orchestrator (content script) | `src/services/drive/driveBackup.ts` |
| Notes backup (Phase 2) + Docs renderer | `src/services/drive/driveNotesBackup.ts`, `src/services/drive/notesDoc.ts` |
| Drive REST (find/ensure/upload/delete) | `src/api/googleDrive.ts` |
| OAuth + token refresh via proxy | `src/api/googleAuth.ts` |
| Backup UI (status + connect) | `src/components/SubjectFileDrawer/Header/DriveBackupStatus.tsx`, `src/hooks/data/useDriveBackup.ts` |

**Dev surface:** backup status/connect UI lives in the file drawer header (`DriveBackupStatus.tsx`); the standalone `GoogleDevPanel` was removed (the dev-panel era ended in commit `7a8ec01`). `resetDriveBackup()` (delete `reIS` root + clear manifest for a clean repave) still exists in `driveBackup.ts` but is no longer wired to UI — call it from a temporary hook if you need a repave. `VITE_GOOGLE_DEV=true` still gates dev-only behavior.

> **Operational gotcha:** the OAuth **consent screen must be "In production"** (not "Testing"), or every user's refresh token expires after 7 days and the backup silently stops. `drive.file` is non-sensitive, so Production needs no review.

**Before shipping to real users** (a backup's worst failure is silent): verify the consent screen is in Production; verify drive.file reinstall access (disconnect→reconnect must `reuse`, not re-upload); rate-limit the proxy. *(Done: cross-tab TTL lock via `acquireBackupLock`/`releaseBackupLock` in `driveManifest.ts`; last-success/failing-since surfaced in `DriveBackupStatus.tsx`.)*
