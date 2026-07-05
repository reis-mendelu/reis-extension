# Tisk dokumentů popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single "Potvrzení o studiu" flyout row with a "Tisk dokumentů" panel that downloads any of the one-click IS study documents as real PDFs, with per-row spinner → checkmark/error driven by actual download completion.

**Architecture:** All IS traffic runs first-party in the content script (it has the `SameSite` session cookie). The iframe app builds document URLs from a pure catalog and dispatches a `download_document` `REIS_ACTION`; the content script `fetch()`es the PDF blob and saves it via an `<a download>` with a proper filename, acking success only after the save so the UI shows true completion. A store flag `isDocumentsOpen` (mirroring `isEduroamOpen`) opens a self-connecting drawer.

**Tech Stack:** WXT, React 19, Zustand (sliced) + Immer, DaisyUI, Vitest + happy-dom.

## Global Constraints

- NO `localStorage`/`sessionStorage`; NO custom CSS (DaisyUI classes only); NO `useEffect` for data fetching; direct imports only (no barrels); max 200 lines/file. (repo CLAUDE.md Iron Rules)
- Test first: write a failing test before implementation.
- Internal store language is `'cz' | 'en'`; IS content language uses `;jazyk=eng`.
- IS URLs use `;`-separated params, not `&`.
- Run `npm run build` after changes and confirm exit 0 before declaring a task done. Run changed-file `eslint --max-warnings=0` before committing.
- Verified one-click PDF triggers (all `application/pdf` + attachment): `potvrzeni_tisk_el=1`, `prehled_tisk_el=1`, `reg_arch_tisk=1`; add `;jazyk=eng` for English content. Base: `https://is.mendelu.cz/auth/student/tisk_dokumentu.pl`.

---

## Prerequisite: reset the superseded WIP

The working tree holds an in-progress hidden-iframe SameSite fix that this feature replaces with the fetch-blob approach. Start clean.

- [ ] **Step 1: Discard the WIP edits and stray test**

```bash
cd /Users/dominik-personal/Documents/reis-extension
git checkout -- src/api/__tests__/confirmationOfStudy.test.ts src/api/confirmationOfStudy.ts src/api/proxyClient.ts src/components/Menu/__tests__/MainItems.test.ts src/components/MobileNav/MobileNavSheet.tsx src/components/Sidebar/NavItem.tsx src/injector/messageHandler.ts src/types/messages/base.ts
rm -f src/api/__tests__/proxyClient.confirmation.test.ts
git status --short   # expect: clean (only the committed spec on this branch)
```

Expected: `git status --short` prints nothing.

---

## File Structure

- Create `src/api/studyDocuments.ts` — pure catalog: doc list, `buildDocumentUrl`, filenames, `buildZadostUrl`.
- Create `src/injector/documentDownloader.ts` — content-script `downloadDocumentInPage(url, filename)` (fetch-blob → anchor).
- Create `src/store/slices/createDocumentsSlice.ts` — `isDocumentsOpen` flag.
- Create `src/hooks/data/useDocumentDownload.ts` — per-row download status + dispatch.
- Create `src/components/StudyDocuments/DocumentsDrawer.tsx` — self-connecting drawer with the doc rows.
- Modify `src/types/messages/base.ts` (ActionType), `src/api/proxyClient.ts` (`downloadDocument`), `src/injector/messageHandler.ts` (handler), `src/store/types.ts` + `src/store/useAppStore.ts` (slice), `src/components/Menu/MainItems.tsx` (row), `src/components/Sidebar/NavItem.tsx` + `src/components/MobileNav/MobileNavSheet.tsx` (open handler + mount drawer), `src/i18n/locales/{cs,en}.json`.
- Delete `src/api/confirmationOfStudy.ts` + `src/api/__tests__/confirmationOfStudy.test.ts` (superseded by `studyDocuments` + fetch-blob).

---

## Task 1: Study documents catalog (`studyDocuments.ts`)

**Files:**
- Create: `src/api/studyDocuments.ts`
- Test: `src/api/__tests__/studyDocuments.test.ts`

