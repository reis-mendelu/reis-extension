import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'cz' }),
}));

const mockSetNote = vi.fn();
let note = '';
let isLoading = false;

vi.mock('@/hooks/data/useDocumentNote', () => ({
  useDocumentNote: () => ({
    note,
    setNote: (...args: unknown[]) => mockSetNote(...args),
    isLoading,
    isSaving: false,
    hasError: false,
  }),
}));

import { DocumentNoteEditor } from '../DocumentNoteEditor';

function noteWith(question: string) {
  return JSON.stringify({ cards: [{ id: 'c1', question, answer: '', collapsed: false, images: [] }], notes: '' });
}

function questionInputs() {
  return screen.getAllByPlaceholderText('course.documentNote.questionPlaceholder') as HTMLInputElement[];
}

describe('DocumentNoteEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLoading = false;
    note = noteWith('first');
  });

  it('focuses the question field of a card the student just added', async () => {
    render(<DocumentNoteEditor courseCode="EBC" fileLink="/f/1" fileName="slides.pdf" onClose={() => {}} />);
    expect(questionInputs()).toHaveLength(1);

    fireEvent.click(screen.getByText('course.documentNote.addCard'));

    await waitFor(() => expect(questionInputs()).toHaveLength(2));
    expect(document.activeElement).toBe(questionInputs()[1]);
  });

  it('re-hydrates when the file changes, but not when the stored note changes underneath', () => {
    const { rerender } = render(
      <DocumentNoteEditor courseCode="EBC" fileLink="/f/1" fileName="slides.pdf" onClose={() => {}} />
    );
    expect(questionInputs()[0]!.value).toBe('first');

    // A save round-trip rewrites the stored note. Re-reading it here would throw
    // away whatever the student has typed since.
    note = noteWith('server echo');
    rerender(<DocumentNoteEditor courseCode="EBC" fileLink="/f/1" fileName="slides.pdf" onClose={() => {}} />);
    expect(questionInputs()[0]!.value).toBe('first');

    // A different file is a different note, and must be read in.
    note = noteWith('other file');
    rerender(<DocumentNoteEditor courseCode="EBC" fileLink="/f/2" fileName="other.pdf" onClose={() => {}} />);
    expect(questionInputs()[0]!.value).toBe('other file');
  });
});
