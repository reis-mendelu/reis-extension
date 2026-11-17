import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { dl, doc, LECTURES, LONE, renderList } from './fileListFixtures';

vi.mock('../../../hooks/data/useDocumentNoteKeys', () => ({
  useDocumentNoteKeys: () => ({ noteKeys: new Set<string>() }),
}));

describe('FileList: cleaned titles and same-name files', () => {
  it('cleans the document heading, the original on hover', () => {
    renderList([LECTURES]);
    const heading = screen.getByRole('heading', { name: 'ig 03 + ig 04 + ig 05' });
    expect(heading).toHaveAttribute('title', 'ig-03 + ig-04 + ig-05');
  });

  it('cleans a single-file title, keeping a spaced dash and a plus', () => {
    renderList([doc({ ...LONE, title: 'Moderni_smery - cast+1' })]);
    expect(screen.getByTitle('Moderni_smery - cast+1')).toHaveTextContent(
      /^Moderni smery - cast\+1$/
    );
  });

  it('shows the extension only for files that would read the same', () => {
    renderList([
      doc({
        title: 'Reading week - Flexbox',
        files: [
          { name: 'x', type: 'unknown', link: dl(11), filename: 'instrukce.md' },
          { name: 'x', type: 'docx', link: dl(12), filename: 'instrukce.docx' },
          { name: 'x', type: 'html', link: dl(13), filename: 'prednaska-demo.html' },
        ],
      }),
    ]);
    expect(screen.getByTitle('instrukce.md')).toHaveTextContent(/^instrukce \(md\)$/);
    expect(screen.getByTitle('instrukce.docx')).toHaveTextContent(/^instrukce \(docx\)$/);
    expect(screen.getByTitle('prednaska-demo.html')).toHaveTextContent(/^prednaska demo$/);
  });

  it('does the same for single-file documents in one folder', () => {
    renderList([
      doc({ title: 'Prezentace_1', files: [{ name: 'x', type: 'pdf', link: dl(21) }] }),
      doc({ title: 'Prezentace 1', files: [{ name: 'x', type: 'pptx', link: dl(22) }] }),
      doc({ title: 'Harmonogram', files: [{ name: 'x', type: 'pdf', link: dl(23) }] }),
    ]);
    expect(screen.getByTitle('Prezentace_1')).toHaveTextContent(/^Prezentace 1 \(pdf\)$/);
    expect(screen.getByTitle('Prezentace 1')).toHaveTextContent(/^Prezentace 1 \(pptx\)$/);
    expect(screen.getByTitle('Harmonogram')).toHaveTextContent(/^Harmonogram$/);
  });
});

describe('FileList: "Nový"', () => {
  const visited = new Date(2026, 9, 10).getTime(); // 10.10.2026

  it('marks a document the teacher changed since the last visit, though its date is older', () => {
    renderList([LECTURES], { lastVisitedAt: visited });
    expect(screen.getAllByText('NOVÉ')).toHaveLength(1);
  });

  it('leaves a document alone that has not changed since', () => {
    renderList([LONE], { lastVisitedAt: visited });
    expect(screen.queryByText('NOVÉ')).toBeNull();
  });

  it('reads English dates as well', () => {
    renderList([doc({ ...LONE, date: '09/17/2026', modified: '10/23/2026' })], {
      lastVisitedAt: visited,
    });
    expect(screen.getAllByText('NOVÉ')).toHaveLength(1);
  });
});
