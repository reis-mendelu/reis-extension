import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { useSyllabus } from '../../../../hooks/data/useSyllabus';

vi.mock('../../../SubjectFileDrawer/PdfViewer', () => ({ PdfViewer: () => null }));
vi.mock('../../../../hooks/data/useSyllabus', () => ({
  useSyllabus: vi.fn(() => ({ syllabus: null, isLoading: false })),
}));

/**
 * Renaming a subject on the phone: the pencil in the sheet's header, a field,
 * and Uložit / Zrušit as buttons, because a phone keyboard has no Escape. The
 * extension has had this since its drawer title became editable; the phone
 * had no way to set a nickname at all.
 */
describe('SubjectDrawerSheet — renaming the subject', () => {
  beforeEach(() => {
    vi.mocked(useSyllabus).mockClear();
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      courseNicknames: {},
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      subjects: { version: 1, lastUpdated: '', data: {} },
      files: { ALG: [] },
      lastFilesFetchedAt: { ALG: Date.now() },
      schedule: { data: [], status: 'success' },
    } as never);
  });

  const renderSheet = () =>
    render(
      <SubjectDrawerSheet
        sheet={{ kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' }}
        onClose={vi.fn()}
      />
    );
  const pencil = () => screen.getByRole('button', { name: 'Přejmenovat předmět' });
  const field = () => screen.getByRole('textbox', { name: 'Název předmětu' });

  it('has a pencil a thumb can hit, visible without hover', () => {
    renderSheet();
    expect(pencil().className).toMatch(/min-h-11/);
    expect(pencil().className).toMatch(/min-w-11/);
    expect(pencil().className).not.toMatch(/opacity-0/);
  });

  it('saves a nickname, which the header then shows above the IS name', () => {
    renderSheet();
    fireEvent.click(pencil());
    // Prefilled with the name it has now, at 16px so iOS does not zoom.
    expect(field()).toHaveValue('Algoritmizace');
    expect(field().className).toMatch(/text-base/);
    fireEvent.change(field(), { target: { value: 'Algo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(useAppStore.getState().courseNicknames).toEqual({ ALG: 'Algo' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Algo')).toBeInTheDocument();
    expect(screen.getByText('V IS: Algoritmizace')).toBeInTheDocument();
  });

  it('saves on the keyboard’s Done key too', () => {
    renderSheet();
    fireEvent.click(pencil());
    expect(field()).toHaveAttribute('enterkeyhint', 'done');
    fireEvent.change(field(), { target: { value: 'Algo' } });
    fireEvent.submit(field());
    expect(useAppStore.getState().courseNicknames).toEqual({ ALG: 'Algo' });
  });

  it('Zrušit leaves the name as it was', () => {
    renderSheet();
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: 'Algo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit' }));
    expect(useAppStore.getState().courseNicknames).toEqual({});
    expect(screen.getByText('Algoritmizace')).toBeInTheDocument();
  });

  it('resets to the IS name', () => {
    useAppStore.setState({ courseNicknames: { ALG: 'Algo' } } as never);
    renderSheet();
    fireEvent.click(pencil());
    fireEvent.click(screen.getByRole('button', { name: 'Vrátit název z IS' }));
    expect(useAppStore.getState().courseNicknames).toEqual({});
    expect(screen.getByText('Algoritmizace')).toBeInTheDocument();
    expect(screen.queryByText(/V IS:/)).toBeNull();
  });

  it('offers no reset while there is nothing to reset', () => {
    renderSheet();
    fireEvent.click(pencil());
    expect(screen.queryByRole('button', { name: 'Vrátit název z IS' })).toBeNull();
  });

  it('an emptied field, or the IS name itself, clears the nickname', () => {
    useAppStore.setState({ courseNicknames: { ALG: 'Algo' } } as never);
    renderSheet();
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(useAppStore.getState().courseNicknames).toEqual({});

    useAppStore.setState({ courseNicknames: { ALG: 'Algo' } } as never);
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: 'Algoritmizace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(useAppStore.getState().courseNicknames).toEqual({});
  });

  // The nickname is a label. The syllabus is looked up by IS's own name.
  it('still asks for the syllabus by the IS name', () => {
    useAppStore.setState({ courseNicknames: { ALG: 'Algo' } } as never);
    renderSheet();
    expect(vi.mocked(useSyllabus)).toHaveBeenCalledWith('ALG', '', 'Algoritmizace');
  });
});
