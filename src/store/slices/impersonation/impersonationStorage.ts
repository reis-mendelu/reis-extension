import { IndexedDBService } from '../../../services/storage';
import type { ActiveImpersonation } from '../createImpersonationSlice';

/** One key, in `meta`: no new object store, so no IndexedDB version bump. */
const KEY = 'impersonation';

/** `meta` rejects `undefined` values (MetaSchema), so round-trip through JSON first. */
export async function saveImpersonation(a: ActiveImpersonation): Promise<void> {
  await IndexedDBService.set('meta', KEY, JSON.parse(JSON.stringify(a)));
}

export async function loadImpersonation(): Promise<ActiveImpersonation | null> {
  const v = (await IndexedDBService.get('meta', KEY)) as Partial<ActiveImpersonation> | undefined;
  return v?.selection && v.result && Array.isArray(v.result.schedule)
    ? (v as ActiveImpersonation)
    : null;
}

export async function clearImpersonation(): Promise<void> {
  await IndexedDBService.delete('meta', KEY);
}
