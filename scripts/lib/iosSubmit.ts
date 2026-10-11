// Attach an uploaded build to its App Store version and submit it for review —
// the sequence that was run by hand through the ASC REST API on 2026-10-11,
// made safe to run unattended:
//
//  * a re-run is harmless: a version already waiting/in review/live is reported,
//    never touched;
//  * another version in an editable state blocks (only one can be edited at a
//    time) and is named, rather than being overwritten;
//  * the attached build is READ BACK and compared — the build picker's stale
//    default is the classic way an old binary ships under new notes;
//  * a dry run does every read and validation and writes nothing.
//
// The HTTP client is injected so the sequence is testable without Apple.

import { listOf, oneOf, type AscHttp, type AscResource } from './ascJson';

export type { AscHttp } from './ascJson';

export interface SubmitArgs {
  asc: AscHttp;
  appId: string;
  /** Marketing version, x.y.z. */
  version: string;
  /** Czech "What's new". */
  notes: string;
  dryRun: boolean;
  sleep?: (ms: number) => Promise<void>;
  maxPolls?: number;
}

export interface SubmitResult {
  status: 'submitted' | 'already-submitted' | 'dry-run-ok';
  detail: string;
}

/** States that already hold (or have passed) a submission for that version. */
const DONE = [
  'WAITING_FOR_REVIEW',
  'IN_REVIEW',
  'PENDING_APPLE_RELEASE',
  'PENDING_DEVELOPER_RELEASE',
  'PROCESSING_FOR_DISTRIBUTION',
  'READY_FOR_SALE',
];
/** States of a different version that block creating this one. */
const BLOCKING = [
  'PREPARE_FOR_SUBMISSION',
  'WAITING_FOR_REVIEW',
  'IN_REVIEW',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
];

async function waitForBuild(a: SubmitArgs): Promise<string> {
  const sleep = a.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const polls = a.maxPolls ?? 40;
  let last = 'none';
  for (let i = 0; i < polls; i++) {
    const { data } = await a.asc(
      'GET',
      `/v1/builds?filter[app]=${a.appId}&filter[preReleaseVersion.version]=${a.version}` +
        '&sort=-uploadedDate&fields[builds]=version,processingState&limit=5'
    );
    const b = listOf(data)[0];
    if (b?.attributes?.processingState === 'VALID') return b.id as string;
    last = b ? `${b.attributes?.version} is ${b.attributes?.processingState}` : 'none';
    if (i < polls - 1) await sleep(15_000);
  }
  throw new Error(
    last === 'none'
      ? `No build for ${a.version} in App Store Connect.`
      : `Build for ${a.version} never became VALID (${last}).`
  );
}

export async function submitIosVersion(a: SubmitArgs): Promise<SubmitResult> {
  let buildId: string;
  try {
    buildId = await waitForBuild(a.dryRun ? { ...a, maxPolls: 1 } : a);
  } catch (err) {
    // A dry run on a PR runs before any upload for that version exists; that is
    // the expected state, not a failure. A real run still fails.
    if (a.dryRun && err instanceof Error && err.message.startsWith('No build')) {
      return {
        status: 'dry-run-ok',
        detail: `${err.message} (expected before the upload); nothing written`,
      };
    }
    throw err;
  }
  const vs = await a.asc(
    'GET',
    `/v1/apps/${a.appId}/appStoreVersions?filter[platform]=IOS` +
      '&fields[appStoreVersions]=versionString,appStoreState&limit=10'
  );
  const rows = listOf(vs.data);
  const stateOf = (r: AscResource) => r.attributes?.appStoreState ?? '';
  const mine = rows.find((r) => r.attributes?.versionString === a.version);
  const blocker = rows.find(
    (r) => r.attributes?.versionString !== a.version && BLOCKING.includes(stateOf(r))
  );
  if (blocker) {
    throw new Error(
      `${blocker.attributes?.versionString} is ${stateOf(blocker)}; only one version ` +
        `can be edited at a time. Resolve it in App Store Connect, then re-run.`
    );
  }
  if (mine && DONE.includes(stateOf(mine))) {
    return { status: 'already-submitted', detail: `${a.version} is ${stateOf(mine)}` };
  }
  if (a.dryRun) {
    return {
      status: 'dry-run-ok',
      detail: `build ${buildId} is VALID; ${a.version} ${mine ? 'exists' : 'would be created'}; nothing written`,
    };
  }

  let versionId = mine?.id;
  if (!versionId) {
    const created = await a.asc('POST', '/v1/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: { platform: 'IOS', versionString: a.version, releaseType: 'AFTER_APPROVAL' },
        relationships: { app: { data: { type: 'apps', id: a.appId } } },
      },
    });
    versionId = oneOf(created.data)?.id;
    if (!versionId) throw new Error('App Store Connect returned no id for the new version.');
  }

  const locs = await a.asc('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  const cs = listOf(locs.data).find((l) => l.attributes?.locale === 'cs');
  if (!cs) throw new Error('The version has no Czech (cs) localization to file the notes on.');
  await a.asc('PATCH', `/v1/appStoreVersionLocalizations/${cs.id}`, {
    data: {
      type: 'appStoreVersionLocalizations',
      id: cs.id,
      attributes: { whatsNew: a.notes },
    },
  });

  await a.asc('PATCH', `/v1/appStoreVersions/${versionId}/relationships/build`, {
    data: { type: 'builds', id: buildId },
  });
  const attached = await a.asc('GET', `/v1/appStoreVersions/${versionId}/build`);
  const attachedId = oneOf(attached.data)?.id;
  if (attachedId !== buildId) {
    throw new Error(
      `Attached build is ${attachedId}, not the uploaded ${buildId}. Not submitting.`
    );
  }

  const open = await a.asc(
    'GET',
    `/v1/reviewSubmissions?filter[app]=${a.appId}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW`
  );
  let submissionId: string | undefined = listOf(open.data)[0]?.id;
  if (!submissionId) {
    const made = await a.asc('POST', '/v1/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: a.appId } } },
      },
    });
    submissionId = oneOf(made.data)?.id;
    if (!submissionId)
      throw new Error('App Store Connect returned no id for the review submission.');
  }
  await a.asc('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
      },
    },
  });
  const done = await a.asc('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
    data: { type: 'reviewSubmissions', id: submissionId, attributes: { submitted: true } },
  });
  const state = oneOf(done.data)?.attributes?.state;
  if (state !== 'WAITING_FOR_REVIEW') {
    throw new Error(`Submission ended in ${state}, expected WAITING_FOR_REVIEW.`);
  }
  return { status: 'submitted', detail: `${a.version} (build ${buildId}) is WAITING_FOR_REVIEW` };
}
