import { LoadFailed } from '../../LoadFailed';
import { syncService } from '../../../services/sync';

/**
 * Shown when a sync finished but this screen's data never came back.
 *
 * The third state, and the one the first two versions of this work were missing.
 * A screen has to distinguish "you have nothing" from "we could not find out" —
 * "Žádné zkoušky" over a failed fetch is the same lie as showing it mid-sync,
 * just later. Empty states are for answers; this is for the absence of one.
 *
 * A retry rather than a wait: the automatic gap is ten minutes and the interval
 * fifteen, so a student who hits a dropped connection would otherwise stare at
 * a wrong answer for a quarter of an hour. `trigger_sync` is the `user` reason,
 * which clears every freshness stamp — exactly right here, since nothing was
 * successfully fetched to keep.
 */
export function ScreenError({ testId }: { testId: string }) {
  return <LoadFailed testId={testId} onRetry={() => syncService.triggerSync()} />;
}
