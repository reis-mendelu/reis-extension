/**
 * Pure classifier for the Drive backup header indicator.
 *
 * The icon must answer "is my stuff safe?" at a glance — on touch, without a
 * click. So we collapse the manifest's raw fields into a single `kind` + `tone`
 * the component renders as a visible label (not a desktop-only tooltip).
 *
 * Severity is graded: a fresh failure streak self-heals on the next pass and
 * must NOT look like a catastrophe, while a streak that has persisted for a day
 * genuinely needs the user to reconnect. Same amber triangle for both was the
 * bug — a trivial blip looked identical to a dead token.
 */

const DAY = 24 * 60 * 60 * 1000;

export type DriveStatusKind =
    | 'connect' // not linked — invite to back up
    | 'first-sync' // first pass running, nothing mirrored yet — don't imply "done"
    | 'syncing' // a pass is actively running over an existing mirror
    | 'pending' // linked, but no pass has completed yet
    | 'healthy' // last pass succeeded
    | 'retrying' // failing < 1 day — will self-heal, stay calm
    | 'broken'; // failing >= 1 day — needs the user to reconnect

export type DriveStatusTone = 'muted' | 'warning' | 'error';

export interface DriveStatusInput {
    connected: boolean;
    syncing: boolean;
    /** Epoch ms the current failure streak began; null when healthy. */
    failingSince: number | null;
    /** Epoch ms of the last completed pass (0 = never). */
    lastSync: number;
    now: number;
}

export interface DriveStatusView {
    kind: DriveStatusKind;
    tone: DriveStatusTone;
}

export function classifyDriveStatus(i: DriveStatusInput): DriveStatusView {
    if (!i.connected) return { kind: 'connect', tone: 'muted' };
    // Active work wins over a stale streak: reflect what's happening now. The
    // very first pass is called out separately so the UI never implies the phone
    // has the files before a single one has landed.
    if (i.syncing) return { kind: i.lastSync > 0 ? 'syncing' : 'first-sync', tone: 'muted' };
    if (i.failingSince !== null) {
        const age = i.now - i.failingSince;
        return age >= DAY
            ? { kind: 'broken', tone: 'error' }
            : { kind: 'retrying', tone: 'warning' };
    }
    if (i.lastSync > 0) return { kind: 'healthy', tone: 'muted' };
    return { kind: 'pending', tone: 'muted' };
}
