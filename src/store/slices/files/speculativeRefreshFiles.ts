let inFlightCode: string | null = null;

export const SPECULATIVE_STALE_MS = 60_000;

interface SpeculativeInput {
    courseCode: string;
    lastFilesFetchedAt: Record<string, number>;
    filesLoading: Record<string, boolean>;
    refreshFilesForSubject: (code: string) => Promise<void>;
    now?: number;
}

/**
 * Fires a single speculative refresh if all guards pass:
 *  - no other speculative refresh in flight (module-scoped token)
 *  - this subject is not already loading
 *  - last fetch is older than SPECULATIVE_STALE_MS
 * Returns true if the refresh was fired.
 */
export function speculativeRefreshFilesImpl({
    courseCode,
    lastFilesFetchedAt,
    filesLoading,
    refreshFilesForSubject,
    now = Date.now(),
}: SpeculativeInput): boolean {
    if (inFlightCode !== null) return false;
    if (filesLoading[courseCode]) return false;
    const last = lastFilesFetchedAt[courseCode];
    if (last && now - last < SPECULATIVE_STALE_MS) return false;

    inFlightCode = courseCode;
    refreshFilesForSubject(courseCode)
        .catch(() => {})
        .finally(() => { if (inFlightCode === courseCode) inFlightCode = null; });
    return true;
}

export function __resetSpeculativeState(): void {
    inFlightCode = null;
}
