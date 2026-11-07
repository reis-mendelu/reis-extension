import { describe, it, expect } from 'vitest';
import { groupAndSortFiles } from '../groupFiles';
import type { ParsedFile } from '../../../../types/documents';

const doc = (file_name: string, date: string, modified?: string): ParsedFile => ({
  subfolder: '',
  file_name,
  file_comment: '',
  author: '',
  date,
  ...(modified ? { modified } : {}),
  files: [],
});

describe('groupAndSortFiles', () => {
  it('puts the newest first in Czech and in English dates alike', () => {
    const t = () => 'Ostatní';
    const cz = groupAndSortFiles([doc('A', '17.09.2026'), doc('B', '23.10.2026')], 'X', t);
    const en = groupAndSortFiles([doc('A', '09/17/2026'), doc('B', '10/23/2026')], 'X', t);
    expect(cz[0]?.files.map((f) => f.file_name)).toEqual(['B', 'A']);
    expect(en[0]?.files.map((f) => f.file_name)).toEqual(['B', 'A']);
  });

  it('puts a document the teacher replaced above newer-dated ones, as IS sorts by default', () => {
    const t = () => 'Ostatní';
    const groups = groupAndSortFiles(
      [doc('Newer', '14.10.2026'), doc('Replaced', '17.09.2026', '23.10.2026')],
      'X',
      t
    );
    expect(groups[0]?.files.map((f) => f.file_name)).toEqual(['Replaced', 'Newer']);
  });
});
