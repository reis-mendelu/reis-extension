# Storage Policy for reIS

## Core Principle
**Zero LocalStorage usage for production features.**

All persistent data must be stored using `IndexedDBService` or `chrome.storage.sync` (for small, device-synced settings like subject notes).

## Storage Layers

### 1. IndexedDB (`IndexedDBService`)
- **Purpose**: Primary storage for academic data (schedules, grades, exams, files).
- **Why**: Handles large datasets better than `chrome.storage`, is asynchronous, and provides structured querying capabilities.
- **Stores**: 
  - `study_program`: Complete study plan structure.
  - `files`: Lists of materials per subject.
  - `assessments`: Student grades and points.
  - `syllabuses`: Course requirements.
  - `exams`: Upcoming exam dates.
  - `schedule`: Weekly calendar events.
  - `meta`: UI state, hints dismissal, and user identification.

### 2. Chrome Storage Sync (`chrome.storage.sync`)
- **Purpose**: Critical user-created content that should survive cross-device transitions.
- **Usage**: Only for `useSubjectNote.ts`.

### 3. Deprecated Storage (`localStorage` & `chrome.storage.local`)
- **Status**: **DEPRECATED**.
- **Migration**: `SyncService.ts` handles one-time migration of legacy keys on app startup.
- **New Code**: Should **never** import or use `localStorage` directly.

## Implementation Guidelines
- Always use `await` with `IndexedDBService`.
- If UI needs to reactive to storage changes across tabs, use `syncService.subscribe()` or a `BroadcastChannel`.
- Use the `meta` store for simple booleans or strings (e.g., `welcome_dismissed`).
