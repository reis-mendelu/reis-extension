import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendFeedbackReport } from '@/api/feedbackReport';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

afterEach(() => vi.restoreAllMocks());

const report = {
  type: 'bug' as const,
  title: 'Rozvrh se nenačte',
  message: 'Po přihlášení je kalendář prázdný.',
  contact: 'jan@example.com',
};

// Typed as fetch rather than inferred: a zero-arg mock gives `mock.calls` the
// type `[]`, so every assertion on the URL or the init below stops compiling.
// The generic supplies that signature without declaring parameters the body
// does not use, which the no-unused-vars rule rejects even underscore-prefixed.
const resp = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

describe('sendFeedbackReport', () => {
  it('posts to the edge function, never to Discord', async () => {
    const fetchMock = resp({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendFeedbackReport(report);

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/functions/v1/feedback-relay');
    expect(url).not.toContain('discord.com');
  });

  it('sends the shared secret so the relay can reject strangers', async () => {
    const fetchMock = resp({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendFeedbackReport(report);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['x-reis-extension-secret']).toBeTruthy();
  });

  it('sends the report and the diagnostic context the triage channel needs', async () => {
    const fetchMock = resp({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendFeedbackReport(report);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      type: 'bug',
      title: 'Rozvrh se nenačte',
      message: 'Po přihlášení je kalendář prázdný.',
      contact: 'jan@example.com',
    });
    // The client no longer formats Discord's envelope — no username, no
    // avatar_url, no markdown `content`. That is the relay's job now, and
    // leaving it here would mean a Discord-shaped payload still described the
    // wire format the APK carries.
    expect(body).not.toHaveProperty('content');
    expect(body).not.toHaveProperty('username');
    expect(body.context).toMatchObject({ version: expect.any(String) });
  });

  it('reports success only when the relay confirms it', async () => {
    vi.stubGlobal('fetch', resp({ ok: true }));
    expect(await sendFeedbackReport(report)).toBe(true);
  });

  it('treats a 2xx that does not confirm as a failure', async () => {
    // A proxy or captive portal answering 200 with its own body must not be
    // read as "your feedback was delivered" — nobody would ever resend.
    vi.stubGlobal('fetch', resp({}, 200));
    expect(await sendFeedbackReport(report)).toBe(false);
  });

  it('returns false rather than throwing when the relay rejects', async () => {
    vi.stubGlobal('fetch', resp({ error: 'unauthorized' }, 401));
    expect(await sendFeedbackReport(report)).toBe(false);
  });

  it('returns false rather than throwing when the network is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );
    expect(await sendFeedbackReport(report)).toBe(false);
  });
});

describe('the shipped bundle', () => {
  // The whole point of this change: the APK is public, and a Discord webhook
  // accepts unauthenticated POSTs from anyone holding its URL. A test that only
  // checked the new call path would still pass with the old constant sitting
  // in the bundle, which is exactly the state this replaces.
  it('carries no Discord webhook URL in src/', () => {
    // Assembled at runtime so this file does not match its own scan — the
    // literal must appear nowhere in src/, including here.
    const needle = ['discord.com', 'api', 'webhooks'].join('/');
    const root = resolve(__dirname, '../..');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry.name) && readFileSync(path, 'utf8').includes(needle)) {
          hits.push(path);
        }
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
