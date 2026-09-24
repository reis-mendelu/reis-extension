import { describe, it, expect } from 'vitest';
import { mergeFolderListing } from '../mergeFolderListing';
import type { ParsedFile } from '../../../../types/documents';

const row = (name: string, dok: string, subfolder = ''): ParsedFile => ({
  subfolder,
  file_name: name,
  file_comment: '',
  author: '',
  date: '',
  files: [
    {
      name,
      type: 'pdf',
      link: `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${dok};id=1`,
    },
  ],
});

describe('mergeFolderListing', () => {
  it('mirrors IS exactly after a complete crawl, so a deleted file goes', () => {
    const previous = [row('Old', '1'), row('Kept', '2')];
    const fresh = [row('Kept', '2'), row('New', '3')];

    const merged = mergeFolderListing(previous, { files: fresh, complete: true });

    expect(merged.map((f) => f.file_name)).toEqual(['Kept', 'New']);
  });

  it('keeps every file already on the device when part of the crawl failed', () => {
    const previous = [row('Lecture 1', '1', 'Lectures'), row('Syllabus', '2')];
    const fresh = [row('Syllabus', '2'), row('Lecture 2', '3', 'Lectures')];

    const merged = mergeFolderListing(previous, { files: fresh, complete: false });

    expect(merged.map((f) => f.file_name).sort()).toEqual(['Lecture 1', 'Lecture 2', 'Syllabus']);
  });

  it('takes the fresh row over the cached one for the same document', () => {
    const previous = [{ ...row('Syllabus', '2'), file_comment: 'stale' }];
    const fresh = [{ ...row('Syllabus', '2'), file_comment: 'updated' }];

    const merged = mergeFolderListing(previous, { files: fresh, complete: false });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.file_comment).toBe('updated');
  });

  it('matches a document by its IS id, not its link, whose token changes per fetch', () => {
    const viewer = (token: string): ParsedFile => ({
      ...row('Notes', '0'),
      files: [
        {
          name: 'Notes',
          type: 'unknown',
          link: `https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?id=1;dok=77;serializace=${token}`,
        },
      ],
    });

    const merged = mergeFolderListing([viewer('a')], { files: [viewer('b')], complete: false });

    expect(merged).toHaveLength(1);
  });

  it('with nothing cached, returns the crawl as it is', () => {
    const fresh = [row('A', '1')];
    expect(mergeFolderListing(undefined, { files: fresh, complete: false })).toEqual(fresh);
  });
});
