import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarScreen } from '../../components/mobile/screens/CalendarScreen';
import { ExamsScreen } from '../../components/mobile/screens/ExamsScreen';
import { SubjectDrawerSheet } from '../../components/mobile/sheets/SubjectDrawerSheet';
import { baseState } from '../../components/mobile/screens/__tests__/pullTestSetup';
import { useAppStore } from '../../store/useAppStore';
import { syncService } from '../../services/sync';

vi.mock('../../hooks/ui/useFileActions', () => ({
  useFileActions: () => ({
    isDownloading: false,
    downloadProgress: null,
    openFile: vi.fn(),
    openPdfInline: vi.fn(),
    downloadSingle: vi.fn(),
    downloadZip: vi.fn(),
  }),
}));
vi.mock('../../components/SubjectFileDrawer/PdfViewer', () => ({ PdfViewer: () => null }));

/**
 * The Mac half of pullToRefreshIsPhoneOnly, pinned by RENDERING rather than by
 * reading source: every screen that refreshes by a pull also has a VISIBLE
 * refresh control when there is no touch pointer.
 *
 * The iPad app on an Apple Silicon Mac runs the phone tree with
 * `pointer: fine`. Neither a mouse drag nor a trackpad scroll makes the touch
 * pull, so without these circles a Mac student cannot refresh the timetable,
 * the exam terms or a subject's files at all. On a touch screen the same
 * buttons are `sr-only` (the pull is the visible route) — also pinned here, so
 * the guard cannot pass by making them visible everywhere.
 */
const subject = () =>
  render(
    <SubjectDrawerSheet
      sheet={{ kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' }}
      onClose={vi.fn()}
    />
  );

const CASES = [
  { where: 'calendar', label: 'Obnovit', mount: () => render(<CalendarScreen />) },
  { where: 'exams', label: 'Obnovit zkoušky', mount: () => render(<ExamsScreen />) },
  { where: 'subject Files tab', label: 'Obnovit soubory', mount: subject },
];

describe('a visible refresh wherever nothing can pull', () => {
  const spies: { mockRestore: () => void }[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    spies.push(vi.spyOn(syncService, 'triggerScheduleRefresh').mockResolvedValue(undefined));
    spies.push(vi.spyOn(syncService, 'triggerExamRefresh').mockResolvedValue(undefined));
    baseState({
      subjects: {
        version: 1,
        lastUpdated: '',
        data: { ALG: { displayName: 'ALG', subjectCode: 'ALG', subjectId: '1', fetchedAt: '' } },
      },
      files: { ALG: [] },
      filesLoading: {},
      lastFilesFetchedAt: { ALG: Date.now() },
    });
  });
  afterEach(() => {
    spies.splice(0).forEach((s) => s.mockRestore());
    vi.useRealTimers();
  });

  it.each(CASES)('$where: a visible 40px circle without a touch pointer', ({ label, mount }) => {
    useAppStore.setState({ isTouch: false } as never);
    mount();
    const button = screen.getByRole('button', { name: label });
    expect(button.className).not.toContain('sr-only');
    expect(button.className).toContain('h-10');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it.each(CASES)('$where: screen-reader only on a touch screen', ({ label, mount }) => {
    mount();
    expect(screen.getByRole('button', { name: label }).className).toContain('sr-only');
  });

  it('the calendar circle sits in the header row and refreshes the timetable', () => {
    useAppStore.setState({ isTouch: false } as never);
    render(<CalendarScreen />);
    const button = screen.getByRole('button', { name: 'Obnovit' });
    // Same row as the header actions, so the header is no taller than any
    // other tab's.
    expect(button.closest('.justify-between')).toBe(
      screen.getByLabelText('Hledat').closest('.justify-between')
    );
    fireEvent.click(button);
    expect(syncService.triggerScheduleRefresh).toHaveBeenCalledTimes(1);
  });
});
