import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { FileList } from '../FileList';
import type { FileGroup } from '../types';
import type { ParsedFile } from '../../../types/documents';

/** Shared by the FileList.*.test.tsx files: rows shaped like what IS really serves. */
export const dl = (id: number) =>
  `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${id};id=1`;

export const doc = (over: Partial<ParsedFile>): ParsedFile => ({
  subfolder: '',
  file_name: 'x',
  file_comment: '',
  author: 'J. Novák',
  date: '07.10.2026',
  files: [],
  ...over,
});

/** A lecture row with three PDFs and a lone lecture, the shapes IS really serves. */
export const LECTURES = doc({
  file_name: 'ig-03  ig-04  ig-05',
  title: 'ig-03 + ig-04 + ig-05',
  date: '07.10.2026',
  modified: '15.10.2026',
  files: [
    { name: 'x', type: 'pdf', link: dl(1), filename: 'ig-03-fyzicka_vrstva.pdf' },
    { name: 'x', type: 'pdf', link: dl(2), filename: 'eth_frame.pdf' },
    { name: 'x', type: 'pdf', link: dl(3), filename: 'ig-04-Ethernet.pdf' },
  ],
});
export const LONE = doc({
  file_name: 'Harmonogramorganizacni informace',
  title: 'Harmonogram+organizacni informace',
  author: 'P. Svoboda',
  date: '17.09.2026',
  files: [{ name: 'x', type: 'pdf', link: dl(4), filename: 'harm.pdf' }],
});

export function renderList(files: ParsedFile[], over: Record<string, unknown> = {}) {
  const groups: FileGroup[] = [{ name: 'Ostatní', displayName: 'Ostatní', files }];
  const props = {
    groups,
    selectedIds: [],
    courseCode: 'EBC-PS',
    fileRefs: { current: new Map() },
    ignoreClickRef: { current: false },
    onToggleSelect: vi.fn(),
    onOpenFile: vi.fn(),
    onViewPdf: vi.fn(),
    ...over,
  };
  render(<FileList {...(props as unknown as Parameters<typeof FileList>[0])} />);
  return props;
}
