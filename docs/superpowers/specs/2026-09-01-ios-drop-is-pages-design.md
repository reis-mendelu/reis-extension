# Drop the IS page directory from the phone tree — design

**Date:** 2026-09-01 · **Ships in:** 5.0.7 (iOS / Android) · **Status:** approved

## Why

The Student tab on the phone tree opens on **Stránky IS**: a searchable
directory of 95 links into IS Mendelu's own navigation. Every one of them is an
external link, handed to the system browser by `openExternal`, where there is
no IS session. Inside the native app that is a dead end dressed as a feature.
The directory earns its place in the browser extension, which already sits on
IS and keeps the session; it does not earn one in the app.

## What changes

1. **Segments.** `StudentMode` becomes `'people' | 'subjects'`; the tablist
   shows **Lidé / Předměty**, default **Lidé**.
2. **Removed from the phone tree:** `student/PagesDisclosure.tsx`,
   `student/PageGroupList.tsx`, `student/ShortcutGrid.tsx`, and in
   `StudentScreen.tsx` everything that fed them — `buildPageGroups`,
   `pagesData`, `injectUserParams`, `openExternal`, `pagesOpen`, `pageCount`.
   Strings `mobile.student.tabPages`, `searchPages`, `allPages` go from both
   locales.
3. **Kept:** `src/data/pages.ts` and the desktop `IsPortalPopover` — the
   extension's directory is unchanged. `src/mobile/openExternal.ts` stays; the
   notifications sheet still uses it.
4. **Dokumenty** moves to the Profile (settings) sheet as a row under
   *Nastavení*, beside eduroam, following the same pattern: one tap pushes
   `{ kind: 'docs' }`. Strings `mobile.student.documents` / `documentsSub` are
   reused for the row.

## Not gated on platform

The phone tree is what the native app renders and what a narrow browser
window renders; the desktop extension is a separate component tree. Removing
the directory from the phone tree therefore removes it from the app without
touching the extension, and needs no `isNativeApp` check.

## Tests

- `StudentScreen.test.tsx`: default segment is Lidé; only two tabs exist;
  the "IS page directory" describe block and the Dokumenty-shortcut tests are
  deleted.
- `ProfileSheet.test.tsx`: the Dokumenty row pushes the `docs` sheet.
- `verify-ui` screenshots of the Student tab and the Profile sheet at 320/390/430.
