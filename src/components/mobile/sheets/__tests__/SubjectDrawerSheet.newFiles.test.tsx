import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { IndexedDBService } from '../../../../services/storage/IndexedDBService';
import { LECTURES, LONE } from '../../../SubjectFileDrawer/__tests__/fileListFixtures';
import type { SubjectInfo } from '../../../../types/documents';

vi.mock('../../../../hooks/data/useDocumentNoteKeys', () => ({
  useDocumentNoteKeys: () => ({ noteKeys: new Set<string>() }),
}));

const ALG: SubjectInfo = {
  displayName: 'ALG',
  fullName: 'Algoritmizace',
  subjectCode: 'ALG',
  subjectId: '159410',
  folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1',
  fetchedAt: new Date().toISOString(),
};
const VISITED = new Date(2026, 9, 10).getTime(); // 10.10.2026

/**
 * "NOVÉ" marks a document changed since the student last opened the subject.
 * The extension's drawer read that last visit; the phone/iPad sheet never did,
 * so the badge could not appear there (release check, 11 November 2026).
 */
describe('SubjectDrawerSheet — NOVÉ since the last visit', () => {
  beforeEach(async () => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      subjects: { version: 1, lastUpdated: new Date().toISOString(), data: { ALG } },
      schedule: { data: [], status: 'success' },
      files: { ALG: [LECTURES, LONE] },
      lastFilesFetchedAt: { ALG: Date.now() },
    } as never);
    await IndexedDBService.set('meta', 'file_last_visit_ALG', VISITED);
  });

  const open = () =>
    render(
      <SubjectDrawerSheet
        sheet={{ kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' }}
        onClose={() => {}}
      />
    );

  it('marks the document changed since the last visit', async () => {
    open();
    expect(await screen.findAllByText('NOVÉ')).toHaveLength(1);
  });

  it('records this visit for next time', async () => {
    open();
    await waitFor(async () =>
      expect(await IndexedDBService.get('meta', 'file_last_visit_ALG')).toBeGreaterThan(VISITED)
    );
  });
});
