// Before a release: is another App Store version still open? Only one iOS
// version can be edited at a time, so if the previous one is still waiting for
// or in review, ship.yml uploads the new build and then ios-submit.ts stops
// ("5.7.1 is WAITING_FOR_REVIEW"). That hit 5.7.1 and 5.7.2 (2026-11). This
// reads App Store Connect and writes nothing.
import { listOf, type AscHttp } from './ascJson';
import { BLOCKING, listAll, versionsPath } from './iosSubmitState';

export interface IosBlocker {
  /** The appStoreVersions record id (what a rename PATCHes). */
  id: string;
  versionString: string;
  state: string;
  /** Review submissions holding this version (what a withdraw cancels). */
  submissionIds: string[];
}

/**
 * What the preflight reports: ios-submit.ts's BLOCKING, plus an approved version
 * not yet out. Apple creates no new version until that one is released, and
 * BLOCKING leaves it out because ios-submit.ts never creates one in that state.
 */
export const PREFLIGHT_BLOCKING = [
  ...BLOCKING,
  'PENDING_DEVELOPER_RELEASE',
  'PENDING_APPLE_RELEASE',
];

/** Under review: the only states a withdraw (cancel the submission) applies to. */
const IN_REVIEW = ['WAITING_FOR_REVIEW', 'IN_REVIEW'];

/** An AscHttp that refuses anything but GET, so the preflight cannot write. */
export function readOnly(asc: AscHttp): AscHttp {
  return (method, path, body) => {
    if (method !== 'GET') {
      return Promise.reject(new Error(`preflight is read-only: refused ${method} ${path}`));
    }
    return asc(method, path, body);
  };
}

/**
 * Every iOS version, other than `newVersion`, that would stop `newVersion` from
 * being submitted. `newVersion`'s own draft is left out: ios-submit.ts reuses it.
 */
export async function iosBlockers(
  ascIn: AscHttp,
  appId: string,
  newVersion: string | undefined
): Promise<IosBlocker[]> {
  const asc = readOnly(ascIn);
  const rows = await listAll(asc, versionsPath(appId));
  const blockers: IosBlocker[] = rows
    .filter((r) => r.attributes?.versionString !== newVersion)
    .filter((r) => PREFLIGHT_BLOCKING.includes(r.attributes?.appStoreState ?? ''))
    .map((r) => ({
      id: r.id,
      versionString: r.attributes?.versionString ?? '?',
      state: r.attributes?.appStoreState ?? '?',
      submissionIds: [],
    }));
  if (!blockers.some((b) => IN_REVIEW.includes(b.state))) return blockers;

  const open = await asc(
    'GET',
    `/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=IOS` +
      `&filter[state]=${IN_REVIEW.join(',')}&limit=50`
  );
  for (const sub of listOf(open.data)) {
    const items = await listAll(
      asc,
      `/v1/reviewSubmissions/${sub.id}/items?include=appStoreVersion&limit=50`
    );
    for (const item of items) {
      const versionId = item.relationships?.appStoreVersion?.data?.id;
      blockers.find((b) => b.id === versionId)?.submissionIds.push(sub.id);
    }
  }
  return blockers;
}

/** One line per blocker, with the ids the withdraw recipe needs. */
export function describeBlocker(b: IosBlocker): string {
  const subs = b.submissionIds.length ? `, review submission ${b.submissionIds.join(', ')}` : '';
  return `${b.versionString} is ${b.state} (version record ${b.id}${subs})`;
}
