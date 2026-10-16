import { IndexedDBService } from '../src/services/storage';
import { clearUserParamsCache } from '../src/utils/userParams';
import { useAppStore } from '../src/store/useAppStore';

/**
 * `?studies=2` gives the dev webapp a student with two ACTIVE studies, so the
 * study switcher (desktop profile popup, phone Profile tab) can be seen and
 * measured. Dominik's snapshot has one study, and the switcher renders
 * nothing then — which is the point for nearly every student, and why there
 * is otherwise no way to reach it here.
 *
 * Made-up ids and labels, written into the stored user params the way
 * `resolveStudies` would after reading IS. Nothing here can reach IS, so
 * picking the other study only shows the switcher's own states. DEV-gated
 * and in `dev/`, so it cannot reach the extension or the app.
 */
const STUDIES = [
  { studium: '900011', obdobi: '829', label: 'PEF B-AII prez [sem 1, roč 1]', isErasmus: false },
  { studium: '900012', obdobi: '829', label: 'PEF B-EM komb [sem 1, roč 1]', isErasmus: false },
];

export async function applyStudiesOverride(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (new URLSearchParams(window.location.search).get('studies') !== '2') return;
  const existing = (await IndexedDBService.get('meta', 'reis_user_params')) ?? {};
  await IndexedDBService.set('meta', 'reis_user_params', {
    // A made-up name too, unless the record already has one: the switcher
    // sits under it, and a nameless row is not what a student sees.
    fullName: 'Jana Nováková',
    studentId: '100001',
    ...existing,
    studium: STUDIES[0]!.studium,
    obdobi: STUDIES[0]!.obdobi,
    studies: STUDIES,
  });
  clearUserParamsCache();
  await useAppStore.getState().loadContext();
}
