import type { AppState } from '../../types';
import type { ActiveImpersonation } from '../createImpersonationSlice';
import { overlayWrite } from '../../overlay/overlayGuard';
import { overlayState } from '../../overlay/overlayState';
import { identityOverlay } from '../../overlay/identityOverlay';
import { failRateCodes } from './failRateCodes';
import { saveImpersonation } from './impersonationStorage';
import { logError } from '../../../utils/reportError';
import { ImpersonationError } from '../../../api/impersonation/types';
import { personaById } from '../../../features/personas';

type Set = (partial: Partial<AppState>) => void;
type Get = () => AppState;

/**
 * Lays one impersonation over the store: its plan, subjects and timetable, and
 * the persona's identity (design 2026-11-27 §2), saved so it survives a
 * restart. The picker, the persona list and a persona's background refresh all
 * apply through here, so they cannot drift.
 *
 * With `epoch`, nothing is laid down once a newer request (Já, another persona,
 * a logout) has started, checked again after the save: an exit that began
 * meanwhile queued its delete after this save, so the disk ends clean too.
 * `background` (a refresh) leaves the picker's drawer and spinner alone.
 * Resolves false when a newer request won; throws ImpersonationError('storage')
 * when the save failed.
 */
export async function applyImpersonation(
  set: Set,
  get: Get,
  active: ActiveImpersonation,
  opts: { epoch?: number; background?: boolean } = {}
): Promise<boolean> {
  const stale = () => opts.epoch !== undefined && !isCurrentImpersonationEpoch(opts.epoch);
  if (stale()) return false;
  try {
    await saveImpersonation(active);
  } catch (e) {
    // Not applied, nothing half-done, and unlike a cancel, said: every caller
    // shows 'storage' where it shows its other errors.
    logError('Impersonation.save', e);
    throw new ImpersonationError('storage');
  }
  if (stale()) return false;
  set(
    overlayWrite({
      impersonation: active,
      ...overlayState(active.result),
      ...identityOverlay(active.selection),
      ...(opts.background ? {} : { impersonationStarting: false, impersonationPickerOpen: false }),
    })
  );
  // The Erasmus persona's English, in memory only; any other view gives the
  // admin's own language back (design 2026-11-27 §2 "Language"). Not on a
  // background refresh: the same persona, and a language the admin picked
  // meanwhile is theirs.
  if (!opts.background)
    await get().setPersonaLanguage(personaById(active.selection.personaId)?.language ?? null);
  void get()
    .fetchSuccessRateBatch(failRateCodes(active.result))
    .catch(() => {});
  return true;
}

/**
 * Which "view as" request is current. Every start (picker, persona), every exit
 * (Já, a cancel, admin logout) takes a new one; a fetch that finishes under an
 * older one is not applied, so a slow IT fetch cannot land after the admin
 * tapped Finance or Já. A token, not state anything renders: module-level.
 */
let epoch = 0;
export const nextImpersonationEpoch = () => ++epoch;
export const isCurrentImpersonationEpoch = (e: number) => e === epoch;
/** The current token without taking a new one: the boot restore yields to any request after it. */
export const currentImpersonationEpoch = () => epoch;
