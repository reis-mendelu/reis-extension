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

  it('says so when there is nothing', () => {
    expect(toMarkdown([])).toBe('Nothing found.');
    expect(toMarkdown(null)).toBe('Nothing found.');
  });
});
