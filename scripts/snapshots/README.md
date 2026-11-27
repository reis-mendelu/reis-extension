# Daily IS + WebISKAM snapshots (Dominik's personal tool)

Every morning at 07:00 his Mac reads a fixed list of his IS Mendelu and WebISKAM pages and saves
the ones whose text changed into his Google Drive (`darksoothingshadow`, `My Drive/IS snímky`),
with a `changes.md` that Claude can search later ("when did the rent appear?"). How to read the
archive: `ARCHIVE-README.md`, copied into the archive as its `README.md`.

Research and decisions: "Denní snímky IS a WebISKAM – výzkum (2026-11)" in the reis.mendelu Drive,
`Výzkum/`. Not a reIS feature: it runs on his laptop only, and nothing here ships in the apps.

## Rules this code keeps

- **A fixed list of pages, GET only.** It never follows a link: IS and WebISKAM have plain links
  that act (logout, hiding a notice for good, paying from the account).
- **Only his own record.** No classmates, no exam sign-up lists, no catalogue (`isPages.ts`, pinned
  by its tests).
- **The password stays in the Keychain**, and is sent only to IS's login endpoint and alibaba's
  login form (`keychain.ts`, `isRead.ts`, `webiskam.ts`). No cookies or password in the archive.
- **A page that does not load is a problem, not a change.** It goes into `changes.md` as `⚠` and
  a macOS notification, and nothing is saved for it.

## Setup (once)

```bash
security add-generic-password -s "reIS snapshots" -a xholek1 -w
```

```bash
npm run snapshots -- --headed
```

The second command opens WebISKAM's sign-in in a window: accept alibaba's consent page if it
asks. The browser profile that remembers it is `~/Library/Application Support/reIS snapshots/browser`.

```bash
node scripts/snapshots/install-launchd.mjs
```

That installs the morning job (`--uninstall` removes it). It runs from the main checkout, which
follows `test`. Log: `~/Library/Logs/reIS snapshots.log`.

## Offline run (no login)

`npm run snapshots -- --from <dir> --out <dir> [--date YYYY-MM-DD]` reads a saved dump
(`scrape:real --dump-html` writes `.is-html/`) instead of signing in. Use it to try a change.

## Adding a page

IS: add its name to `KEEP` in `isPages.ts` (it must be in `scripts/lib/isHtmlPages.ts`).
WebISKAM: add its path to `WEBISKAM_PAGES` in `webiskam.ts`. Pick it from the archive's
`webiskam/_menu.txt`, and never add a link marked "acts".
