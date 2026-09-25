import { describe, it, expect } from 'vitest';
import { replyEmail, buildReplyHref, REPLY_ACCOUNT } from '../suggestionReply';

const row = {
  title: 'přihlášení na wifi',
  body: 'Dobrý den,\nchci se přihlásit z macu.',
  contact: 'xbrazda@mendelu.cz',
};

describe('replyEmail', () => {
  it('returns a trimmed address when the contact is an email', () => {
    expect(replyEmail('  xbrazda@mendelu.cz ')).toBe('xbrazda@mendelu.cz');
  });

  it.each([null, '', '+420 777 123 456', '@discordname', 'jan novak@mendelu.cz', 'a@b'])(
    'returns null for a contact that is not an email: %s',
    (contact) => {
      expect(replyEmail(contact)).toBeNull();
    }
  );
});

describe('buildReplyHref', () => {
  it('is null when there is no email to reply to', () => {
    expect(buildReplyHref({ ...row, contact: '+420 777 123 456' }, { native: false })).toBeNull();
  });

  it('opens a Gmail draft in the reIS account off the native app', () => {
    const url = new URL(buildReplyHref(row, { native: false })!);
    expect(url.origin + url.pathname).toBe('https://mail.google.com/mail/');
    expect(url.searchParams.get('view')).toBe('cm');
    expect(url.searchParams.get('authuser')).toBe(REPLY_ACCOUNT);
    expect(url.searchParams.get('to')).toBe('xbrazda@mendelu.cz');
    expect(url.searchParams.get('su')).toBe('Re: přihlášení na wifi');
  });

  it('quotes the original message under an empty first line', () => {
    const url = new URL(buildReplyHref(row, { native: false })!);
    expect(url.searchParams.get('body')).toBe('\n\n> Dobrý den,\n> chci se přihlásit z macu.');
  });

  // mailto (RFC 6068) takes %20, not the '+' form encoding produces — a '+'
  // would reach the subject line literally.
  it('encodes spaces as %20, never +', () => {
    expect(buildReplyHref(row, { native: false })).not.toContain('+');
    expect(buildReplyHref(row, { native: true })).not.toContain('+');
  });

  it('hands the native app a mailto: for the platform mail app', () => {
    const href = buildReplyHref(row, { native: true })!;
    expect(href.startsWith('mailto:xbrazda@mendelu.cz?')).toBe(true);
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect(params.get('subject')).toBe('Re: přihlášení na wifi');
    expect(params.get('body')).toBe('\n\n> Dobrý den,\n> chci se přihlásit z macu.');
  });

  it('keeps a full 2000-character message within a URL Gmail accepts', () => {
    const long = { ...row, title: 'ř'.repeat(120), body: 'ž'.repeat(2000) };
    expect(buildReplyHref(long, { native: false })!.length).toBeLessThan(16_000);
  });
});