**Interfaces:**
- Produces:
  - `interface StudyDocument { id: string; labelKey: string; trigger: string; contentLang?: 'eng'; filename: string; }`
  - `const STUDY_DOCUMENTS: StudyDocument[]`
  - `buildDocumentUrl(sid: string, doc: StudyDocument): string`
  - `buildZadostUrl(sid: string, lang: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/api/__tests__/studyDocuments.test.ts
import { describe, it, expect } from 'vitest';
import { STUDY_DOCUMENTS, buildDocumentUrl, buildZadostUrl } from '../studyDocuments';

const byId = (id: string) => STUDY_DOCUMENTS.find(d => d.id === id)!;

describe('studyDocuments catalog', () => {
  it('lists the five one-click documents in order', () => {
    expect(STUDY_DOCUMENTS.map(d => d.id)).toEqual([
      'potvrzeni-cz', 'potvrzeni-en', 'prehled-cz', 'prehled-en', 'reg-arch',
    ]);
  });

  it('builds the sealed Czech confirmation URL', () => {
    expect(buildDocumentUrl('149707', byId('potvrzeni-cz'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1;studium=149707;lang=cz'
    );
  });

  it('adds jazyk=eng for the English confirmation', () => {
    expect(buildDocumentUrl('149707', byId('potvrzeni-en'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1;jazyk=eng;studium=149707;lang=cz'
    );
  });

  it('builds the registration-sheet URL (no jazyk)', () => {
    expect(buildDocumentUrl('149707', byId('reg-arch'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?reg_arch_tisk=1;studium=149707;lang=cz'
    );
  });

  it('maps each document to an ASCII-safe filename', () => {
    expect(byId('potvrzeni-cz').filename).toBe('Potvrzeni_o_studiu.pdf');
    expect(byId('prehled-en').filename).toBe('Study_overview.pdf');
  });

  it('builds the Žádost form link with the active UI language', () => {
    expect(buildZadostUrl('149707', 'en')).toBe(
      'https://is.mendelu.cz/auth/student/zadost.pl?studium=149707;lang=en'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/__tests__/studyDocuments.test.ts`
Expected: FAIL — cannot find module `../studyDocuments`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/api/studyDocuments.ts
import { BASE_URL } from './client';

export interface StudyDocument {
  id: string;
  /** i18n key under `documents.items.*` for the row label. */
  labelKey: string;
  /** IS trigger flag, e.g. `potvrzeni_tisk_el=1`. */
  trigger: string;
  /** Present ⇒ append `;jazyk=eng` so the document *content* is English. */
  contentLang?: 'eng';
  /** Filename handed to the browser's download manager. */
  filename: string;
}

/**
 * One-click study documents on IS's "Tisk dokumentů" page. All return a
 * synchronous `application/pdf` on a single GET (verified 2026-07-05). The
 * sealed (`_el`) variant is used wherever it exists — it is instant AND
 * carries the electronic seal. See memory `tisk-dokumentu-catalog`.
 */
export const STUDY_DOCUMENTS: StudyDocument[] = [
  { id: 'potvrzeni-cz', labelKey: 'confirmationCz', trigger: 'potvrzeni_tisk_el=1', filename: 'Potvrzeni_o_studiu.pdf' },
  { id: 'potvrzeni-en', labelKey: 'confirmationEn', trigger: 'potvrzeni_tisk_el=1', contentLang: 'eng', filename: 'Confirmation_of_study.pdf' },
  { id: 'prehled-cz', labelKey: 'overviewCz', trigger: 'prehled_tisk_el=1', filename: 'Prehled_studia.pdf' },
  { id: 'prehled-en', labelKey: 'overviewEn', trigger: 'prehled_tisk_el=1', contentLang: 'eng', filename: 'Study_overview.pdf' },
  { id: 'reg-arch', labelKey: 'regArch', trigger: 'reg_arch_tisk=1', filename: 'Registracni_arch.pdf' },
];

/** Build a direct-download URL. `lang=cz` only affects IS UI chrome (irrelevant to a download). */
export function buildDocumentUrl(sid: string, doc: StudyDocument): string {
  const jazyk = doc.contentLang ? `;jazyk=${doc.contentLang}` : '';
  return `${BASE_URL}/auth/student/tisk_dokumentu.pl?${doc.trigger}${jazyk};studium=${sid};lang=cz`;
}

