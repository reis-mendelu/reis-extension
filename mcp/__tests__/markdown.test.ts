import { describe, it, expect } from 'vitest';
import { toMarkdown } from '../markdown';

describe('toMarkdown', () => {
  it('renders an array of flat objects as a table', () => {
    expect(toMarkdown([{ code: 'EBC-PS', name: 'Sítě' }])).toBe(
      '| code | name |\n| --- | --- |\n| EBC-PS | Sítě |'
    );
  });

  it('renders objects as nested bullets and skips null/empty values', () => {
    expect(toMarkdown({ a: 1, b: null, c: { d: 'x' }, e: [] })).toBe(
      '- **a:** 1\n- **c:**\n  - **d:** x'
    );
  });

  it('escapes pipes and flattens newlines inside table cells', () => {
    expect(toMarkdown([{ n: 'a|b\nc' }])).toContain('a\\|b c');
  });

  it('escapes backslashes before pipes, so a cell cannot open a new column', () => {
    expect(toMarkdown([{ path: 'C:\\x|y', end: 'a\\' }])).toBe(
      '| path | end |\n| --- | --- |\n| C:\\\\x\\|y | a\\\\ |'
    );
  });

  it('renders a nested list of flat rows as an indented table', () => {
    expect(toMarkdown({ grades: [{ code: 'A', grade: 'B' }] })).toBe(
      '- **grades:**\n\n  | code | grade |\n  | --- | --- |\n  | A | B |\n'
    );
  });

  it('keeps the line breaks of multi-line text values', () => {
    expect(toMarkdown({ kind: 'pdf', text: 'Slide 1\nSlide 2' })).toBe(
      '- **kind:** pdf\n- **text:**\n\n  Slide 1\n  Slide 2\n'
    );
  });

  it('says so when there is nothing', () => {
    expect(toMarkdown([])).toBe('Nothing found.');
    expect(toMarkdown(null)).toBe('Nothing found.');
    expect(toMarkdown({ a: null, b: [] })).toBe('Nothing found.');
  });
});
