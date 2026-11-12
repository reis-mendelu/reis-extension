import { describe, it, expect } from 'vitest';
import { attachmentFilename } from '../attachmentFilename';

describe('attachmentFilename', () => {
  it('keeps a long name whole, so its extension is the real one', () => {
    const long = `${'a'.repeat(240)}.ipynb`;
    const link = document.createElement('a');
    link.innerHTML = `<span data-sysid="mime-unknown" title="${long}"></span>`;
    expect(attachmentFilename(link)).toBe(long);
  });
});