/** The Žádost form (needs typed input) — opened in a new tab, not downloaded. */
export function buildZadostUrl(sid: string, lang: string): string {
  return `${BASE_URL}/auth/student/zadost.pl?studium=${sid};lang=${lang}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/__tests__/studyDocuments.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
npx eslint --max-warnings=0 src/api/studyDocuments.ts src/api/__tests__/studyDocuments.test.ts
git add src/api/studyDocuments.ts src/api/__tests__/studyDocuments.test.ts
git commit -m "feat(documents): study documents catalog + URL builders"
```

---

## Task 2: Content-script fetch-blob downloader + `download_document` action

**Files:**
- Create: `src/injector/documentDownloader.ts`
- Test: `src/injector/__tests__/documentDownloader.test.ts`
- Modify: `src/types/messages/base.ts` (add `'download_document'` to `ActionType`)
- Modify: `src/injector/messageHandler.ts` (route the action)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `downloadDocumentInPage(url: string, filename: string): Promise<void>` — resolves when the PDF blob is saved; rejects on a non-PDF/error response.

- [ ] **Step 1: Write the failing test**

```ts
// src/injector/__tests__/documentDownloader.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadDocumentInPage } from '../documentDownloader';

const pdfBlob = () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' });

describe('downloadDocumentInPage', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    document.body.innerHTML = '';
    // happy-dom lacks these; stub them.
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { clickSpy.mockRestore(); vi.restoreAllMocks(); });

  it('fetches the PDF and saves it via an <a download> with the given filename', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(pdfBlob(), { status: 200, headers: { 'content-type': 'application/pdf' } }),
    );
    let downloadName = '';
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) { downloadName = this.download; });

    await downloadDocumentInPage('https://is.mendelu.cz/x', 'Potvrzeni_o_studiu.pdf');

    expect(fetchSpy).toHaveBeenCalledWith('https://is.mendelu.cz/x', { credentials: 'include' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(downloadName).toBe('Potvrzeni_o_studiu.pdf');
  });

  it('rejects when the response is not a PDF (session expired → login HTML)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    await expect(downloadDocumentInPage('https://is.mendelu.cz/x', 'f.pdf')).rejects.toThrow();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('rejects on a 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    await expect(downloadDocumentInPage('https://is.mendelu.cz/x', 'f.pdf')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/injector/__tests__/documentDownloader.test.ts`
Expected: FAIL — cannot find module `../documentDownloader`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/injector/documentDownloader.ts
/**
 * Downloads an IS document as a real file. MUST run in the content script
 * (first-party on is.mendelu.cz), which holds the SameSite session cookie —
 * a cross-site fetch from the iframe app would get a login page instead.
 * Resolves only once the blob is saved, giving the UI a true completion signal.
 */
export async function downloadDocumentInPage(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 401 || res.status === 403) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/pdf')) {
    // A non-PDF 200 means the session lapsed and IS served a login/HTML page.
    throw new Error(`Not a PDF (${contentType || 'unknown'})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/injector/__tests__/documentDownloader.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the action type**

In `src/types/messages/base.ts`, add `'download_document'` to the `ActionType` union (after `'download_file'`):

```ts
export type ActionType = 'register_exam' | 'unregister_exam' | 'toggle_outlook_sync' | 'download_file' | 'download_document' | 'trigger_sync' | 'trigger_drive_backup' | 'push_notes' | 'refresh_exams' | 'open_url' | 'logout';
```

- [ ] **Step 6: Route the action in `messageHandler.ts`**

Add the import near the other `../api` imports:

```ts
import { downloadDocumentInPage } from "./documentDownloader";
```

Add this case inside `handleAction`'s `switch (action)` (after `refresh_exams`):

```ts
            case "download_document":
                // First-party fetch on is.mendelu.cz so the SameSite cookie rides
                // along; on a non-PDF (session lapsed) redirect to login.
                try {
                    await downloadDocumentInPage(p.url, p.filename);
                    result = { success: true };
                } catch (e) {
                    window.location.href = "https://is.mendelu.cz/system/login.pl?lang=cz";
                    throw e;
                }
                break;
```

- [ ] **Step 7: Verify build + typecheck**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
npx eslint --max-warnings=0 src/injector/documentDownloader.ts src/injector/__tests__/documentDownloader.test.ts src/injector/messageHandler.ts src/types/messages/base.ts
git add src/injector/documentDownloader.ts src/injector/__tests__/documentDownloader.test.ts src/injector/messageHandler.ts src/types/messages/base.ts
git commit -m "feat(documents): download_document action via first-party fetch-blob"
```

---

## Task 3: Iframe-side dispatcher (`proxyClient.downloadDocument`)

**Files:**
- Modify: `src/api/proxyClient.ts`
- Test: `src/api/__tests__/proxyClient.downloadDocument.test.ts`

**Interfaces:**
- Consumes: `executeAction` (existing in `proxyClient.ts`), action name `'download_document'` (Task 2).
- Produces: `downloadDocument(url: string, filename: string): Promise<void>` — resolves/rejects on the content script's action result.

- [ ] **Step 1: Write the failing test**

```ts
// src/api/__tests__/proxyClient.downloadDocument.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadDocument } from '../proxyClient';

describe('downloadDocument dispatch', () => {
  let postMessage: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { vi.useFakeTimers(); postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {}); });
  afterEach(() => { postMessage.mockRestore(); vi.clearAllTimers(); vi.useRealTimers(); });

  it('posts a download_document REIS_ACTION with url + filename', () => {
    void downloadDocument('https://is.mendelu.cz/x', 'Potvrzeni_o_studiu.pdf').catch(() => {});
    expect(postMessage).toHaveBeenCalledTimes(1);
    const msg = postMessage.mock.calls[0][0] as { type: string; action: string; payload: { url: string; filename: string } };
    expect(msg.type).toBe('REIS_ACTION');
    expect(msg.action).toBe('download_document');
    expect(msg.payload).toEqual({ url: 'https://is.mendelu.cz/x', filename: 'Potvrzeni_o_studiu.pdf' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/__tests__/proxyClient.downloadDocument.test.ts`
Expected: FAIL — `downloadDocument` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/api/proxyClient.ts`, add after `openPopup`:

```ts
/**
 * Download an IS study document. The content script performs the first-party
 * fetch (SameSite cookie); the returned promise resolves only when the file is
 * actually saved, so callers can show real completion.
 */
export function downloadDocument(url: string, filename: string): Promise<void> {
  return executeAction('download_document', { url, filename });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/__tests__/proxyClient.downloadDocument.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx eslint --max-warnings=0 src/api/proxyClient.ts src/api/__tests__/proxyClient.downloadDocument.test.ts
git add src/api/proxyClient.ts src/api/__tests__/proxyClient.downloadDocument.test.ts
git commit -m "feat(documents): proxyClient.downloadDocument dispatcher"
```

---

## Task 4: `isDocumentsOpen` store slice

**Files:**
- Create: `src/store/slices/createDocumentsSlice.ts`
- Test: `src/store/slices/__tests__/createDocumentsSlice.test.ts`
- Modify: `src/store/types.ts` (add `DocumentsSlice`, extend `AppState`), `src/store/useAppStore.ts` (compose)

**Interfaces:**
- Produces: store fields `isDocumentsOpen: boolean`, `setIsDocumentsOpen: (open: boolean) => void`.

- [ ] **Step 1: Write the failing test**

```ts
// src/store/slices/__tests__/createDocumentsSlice.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

beforeEach(() => { useAppStore.setState({ isDocumentsOpen: false }); });

describe('documents slice', () => {
  it('defaults isDocumentsOpen to false', () => {
    expect(useAppStore.getState().isDocumentsOpen).toBe(false);
  });
  it('setIsDocumentsOpen toggles the flag', () => {
    useAppStore.getState().setIsDocumentsOpen(true);
    expect(useAppStore.getState().isDocumentsOpen).toBe(true);
    useAppStore.getState().setIsDocumentsOpen(false);
    expect(useAppStore.getState().isDocumentsOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createDocumentsSlice.test.ts`
Expected: FAIL — `setIsDocumentsOpen` is undefined.

- [ ] **Step 3: Create the slice**

```ts
// src/store/slices/createDocumentsSlice.ts
import type { AppSlice, DocumentsSlice } from '../types';

export const createDocumentsSlice: AppSlice<DocumentsSlice> = (set) => ({
  isDocumentsOpen: false,
  setIsDocumentsOpen: (isOpen) => set({ isDocumentsOpen: isOpen }),
});
```

- [ ] **Step 4: Extend types**

In `src/store/types.ts`, add near the `EduroamSlice` definition:

```ts
export interface DocumentsSlice {
    isDocumentsOpen: boolean;
    setIsDocumentsOpen: (open: boolean) => void;
}
```

Then add `DocumentsSlice` to the intersection that forms `AppState` (the same `&`-list that already includes `EduroamSlice`). Locate the `EduroamSlice &` entry and add `DocumentsSlice &` next to it.

- [ ] **Step 5: Compose the slice**

In `src/store/useAppStore.ts`, add the import next to `createEduroamSlice`:

```ts
import { createDocumentsSlice } from './slices/createDocumentsSlice';
```

And add to the store object next to `...createEduroamSlice(...a),`:

```ts
  ...createDocumentsSlice(...a),
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/store/slices/__tests__/createDocumentsSlice.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npx eslint --max-warnings=0 src/store/slices/createDocumentsSlice.ts src/store/slices/__tests__/createDocumentsSlice.test.ts src/store/types.ts src/store/useAppStore.ts
git add src/store/slices/createDocumentsSlice.ts src/store/slices/__tests__/createDocumentsSlice.test.ts src/store/types.ts src/store/useAppStore.ts
git commit -m "feat(documents): isDocumentsOpen store slice"
```

---

## Task 5: `useDocumentDownload` hook

**Files:**
- Create: `src/hooks/data/useDocumentDownload.ts`
- Test: `src/hooks/data/__tests__/useDocumentDownload.test.ts`

**Interfaces:**
- Consumes: `downloadDocument` (Task 3).
- Produces: `useDocumentDownload()` → `{ status: Record<string, 'idle'|'loading'|'done'|'error'>, run: (id: string, url: string, filename: string) => void }`. On success the row goes `loading → done` then back to `idle` after 2s; on failure `loading → error`.

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/data/__tests__/useDocumentDownload.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocumentDownload } from '../useDocumentDownload';
import * as proxy from '../../../api/proxyClient';

describe('useDocumentDownload', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.restoreAllMocks());

  it('drives a row loading → done on success', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockResolvedValue(undefined);
    const { result } = renderHook(() => useDocumentDownload());
    act(() => { result.current.run('potvrzeni-cz', 'https://x', 'f.pdf'); });
    expect(result.current.status['potvrzeni-cz']).toBe('loading');
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('done'));
  });

  it('drives a row loading → error on failure', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDocumentDownload());
    act(() => { result.current.run('reg-arch', 'https://x', 'f.pdf'); });
    await waitFor(() => expect(result.current.status['reg-arch']).toBe('error'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/data/__tests__/useDocumentDownload.test.ts`
Expected: FAIL — cannot find module `../useDocumentDownload`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/data/useDocumentDownload.ts
import { useCallback, useRef, useState } from 'react';
import { downloadDocument } from '../../api/proxyClient';
import { logError } from '../../utils/reportError';

export type DownloadStatus = 'idle' | 'loading' | 'done' | 'error';

/** Per-row download state for the documents drawer. Not in the store — this is
 *  transient UI state scoped to the open drawer. */
export function useDocumentDownload() {
  const [status, setStatus] = useState<Record<string, DownloadStatus>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const run = useCallback((id: string, url: string, filename: string) => {
    clearTimeout(timers.current[id]);
    setStatus(s => ({ ...s, [id]: 'loading' }));
    downloadDocument(url, filename)
      .then(() => {
        setStatus(s => ({ ...s, [id]: 'done' }));
        timers.current[id] = setTimeout(() => setStatus(s => ({ ...s, [id]: 'idle' })), 2000);
      })
      .catch((e) => {
        logError('Documents.download', e);
        setStatus(s => ({ ...s, [id]: 'error' }));
      });
  }, []);

  return { status, run };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/data/__tests__/useDocumentDownload.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
npx eslint --max-warnings=0 src/hooks/data/useDocumentDownload.ts src/hooks/data/__tests__/useDocumentDownload.test.ts
git add src/hooks/data/useDocumentDownload.ts src/hooks/data/__tests__/useDocumentDownload.test.ts
git commit -m "feat(documents): useDocumentDownload per-row status hook"
```

---

## Task 6: `DocumentsDrawer` component

**Files:**
- Create: `src/components/StudyDocuments/DocumentsDrawer.tsx`
- Test: `src/components/StudyDocuments/__tests__/DocumentsDrawer.test.tsx`

**Interfaces:**
- Consumes: `useAppStore` (`isDocumentsOpen`, `setIsDocumentsOpen`), `useUserParams` (for `studium`), `STUDY_DOCUMENTS`/`buildDocumentUrl`/`buildZadostUrl` (Task 1), `useDocumentDownload` (Task 5), `AdaptiveDrawer`, `useTranslation`, store `language`.
- Produces: `DocumentsDrawer` (self-connecting, no props) — render at app root.

Note: `useUserParams` exposes `params?.studium`; language via `useAppStore(s => s.language)`. Mirror `EduroamDrawer` for the `AdaptiveDrawer` shell.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/StudyDocuments/__tests__/DocumentsDrawer.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentsDrawer } from '../DocumentsDrawer';
import { useAppStore } from '../../../store/useAppStore';
import * as proxy from '../../../api/proxyClient';

vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: { studium: '149707' } }) }));

describe('DocumentsDrawer', () => {
  beforeEach(() => { useAppStore.setState({ isDocumentsOpen: true, language: 'cz' }); });
  afterEach(() => { vi.restoreAllMocks(); useAppStore.setState({ isDocumentsOpen: false }); });

  it('renders a row per catalog document plus the Žádost link', () => {
    render(<DocumentsDrawer />);
    expect(screen.getByText('Potvrzení o studiu')).toBeTruthy();
    expect(screen.getByText('Confirmation of study')).toBeTruthy();
    expect(screen.getByText('Tisk registračního archu')).toBeTruthy();
  });

  it('downloads on row click and shows completion', async () => {
    const spy = vi.spyOn(proxy, 'downloadDocument').mockResolvedValue(undefined);
    render(<DocumentsDrawer />);
    fireEvent.click(screen.getByText('Potvrzení o studiu'));
    expect(spy).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1;studium=149707;lang=cz',
      'Potvrzeni_o_studiu.pdf',
    );
    await waitFor(() => expect(screen.getByLabelText('done')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/StudyDocuments/__tests__/DocumentsDrawer.test.tsx`
Expected: FAIL — cannot find module `../DocumentsDrawer`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/StudyDocuments/DocumentsDrawer.tsx
import { FileCheck2, FileText, ScrollText, Loader2, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useUserParams } from '../../hooks/useUserParams';
import { useTranslation } from '../../hooks/useTranslation';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import { STUDY_DOCUMENTS, buildDocumentUrl, buildZadostUrl } from '../../api/studyDocuments';
import { useDocumentDownload, type DownloadStatus } from '../../hooks/data/useDocumentDownload';

const ICONS: Record<string, typeof FileText> = {
  'potvrzeni-cz': FileCheck2, 'potvrzeni-en': FileCheck2,
  'prehled-cz': FileText, 'prehled-en': FileText, 'reg-arch': ScrollText,
};

function StatusIcon({ status }: { status: DownloadStatus }) {
  if (status === 'loading') return <Loader2 className="w-4 h-4 animate-spin" aria-label="loading" />;
  if (status === 'done') return <Check className="w-4 h-4 text-success" aria-label="done" />;
  if (status === 'error') return <AlertTriangle className="w-4 h-4 text-error" aria-label="error" />;
  return null;
}

/** Documents panel opened from the Student flyout. Self-connects to the store. */
export function DocumentsDrawer() {
  const { t } = useTranslation();
  const isOpen = useAppStore(s => s.isDocumentsOpen);
  const setOpen = useAppStore(s => s.setIsDocumentsOpen);
  const language = useAppStore(s => s.language);
  const { params } = useUserParams();
  const sid = params?.studium ?? '';
  const { status, run } = useDocumentDownload();

  return (
    <AdaptiveDrawer open={isOpen} onClose={() => setOpen(false)} width="sm:w-[460px]" title={t('documents.title')}>
      <div className="flex flex-col gap-1 p-3">
        {STUDY_DOCUMENTS.map(doc => {
          const Icon = ICONS[doc.id] ?? FileText;
          const st = status[doc.id] ?? 'idle';
          return (
            <button
              key={doc.id}
              disabled={!sid || st === 'loading'}
              onClick={() => run(doc.id, buildDocumentUrl(sid, doc), doc.filename)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-base-200 disabled:opacity-50 transition-colors text-left"
            >
              <Icon className="w-5 h-5 text-primary shrink-0" />
              <span className="flex-1 font-medium">{t(`documents.items.${doc.labelKey}`)}</span>
              <StatusIcon status={st} />
            </button>
          );
        })}
        <a
          href={buildZadostUrl(sid, language)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 mt-1 border-t border-base-300 rounded-lg text-sm text-base-content/70 hover:bg-base-200 transition-colors"
        >
          <ScrollText className="w-5 h-5 shrink-0" />
          <span className="flex-1 font-medium">{t('documents.items.zadost')}</span>
          <ExternalLink className="w-3.5 h-3.5 text-base-content/40" />
        </a>
      </div>
    </AdaptiveDrawer>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/StudyDocuments/__tests__/DocumentsDrawer.test.tsx`
Expected: PASS (2 tests). If `AdaptiveDrawer` renders children only when open, the `isDocumentsOpen: true` in `beforeEach` covers it.

- [ ] **Step 5: Commit**

```bash
npx eslint --max-warnings=0 src/components/StudyDocuments/DocumentsDrawer.tsx src/components/StudyDocuments/__tests__/DocumentsDrawer.test.tsx
git add src/components/StudyDocuments/
git commit -m "feat(documents): DocumentsDrawer with per-row download status"
```

---

## Task 7: Wire into the flyout, i18n, and remove the old confirmation path

**Files:**
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`
- Modify: `src/components/Menu/MainItems.tsx`
- Modify: `src/components/Sidebar/NavItem.tsx`, `src/components/MobileNav/MobileNavSheet.tsx`
- Modify: `src/components/Menu/__tests__/MainItems.test.ts`
- Mount `DocumentsDrawer` where `EduroamDrawer` is mounted
- Delete: `src/api/confirmationOfStudy.ts`, `src/api/__tests__/confirmationOfStudy.test.ts`

- [ ] **Step 1: Add i18n keys**

In `src/i18n/locales/cs.json`, add under `sidebar` (keep existing `confirmation` key removed if unused elsewhere — verify with grep in Step 7):

```json
"documents": "Tisk dokumentů",
```

Add a top-level `documents` block:

```json
"documents": {
  "title": "Tisk dokumentů",
  "items": {
    "confirmationCz": "Potvrzení o studiu",
    "confirmationEn": "Confirmation of study",
    "overviewCz": "Přehled studia",
    "overviewEn": "Study overview",
    "regArch": "Tisk registračního archu",
    "zadost": "Žádost na studijní oddělení"
  }
}
```

In `src/i18n/locales/en.json`, add under `sidebar`:

```json
"documents": "Print documents",
```

Add:

```json
"documents": {
  "title": "Print documents",
  "items": {
    "confirmationCz": "Confirmation of study (Czech)",
    "confirmationEn": "Confirmation of study (English)",
    "overviewCz": "Study overview (Czech)",
    "overviewEn": "Study overview (English)",
    "regArch": "Print the registration sheet",
    "zadost": "Request to the study department"
  }
}
```

- [ ] **Step 2: Replace the flyout row in `MainItems.tsx`**

Remove the `buildConfirmationUrl` import and the `potvrzeni-studia` child. Replace with a `dokumenty` row. Update the icon import to include `FileText`:

```tsx
// import line: add FileText, drop FileCheck2 if now unused
{ id: 'dokumenty', label: t('sidebar.documents'), icon: <FileText className="w-4 h-4" />, isFeature: true },
```

(Keep it in the same first-position slot the `potvrzeni-studia` row occupied.)

- [ ] **Step 3: Update `MainItems.test.ts`**

Replace the old `potvrzeni-studia` assertions with:

```ts
it('is the first entry in the "is" item\'s children', () => {
  const items = mainItems('143752', '812', t, 'cz');
  const isItem = items.find(i => i.id === 'is')!;
  expect(isItem.children![0].id).toBe('dokumenty');
});

it('uses the sidebar.documents i18n key and has no href (opens the drawer)', () => {
  const items = mainItems('143752', '812', t, 'cz');
  const row = items.find(i => i.id === 'is')!.children!.find(c => c.id === 'dokumenty')!;
  expect(row.label).toBe('sidebar.documents');
  expect(row.href).toBeUndefined();
});
```

Run: `npx vitest run src/components/Menu/__tests__/MainItems.test.ts` — expect PASS.

- [ ] **Step 4: Open the drawer from the flyout handlers**

In `src/components/Sidebar/NavItem.tsx`: add `const setIsDocumentsOpen = useAppStore(s => s.setIsDocumentsOpen);` next to `setIsEduroamOpen`, and add a branch in the child `onClick` chain (replace any `potvrzeni-studia` branch):

```tsx
                    } else if (child.id === 'dokumenty') {
                      e.preventDefault();
                      setIsDocumentsOpen(true);
```

In `src/components/MobileNav/MobileNavSheet.tsx`: add `const setIsDocumentsOpen = useAppStore(s => s.setIsDocumentsOpen);` and a branch (replace any `potvrzeni-studia` branch):

```tsx
    } else if (child.id === 'dokumenty') {
      setIsDocumentsOpen(true);
```

Remove the now-unused `downloadConfirmation`/`confirmationOfStudy` imports from both files.

- [ ] **Step 5: Mount the drawer**

Find where `<EduroamDrawer />` is rendered (`grep -rn "EduroamDrawer" src --include=*.tsx | grep -v __tests__`) and add `<DocumentsDrawer />` beside it, with the import `import { DocumentsDrawer } from '.../StudyDocuments/DocumentsDrawer';`.

- [ ] **Step 6: Delete the superseded confirmation module**

```bash
git rm src/api/confirmationOfStudy.ts src/api/__tests__/confirmationOfStudy.test.ts
```

- [ ] **Step 7: Verify nothing else references removed symbols**

```bash
grep -rn "confirmationOfStudy\|downloadConfirmation\|buildConfirmationUrl\|potvrzeni-studia\|sidebar.confirmation" src
```

Expected: no matches. If `sidebar.confirmation` is still present in the locale files and unused, remove it.

- [ ] **Step 8: Full verification**

```bash
npm run test:run
npm run typecheck   # note: 3 pre-existing errors in ErasmusPanel/createErasmusSlice/useExamActions are unrelated — no NEW errors in touched files
npx eslint --max-warnings=0 $(git diff --name-only HEAD | grep -E '\.(ts|tsx)$')
npm run build       # exit 0
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(documents): wire Tisk dokumentu drawer into flyout; remove single-confirmation path"
```

---

## Manual verification (after Task 7)

Chrome MCP can't drive the extension iframe, so verify by hand:
1. `npm run build`, reload the unpacked extension at `chrome://extensions` (⟳), hard-refresh an `is.mendelu.cz` tab.
2. Open the Student flyout → click **Tisk dokumentů** → the drawer lists 5 docs + Žádost.
3. Click **Potvrzení o studiu** → spinner → a real `Potvrzeni_o_studiu.pdf` downloads → checkmark. Confirm the file is a valid PDF (not a login page).
4. Repeat for the English confirmation and the registration sheet; confirm the Žádost row opens the IS form in a new tab.

## Self-review notes

- Spec coverage: entry point (T6/T7), CZ+EN rows (T1 catalog + T6 rows), fetch-blob real completion (T2/T3/T5), store flag (T4), error/redirect (T2 handler), Žádost link-out (T1/T6), tests each task. ✓
- The `download_confirmation` action from the WIP is intentionally never introduced; `download_document` replaces it. ✓
- Names are consistent across tasks: `downloadDocumentInPage` (content), `downloadDocument` (proxy), `useDocumentDownload`, `isDocumentsOpen`, `STUDY_DOCUMENTS`. ✓
