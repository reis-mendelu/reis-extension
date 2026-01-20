/**
 * Storage keys for all persisted data.
 * Prefixed with 'reis_' to avoid collisions.
 */
export const STORAGE_KEYS = {
    // Schedule data
    SCHEDULE_DATA: 'reis_schedule',
    SCHEDULE_WEEK_START: 'reis_schedule_week',

    // Exam data
    EXAMS_DATA: 'reis_exams',
    EXAMS_LAST_MODIFIED: 'reis_exams_modified', // Timestamp for optimistic update tracking

    // Subject data (folder links, metadata)
    SUBJECTS_DATA: 'reis_subjects',

    // Subject files (keyed by course code)
    // Usage: SUBJECT_FILES_PREFIX + courseCode
    SUBJECT_FILES_PREFIX: 'reis_files_',

    // User parameters
    USER_PARAMS: 'reis_user_params',

    // Outlook calendar sync
    OUTLOOK_SYNC: 'reis_outlook_sync',

    // Sync metadata
    LAST_SYNC: 'reis_last_sync',
    SYNC_ERROR: 'reis_sync_error',
    SYNC_IN_PROGRESS: 'reis_sync_in_progress',

    // Assessment data (keyed by course code)
    // Usage: SUBJECT_ASSESSMENTS_PREFIX + courseCode
    SUBJECT_ASSESSMENTS_PREFIX: 'reis_assessments_',

    // Syllabus data (keyed by course code)
    // Usage: SUBJECT_SYLLABUS_PREFIX + courseCode
    SUBJECT_SYLLABUS_PREFIX: 'reis_syllabus_',

    // Success rate data
    SUCCESS_RATES_DATA: 'reis_success_rates',
    GLOBAL_STATS_LAST_SYNC: 'reis_global_stats_sync',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
