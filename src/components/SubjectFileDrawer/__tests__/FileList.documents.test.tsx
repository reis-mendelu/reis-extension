import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileNameText } from '../FileName';
import { dl, LECTURES, LONE, renderList } from './fileListFixtures';

vi.mock('../../../hooks/data/useDocumentNoteKeys', () => ({
  useDocumentNoteKeys: () => ({ noteKeys: new Set<string>() }),
}));

describe('FileList: a document with several files', () => {
  it('names each file by its own name, and the document once above them', () => {
    renderList([LECTURES]);
    // Shown readable (no extension, separators as spaces); the real name on hover.
    expect(screen.getByTitle('ig-03-fyzicka_vrstva.pdf')).toHaveTextContent(
      /^ig 03 fyzicka vrstva$/
    );
    expect(screen.getByTitle('eth_frame.pdf')).toHaveTextContent(/^eth frame$/);
    expect(screen.getByTitle('ig-04-Ethernet.pdf')).toHaveTextContent(/^ig 04 Ethernet$/);
    expect(screen.getAllByText('ig 03 + ig 04 + ig 05')).toHaveLength(1);
    expect(screen.queryByText(/\(\d\)$/)).toBeNull();
  });

  it('hands the reader the file name it shows, and the date of the last change', async () => {
    // The iPad reader keeps a copy only while this date matches: a replaced
    // file has to reach it with its Modifikace, or the old pages stay.
    const props = renderList([LECTURES]);
    await userEvent.click(screen.getByTitle('eth_frame.pdf'));
    expect(props.onViewPdf).toHaveBeenCalledWith(dl(2), {
      name: 'eth_frame.pdf',
      date: '15.10.2026',
    });
  });
});

describe('FileList: long names', () => {
  /**
   * A one-line truncate cut "ig-c04-fyzicka_vrstva.pdf" mid-name. Names now
   * read as text ("ig c04 fyzicka vrstva") and wrap to two lines; past two the
   * middle is cut, which needs layout and is measured in the browser
   * (verify-ui), while the cut itself is unit-tested in documentLabels.test.ts.
   */
  it('wraps a name to two lines between words instead of cutting it on one', () => {
    renderList([LECTURES]);
    const name = screen.getByTitle('ig-03-fyzicka_vrstva.pdf');
    expect(name.className).toContain('line-clamp-2');
    expect(name.className).toContain('break-words');
    expect(name.className).not.toContain('truncate');
  });

  it('gives screen readers the whole name when the visible one is cut', () => {
    render(
      <FileNameText shown="ig organizac…novani" full="ig organizacni informace kombinovani" />
    );
    expect(screen.getByText('ig organizac…novani')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('ig organizacni informace kombinovani')).toHaveClass('sr-only');
  });

  it('adds nothing for screen readers when the name is whole', () => {
    const { container } = render(<FileNameText shown="eth frame" full="eth frame" />);
    expect(container.textContent).toBe('eth frame');
    expect(container.querySelector('.sr-only')).toBeNull();
  });
});

describe('FileList: a document with one file', () => {
  it('goes by its title as IS prints it, with nothing stripped', () => {
    renderList([LONE]);
    expect(screen.getByText('Harmonogram+organizacni informace')).toBeInTheDocument();
  });

  it('shows the document date, not the reader date', () => {
    renderList([{ ...LONE, modified: '23.10.2026' }]);
    expect(screen.getByText('17.09.2026')).toBeInTheDocument();
    expect(screen.queryByText('23.10.2026')).toBeNull();
  });

  it("gives IS's comment its own line, so the author cannot crowd it out on a phone", () => {
    renderList([{ ...LONE, file_comment: 'Cvičení 4 rozvrhovaná na sudý týd...' }]);
    const comment = screen.getByText('Cvičení 4 rozvrhovaná na sudý týd...');
    expect(comment.parentElement).not.toBe(screen.getByText('P. Svoboda').parentElement);
    expect(comment.className).toContain('line-clamp-2');
  });

  it('says who put it there', () => {
    renderList([LONE]);
    expect(screen.getByText('P. Svoboda')).toBeInTheDocument();
  });
});
