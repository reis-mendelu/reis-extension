import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { NOW, box } from '../../../SubmissionBoxes/__tests__/boxFixtures';

/**
 * The Subjects screen's odevzdávárny card opens a box's subject straight on
 * Záznamník, where the box is — and the tab's badge counts boxes too, so the
 * tab says there is something there before it is opened.
 */
describe('SubjectDrawerSheet — submission boxes', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      mobileSheets: [],
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      subjects: {
        version: 1,
        lastUpdated: '',
        data: { 'EBC-PJ': { subjectId: 'P1', subjectCode: 'EBC-PJ' } },
      },
      schedule: { data: [], status: 'success' },
      files: { 'EBC-PJ': [] },
      zaznamnik: {},
      zaznamnikHydrated: true,
      odevzdavarny: [box({ name: 'Rozpracovaný projekt' }), box({ name: 'Jiný', courseId: 'P2' })],
    } as never);
  });

  const tab = (label: string) =>
    screen.getAllByRole('button').find((b) => b.textContent?.includes(label))!;

  it('opens on the tab the caller asks for', () => {
    render(
      <SubjectDrawerSheet
        sheet={{ kind: 'subjectDrawer', courseCode: 'EBC-PJ', initialTab: 'zaznamnik' }}
        onClose={() => {}}
      />
    );
    expect(tab('Záznamník')).toHaveClass('border-primary');
    expect(screen.getByText('Rozpracovaný projekt')).toBeInTheDocument();
  });

  it('counts this subject’s boxes in the Záznamník badge', () => {
    render(
      <SubjectDrawerSheet
        sheet={{ kind: 'subjectDrawer', courseCode: 'EBC-PJ' }}
        onClose={() => {}}
      />
    );
    expect(tab('Záznamník').textContent).toContain('1');
  });
});
