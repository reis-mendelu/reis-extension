// Release an Android App Bundle to a Google Play testing track through the Play
// Developer API (androidpublisher v3 "edits"): open an edit, upload the bundle,
// put it on the track with the release notes, commit.
//
// Safe to run unattended and to re-run:
//  * a versionCode already RELEASED on the track (not a draft) is reported as done,
//    nothing is touched;
//  * a wrong track name fails with the REAL track names listed;
//  * whatever happens after the edit opens, an uncommitted edit is deleted, so
//    Play never keeps a half-finished one around;
//  * a dry run proves the credentials and the track, and releases nothing (it
//    opens a temporary edit and deletes it).
//
// A commit sends the release to Google's review for that track; it reaches
// testers when Google has passed it, not when this returns.
//
// The HTTP client is injected (see scripts/release/play-upload.ts for the real
// one) so the sequence is testable without Google.

/** The fields of a Play API answer that this sequence reads. */
export interface PlayResponse {
  id?: string;
  versionCode?: number | string;
  tracks?: Array<{
    track: string;
    releases?: Array<{ status?: string; versionCodes?: string[] }>;
  }>;
}

export type PlayHttp = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  /** Relative to /applications/<package>, e.g. "/edits/E1/tracks". */
  path: string,
  body?: unknown
) => Promise<PlayResponse>;

export interface ReleaseArgs {
  play: PlayHttp;
  track: string;
  versionName: string;
  /** Overrides the code derived from versionName (same rule as android/app/build.gradle). */
  expectedVersionCode?: number;
  /** Czech release notes, at most 500 characters. */
  notes: string;
  bundle: Buffer;
  dryRun: boolean;
}

export interface ReleaseResult {
  status: 'released' | 'already-released' | 'dry-run-ok';
  detail: string;
}

/** major*10000 + minor*100 + patch — the rule android/app/build.gradle derives it with. */
export function versionCodeFor(version: string): number {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`"${version}" is not a plain x.y.z version.`);
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

export async function releaseToTrack(a: ReleaseArgs): Promise<ReleaseResult> {
  const code = a.expectedVersionCode ?? versionCodeFor(a.versionName);
  const edit = await a.play('POST', '/edits', {});
  const editId = edit.id;
  if (!editId) throw new Error('Google Play returned no edit id.');
  let committed = false;
  try {
    const listed = await a.play('GET', `/edits/${editId}/tracks`);
    const tracks = listed.tracks ?? [];
    const mine = tracks.find((t) => t.track === a.track);
    if (!mine) {
      throw new Error(
        `Play has no track "${a.track}". Tracks on cz.reis.app: ` +
          `${tracks.map((t) => t.track).join(', ') || 'none'}. Set PLAY_TRACK to the closed-testing one.`
      );
    }
    const sameCode = (mine.releases ?? []).filter((r) =>
      (r.versionCodes ?? []).includes(String(code))
    );
    // A draft or a halted release reaches no tester, so it is not "done"; and
    // the bundle is already on Play, so uploading it again would only fail.
    // Stop with the instruction instead.
    const stuck = sameCode.find((r) => r.status === 'draft' || r.status === 'halted');
    if (stuck) {
      throw new Error(
        `versionCode ${code} is on ${a.track} as a ${stuck.status} release. ` +
          'Finish or resume it in Play Console; this pipeline will not upload it again.'
      );
    }
    if (sameCode.length > 0) {
      return { status: 'already-released', detail: `versionCode ${code} is already on ${a.track}` };
    }
    if (a.dryRun) {
      return {
        status: 'dry-run-ok',
        detail: `credentials work; track ${a.track} exists; would upload versionCode ${code}; nothing written`,
      };
    }

    const uploaded = await a.play('POST', `/edits/${editId}/bundles`, a.bundle);
    const uploadedCode = Number(uploaded.versionCode);
    if (uploadedCode !== code) {
      throw new Error(`Uploaded bundle is versionCode ${uploadedCode}, expected ${code}.`);
    }
    await a.play('PUT', `/edits/${editId}/tracks/${a.track}`, {
      track: a.track,
      releases: [
        {
          name: a.versionName,
          versionCodes: [String(uploadedCode)],
          status: 'completed',
          releaseNotes: [{ language: 'cs-CZ', text: a.notes }],
        },
      ],
    });
    await a.play('POST', `/edits/${editId}:commit`, {});
    committed = true;
    return {
      status: 'released',
      detail: `versionCode ${uploadedCode} committed to ${a.track}; Google reviews it before testers get it`,
    };
  } finally {
    if (!committed) await a.play('DELETE', `/edits/${editId}`).catch(() => {});
  }
}
