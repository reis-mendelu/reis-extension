import type { AppSlice } from '../types';
import {
  ImpersonationError,
  type FacultyOptions,
  type ImpersonationErrorCode,
  type ImpersonationSelection,
} from '../../api/impersonation/types';
import { fetchImpersonation } from '../../api/impersonation/fetchImpersonation';
import { loadOptions, loadYear1Groups } from '../../api/impersonation/options';
import { currentPeriod, periodLabel } from '../../api/impersonation/intake';
import { personaById, personaRequest, type PersonaId } from '../../features/personas';
import { clearPersonaCache, loadPersona, savePersona } from './impersonation/personaCache';
import {
  applyImpersonation,
  isCurrentImpersonationEpoch,
  nextImpersonationEpoch,
} from './impersonation/applyImpersonation';
import { logError } from '../../utils/reportError';
import type { ActiveImpersonation } from './createImpersonationSlice';

export type PersonaRowState = 'loading' | ImpersonationErrorCode;

export interface PersonaSlice {
  /** Per persona row: fetching, or why its last fetch failed. Absent = idle. */
  personaRows: Partial<Record<PersonaId, PersonaRowState>>;
  switchToPersona: (id: PersonaId) => Promise<boolean>;
  /** "Já" while nothing is applied yet: the fetch in flight is cached, never applied. */
  cancelPersonaSwitch: () => void;
  /** Boot: the restored persona, refreshed in the background if older than 24 h. */
  refreshPersonaIfStale: (active: ActiveImpersonation, epoch: number) => void;
}

/** A cached persona older than this refreshes in the background (decision #11). */
const STALE_MS = 24 * 60 * 60 * 1000;

const codeOf = (e: unknown): ImpersonationErrorCode =>
  e instanceof ImpersonationError ? e.code : 'timetable';

/**
 * Background refreshes in flight, so a stale persona is refetched once, each
 * with the request token of the LATEST switch to it: a re-tap moves it along,
 * anything else (Já, another persona, a logout) leaves it stale. Tokens, not
 * state anything renders, hence module-level like the token itself.
 */
const refreshing = new Map<PersonaId, number>();
/** One `loadOptions()` at a time, shared with whoever asks while it runs. */
let optionsInFlight: Promise<FacultyOptions[]> | null = null;

/**
 * The one-tap persona list (design 2026-11-27 §3, step B). A cached persona
 * applies at once; one not cached yet is fetched live from IS through the
 * admin's own session, like the picker, and applied only whole. A failure
 * leaves the current identity and marks that row.
 */
export const createPersonaSlice: AppSlice<PersonaSlice> = (set, get) => {
  const row = (id: PersonaId, v: PersonaRowState | null) =>
    set((s) => {
      const next = { ...s.personaRows };
      if (v) next[id] = v;
      else delete next[id];
      return { personaRows: next };
    });
  // A row's spinner belongs to the request that set it: an older fetch for the
  // same persona (cancelled by Já, then tapped again) never clears or marks it.
  const rowOwner = new Map<PersonaId, number>();
  const ownRow = (id: PersonaId, epoch: number, v: PersonaRowState | null) => {
    if (rowOwner.get(id) !== epoch) return;
    if (v !== 'loading') rowOwner.delete(id);
    row(id, v);
  };

  // The picker's options when it already has them; otherwise loaded here and
  // handed to it too. Awaited directly: the picker's loader swallows errors.
  const options = async () => {
    const have = get().impersonationOptions;
    if (have) return have;
    optionsInFlight ??= loadOptions().finally(() => (optionsInFlight = null));
    const loaded = await optionsInFlight.catch((e: unknown) => {
      logError('Persona.options', e);
      throw new ImpersonationError('options');
    });
    set({ impersonationOptions: loaded, impersonationOptionsStatus: 'idle' });
    return loaded;
  };

  const period = () => periodLabel(currentPeriod(new Date()));
  const isAdmin = () => get().adminRole === 'reis_admin';

  // Saved only for a reis_admin: an admin logout mid-fetch must not leave a
  // persona on disk (it cleared them), so a save that raced it is undone.
  const keep = async (id: PersonaId, active: ActiveImpersonation) => {
    if (!isAdmin()) return false;
    try {
      await savePersona(id, active);
    } catch (e) {
      // The same answer as a failed save of the active view (applyImpersonation).
      logError('Persona.save', e, { persona: id });
      throw new ImpersonationError('storage');
    }
    if (isAdmin()) return true;
    await clearPersonaCache().catch(() => {});
    return false;
  };

  // The cached selection as it is: the plan and timetable are what change
  // within a period, and asking for the options again costs a POST per faculty.
  const refresh = async (id: PersonaId, cached: ImpersonationSelection, epoch: number) => {
    refreshing.set(id, epoch);
    try {
      const selection = { ...cached, periodLabel: period() };
      const result = await fetchImpersonation(selection);
      const active = { selection: { ...selection, ...result.resolved }, result };
      if (!(await keep(id, active))) return;
      const latest = refreshing.get(id);
      if (latest !== undefined && get().impersonation?.selection.personaId === id)
        await applyImpersonation(set, get, active, { epoch: latest, background: true });
    } catch (e) {
      logError('Persona.refresh', e, { persona: id });
      // The cached persona stays applied, and its row says why the refresh
      // failed: IS, or saving it (unless a fetch of its own is showing there).
      if (!rowOwner.has(id)) row(id, codeOf(e));
    } finally {
      refreshing.delete(id);
    }
  };

  return {
    personaRows: {},

    switchToPersona: async (id) => {
      const persona = personaById(id);
      if (!persona || get().adminRole !== 'reis_admin' || get().demoMode) return false;
      const epoch = nextImpersonationEpoch();

      const cached = await loadPersona(id).catch(() => null);
      if (cached && cached.selection.periodLabel === period()) {
        row(id, null);
        try {
          if (!(await applyImpersonation(set, get, cached, { epoch }))) return false;
        } catch (e) {
          row(id, codeOf(e));
          return false;
        }
        if (refreshing.has(id)) refreshing.set(id, epoch);
        else if (Date.now() - cached.result.fetchedAt > STALE_MS)
          void refresh(id, cached.selection, epoch);
        return true;
      }

      rowOwner.set(id, epoch);
      row(id, 'loading');
      try {
        const req = await personaRequest(persona, await options(), loadYear1Groups);
        const selection = { ...req, periodLabel: period() };
        const result = await fetchImpersonation(selection);
        const active = { selection: { ...selection, ...result.resolved }, result };
        const kept = await keep(id, active);
        // Já or another persona meanwhile: cached for next time, not applied.
        // The row stays this request's until the apply is done, so a failed
        // save still reaches it.
        const applied = kept && (await applyImpersonation(set, get, active, { epoch }));
        ownRow(id, epoch, null);
        return applied;
      } catch (e) {
        logError('Persona.switch', e, { persona: id });
        // A cancelled request leaves no error on its row either.
        ownRow(id, epoch, isCurrentImpersonationEpoch(epoch) ? codeOf(e) : null);
        return false;
      }
    },

    refreshPersonaIfStale: (active, epoch) => {
      const id = personaById(active.selection.personaId)?.id;
      if (!id || refreshing.has(id) || Date.now() - active.result.fetchedAt <= STALE_MS) return;
      void refresh(id, active.selection, epoch);
    },

    cancelPersonaSwitch: () => {
      nextImpersonationEpoch();
      rowOwner.clear();
      set((s) => ({
        impersonationStarting: false,
        personaRows: Object.fromEntries(
          Object.entries(s.personaRows).filter(([, v]) => v !== 'loading')
        ),
      }));
    },
  };
};
