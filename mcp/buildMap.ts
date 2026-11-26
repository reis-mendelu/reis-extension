// mendelu_build_my_map (step 5 of the map, decision 4 of docs/superpowers/specs/2026-11-25-
// reis-for-claude-map-design.md): every file of every enrolled subject, kept on this computer
// at once. It reads the subject list and the folder listings (the cheap requests the overview
// makes too), then downloads only what the store does not already hold for the date IS shows
// (buildDownload.ts, which mendelu_refresh uses too).
// Read-only toward IS: GET requests to dok_server only. It writes through the store alone.
import { plan } from './buildPlan';
import type { Run } from './overviewGather';
import { dryReport, buildReport } from './buildReport';
import { downloadPlanned, type DownloadDeps } from './buildDownload';

export type BuildDeps = DownloadDeps & {
  /** cache.run bound to this call's ticket: the listings note each file's date there. */
  run: Run;
  dryRun: boolean;
};

export async function buildMap(d: BuildDeps) {
  const { planned, problems, codes } = await plan(d);
  if (d.dryRun) {
    const budget = { max: d.store.maxBytes, used: (await d.store.usage()).bytes };
    return dryReport(planned, problems, budget, codes);
  }
  if (!d.store.persistent)
    throw new Error(
      'reIS cannot save to its folder on this computer right now, so nothing was downloaded. Close any program holding files in that folder and try again.'
    );
  const { outcomes, budget, stop } = await downloadPlanned(d, planned);
  return buildReport(planned, outcomes, problems, codes, {
    ...budget,
    stoppedAtBudget: stop === 'budget',
    forgotten: stop === 'forgotten',
    folder: d.store.dir,
  });
}
