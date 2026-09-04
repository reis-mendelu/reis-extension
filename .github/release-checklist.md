<!-- BEGIN release-checklist -->

- [ ] Version bumped in **both** `package.json` and `wxt.config.ts`, to the same value. The tag job refuses to tag on a mismatch.
- [ ] The app was opened **on a device or simulator** at this commit — CI green is not evidence the iPad build works; the transport it uses is not exercised by any browser check.
- [ ] "What's New" describes what actually changed, and nothing removed in this release is still advertised in the App Store listing or the privacy policy.
- [ ] The reviewer's demo path in the App Review notes still exists in this build.
- [ ] No new `VITE_*` variable was added to the Vercel project.

Merging this PR pushes the `v<version>` tag and **submits nothing to any store**. The tag is the iOS release: cut the build from it on a Mac with

```bash
git fetch --tags && git checkout v<version> && npm ci
npm run release:ios -- --tag v<version>
```

which syncs, archives, verifies and uploads to App Store Connect, then stops — attaching the build to the version and submitting for review stays a human decision, and cannot be recalled once made. The browser extension is no longer part of this train; publish it separately with `gh workflow run publish.yml --ref v<version> -f tag=v<version>` when you actually want a Chrome/Firefox/Edge submission.

<!-- END release-checklist -->
