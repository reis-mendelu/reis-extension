<!-- BEGIN release-checklist -->

- [ ] Version bumped in **both** `package.json` and `wxt.config.ts`, to the same value. A mismatch ships a manifest showing the wrong version.
- [ ] The preview URL for this exact commit was opened and looked at, at phone and desktop width.
- [ ] Store listing text and screenshots still describe what the extension now does.
- [ ] Anything removed in this release is gone from the privacy policy too.
- [ ] No new `VITE_*` variable was added to the Vercel project.

Merging this PR pushes the `v<version>` tag and dispatches `publish.yml`, which submits to Chrome, Firefox and Edge. (A plain tag push can't trigger `publish.yml` directly — GitHub doesn't start workflow runs from `GITHUB_TOKEN`-pushed tags — so `release-tag.yml` dispatches it explicitly and fails loudly, with a by-hand recovery command, if that dispatch itself fails.) Store review is 1–3 days for Chrome and can be weeks for AMO, and a submission cannot be recalled.

<!-- END release-checklist -->
