import { IndexedDBService } from '../../../services/storage';
import { PERSONAS } from '../../../features/personas';
import type { ActiveImpersonation } from '../createImpersonationSlice';

/**
 * One key per persona in `meta` (design 2026-11-27 §3): no new object store, so
 * no IndexedDB version bump. The value is the whole applied impersonation, the
 * full selection included, so a cached switch asks IS for nothing.
 *
 * IS logout and an identity change take these with everything else
 * (`clearAll` keeps only the per-install keys); admin logout calls
 * `clearPersonaCache`. "Já" leaves them: that is what makes switching back
 * instant.
 */
const key = (id: string) => `persona:${id}`;

export async function savePersona(id: string, a: ActiveImpersonation): Promise<void> {
  // `meta` rejects `undefined` values (MetaSchema): round-trip through JSON.
  await IndexedDBService.set('meta', key(id), JSON.parse(JSON.stringify(a)));
}

export async function loadPersona(id: string): Promise<ActiveImpersonation | null> {
  const v = (await IndexedDBService.get('meta', key(id))) as
    Partial<ActiveImpersonation> | undefined;
  return v?.selection && v.result && Array.isArray(v.result.schedule)
    ? (v as ActiveImpersonation)
    : null;
}

export async function clearPersonaCache(): Promise<void> {
  await Promise.all(PERSONAS.map((p) => IndexedDBService.delete('meta', key(p.id))));
}

/** Whether any persona is cached: the boot asks this before an admin-session lookup. */
export async function hasPersonaCache(): Promise<boolean> {
  const found = await Promise.all(
    PERSONAS.map((p) => IndexedDBService.get('meta', key(p.id)).catch(() => undefined))
  );
  return found.some((v) => v !== undefined);
}
