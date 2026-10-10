# Instagram post kit

Makes @reis.mendelu posts headlessly, with no design tool and no Export button:
a 1080×1350 feed post (JPEG) or a 1080×1920 Reel (MP4), in the reIS look
(DM Sans + Inter, navy `#111827`, lime `#79be15`, the reIS mark).

Every phone shot comes from the **demo build** on fake data. The scripts refuse
to run against anything else, and strip the demo bar and the partners block
(partner logos) before a frame is kept.

## Run

```bash
npm run build:web                       # demo build into dist-web/
# serve it: preview_start "reis-demo-preview" (port 4173), or
npx vite preview --config vite.web.build.config.ts --port 4173 --strictPort

# feed post: phone still → post
node scripts/instagram/capture.cjs http://localhost:4173 week scripts/instagram/out/week.png scripts/instagram/data/demo-week.json
node scripts/instagram/render.cjs scripts/instagram/examples/post-week.json scripts/instagram/out/post-week.jpg

# Reel: recorded tap-through → intro / phone / outro
node scripts/instagram/record.cjs http://localhost:4173 week scripts/instagram/out/clip scripts/instagram/data/demo-week.json
node scripts/instagram/reel.cjs scripts/instagram/examples/reel-week.json scripts/instagram/out/clip/clip.mp4 scripts/instagram/out/reel-week.mp4
```

`out/` is gitignored. Needs `ffmpeg` on PATH and the repo's Playwright Chromium.

## Writing a spec

- `headline`: wrap the phrase to underline in `*stars*`. Long headlines shrink
  (88 → 60 px); below that the render fails instead of shipping tiny text.
- One-letter Czech words (v, k, s, z, o, u, a, i) get a no-break space, so they
  never end a line.
- `render.cjs` and `reel.cjs` exit 1, writing nothing, when a brand font did not
  load for the actual text, text is over its line budget, or it leaves the safe
  area or runs into the phone.

## Adding a screen

Add a recipe to `capture.cjs` / a script to `record.cjs`, driven by roles and
labels the way a student taps. Seed data the screen needs into
`data/*.json`; the demo dataset alone is too thin for a convincing week.

## Why not Claude Design

Its Design and Motion artifacts are good for designing *with* someone, but their
PNG/MP4 export is a button in the browser, so an unattended routine cannot use
them. This kit is the unattended path.
