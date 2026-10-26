<!-- BEGIN release-checklist -->

- [ ] Version bumped in **both** `package.json` and `wxt.config.ts`, to the same value. The tag job refuses to tag on a mismatch.
- [ ] The app was opened **on a device or simulator** at this commit — CI green is not evidence the iPad build works; the transport it uses is not exercised by any browser check.
- [ ] "What's New" describes what actually changed, and nothing removed in this release is still advertised in the App Store listing.
- [ ] The reviewer's demo path in the App Review notes still exists in this build.
- [ ] No new `VITE_*` variable was added to the Vercel project.

The privacy block below this checklist is generated from `privacy/disclosures.ts` — which store declarations changed since the last tag, and who does each. The Release gate will not pass until every item in it is ticked and the published policy gist matches the repo.

Merging this PR pushes the `v<version>` tag and, in the same run, **submits to all three stores** (`ship.yml`): the iOS build is archived, uploaded and submitted for App Review, the Android bundle goes to Google Play production (full rollout, after Google's review), and the extension goes to Chrome and Firefox. A submission **cannot be recalled** — this PR is the last gate. `release-notes/<version>.cs.txt` must hold the agreed Czech "What's new" (the Release gate fails without it). The run ends with one summary table; secrets and setup are in `docs/release-pipeline.md`.

<!-- END release-checklist -->
