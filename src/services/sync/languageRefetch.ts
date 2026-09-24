import type { Language } from '../../store/types';

/**
 * When the app asks the sync to refetch IS in the student's language.
 *
 * The sync fetches one language only (fetchLanguage.ts), so data can arrive in
 * the wrong one: after a switch, on the first load after this shipped (the
 * sync-language key starts empty, so that run is Czech), on the extension's
 * first install, or after a switch in another tab. A switch always refetches;
 * a stale delivery asks at most once per language per session, because asking
 * again on every update would turn one mismatch into a crawl per push.
 */
const asked = new Set<Language>();

/** The student switched language: always refetch. */
export function refetchForSwitch(language: Language, trigger: () => void): void {
  asked.add(language);
  trigger();
}

/** A sync update arrived in `dataLanguage`; refetch if that is not the student's. */
export function refetchIfStale(
  dataLanguage: Language | undefined,
  appLanguage: Language,
  trigger: () => void
): boolean {
  if (!dataLanguage || dataLanguage === appLanguage || asked.has(appLanguage)) return false;
  asked.add(appLanguage);
  trigger();
  return true;
}

export function __resetLanguageRefetchForTests(): void {
  asked.clear();
}
