import { describe, it, expect } from 'vitest';
import { buildContent, DISCORD_CONTENT_LIMIT } from '../content.ts';

// The caps the relay applies to individual fields before calling buildContent.
const MAX = { title: 140, message: 1200, contact: 120 };

describe('buildContent', () => {
  it('keeps a normal report intact', () => {
    const out = buildContent({
      type: 'bug',
      contact: 'jan@example.com',
      message: 'Po přihlášení je kalendář prázdný.',
      context: { version: '5.0.5', host: 'android' },
    });
    expect(out).toContain('Po přihlášení je kalendář prázdný.');
    expect(out).toContain('jan@example.com');
    expect(out).toContain('"version": "5.0.5"');
    expect(out).not.toContain('zkráceno');
  });

  it('stays within Discord’s limit at the worst case every field cap allows', () => {
    // This is the defect the field caps alone did not prevent: 1200 + 120 +
    // a large context assembled to ~2295 characters, Discord rejected the
    // payload, and a student's long, careful bug report was lost to a 502.
    const out = buildContent({
      type: 'other',
      contact: 'c'.repeat(MAX.contact),
      message: 'm'.repeat(MAX.message),
      context: { blob: 'x'.repeat(5000) },
    });
    expect(out.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT);
  });

  it('spends the budget on the student’s words before the diagnostics', () => {
    const message = 'm'.repeat(MAX.message);
    const out = buildContent({
      type: 'bug',
      contact: '',
      message,
      context: { blob: 'x'.repeat(5000) },
    });
    // The message survives whole; the JSON is what gives way.
    expect(out).toContain(message);
    expect(out.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT);
  });

  it('truncates the message only when it alone cannot fit', () => {
    const out = buildContent({
      type: 'bug',
      contact: '',
      message: 'm'.repeat(4000),
      context: {},
    });
    expect(out.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT);
    expect(out).toContain('zkráceno');
  });

  it('never leaves an unclosed code fence behind', () => {
    // Trimming the JSON by raw character count would cut the closing ``` and
    // turn the rest of the channel message into a code block.
    const out = buildContent({
      type: 'bug',
      contact: '',
      message: 'm'.repeat(1100),
      context: { blob: 'x'.repeat(5000) },
    });
    const fences = out.split('```').length - 1;
    expect(fences % 2).toBe(0);
  });

  it('defangs a code fence typed into the report', () => {
    // Discord renders markdown, so a student pasting ``` would otherwise break
    // out of the JSON block and reformat everything after it.
    const out = buildContent({
      type: 'bug',
      contact: '',
      message: 'tady je chyba',
      context: { note: 'x```y' },
    });
    const fences = out.split('```').length - 1;
    expect(fences % 2).toBe(0);
  });

  it('omits the diagnostic block rather than emitting an empty one', () => {
    const out = buildContent({
      type: 'bug',
      contact: '',
      message: 'm'.repeat(DISCORD_CONTENT_LIMIT - 60),
      context: { blob: 'x'.repeat(5000) },
    });
    expect(out.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT);
    expect(out).not.toContain('```json\n\n```');
  });
});
