import { describe, it, expect } from 'vitest';
import { toResult, toError, CHARACTER_LIMIT } from '../format';

describe('toResult', () => {
  it('markdown mode returns text only, never structuredContent', () => {
    const r = toResult({ a: 1 }, 'markdown');
    expect(r.content[0]!.type).toBe('text');
    expect(r.content[0]!.text).toBe('- **a:** 1');
    expect('structuredContent' in r).toBe(false);
  });

  it('json mode attaches structuredContent when it fits, wrapping arrays under value', () => {
    const r = toResult([1, 2], 'json');
    expect(r).toMatchObject({ structuredContent: { value: [1, 2] } });
  });

  it('json mode drops structuredContent and truncates text past the limit', () => {
    const r = toResult({ s: 'x'.repeat(CHARACTER_LIMIT + 10) }, 'json');
    expect('structuredContent' in r).toBe(false);
    expect(r.content[0]!.text).toContain('[truncated at');
  });
});

describe('toError', () => {
  it('is an MCP error result naming the tool', () => {
    const r = toError('mendelu_exams', new Error('boom'));
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toBe('Error in mendelu_exams: boom');
  });
});
