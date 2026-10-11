// Reading App Store Connect's versions list: which states count as "already
// submitted", which block creating another version, and the paged read.
import { listOf, type AscHttp, type AscResource } from './ascJson';

/** States that already hold (or have passed) a submission for that version. */
export const DONE = [
  'WAITING_FOR_REVIEW',
  'IN_REVIEW',
  'PENDING_APPLE_RELEASE',
  'PENDING_DEVELOPER_RELEASE',
  'PROCESSING_FOR_DISTRIBUTION',
  'READY_FOR_SALE',
];
/** States of a different version that block creating this one. */
export const BLOCKING = [
  'PREPARE_FOR_SUBMISSION',
  'WAITING_FOR_REVIEW',
  'IN_REVIEW',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
];

const ASC_ORIGIN = 'https://api.appstoreconnect.apple.com';

/** Every page of a list endpoint: a missed row reads as "not there". */
export async function listAll(asc: AscHttp, firstPath: string): Promise<AscResource[]> {
  const rows: AscResource[] = [];
  let next: string | undefined = firstPath;
  while (next) {
    const { data } = await asc('GET', next);
    rows.push(...listOf(data));
    next = data?.links?.next?.replace(ASC_ORIGIN, '');
  }
  return rows;
}

export const versionsPath = (appId: string) =>
  `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS` +
  '&fields[appStoreVersions]=versionString,appStoreState&limit=200';

/**
 * The state of this version when it already holds, or has passed, a submission
 * (waiting, in review, live...), else null. The pipeline asks this BEFORE it
 * builds, so a re-run does not archive and upload a duplicate binary.
 */
export async function submittedVersionState(
  asc: AscHttp,
  appId: string,
  version: string
): Promise<string | null> {
  const mine = (await listAll(asc, versionsPath(appId))).find(
    (r) => r.attributes?.versionString === version
  );
  const state = mine?.attributes?.appStoreState ?? '';
  return DONE.includes(state) ? state : null;
}
