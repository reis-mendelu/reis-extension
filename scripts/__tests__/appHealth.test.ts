import { describe, it, expect } from 'vitest';
import { evaluateHealth, formatHealthReport, type HealthObservations } from '../appHealth';

/** A build that is working, in real-data mode. */
const SUPA = 'https://zvbpgkmnrqyprtkyxkwn.supabase.co';
const get = (url: string) => ({ url, method: 'GET' });
const post = (url: string) => ({ url, method: 'POST' });

const healthy: HealthObservations = {
  requests: [get(`${SUPA}/rest/v1/spolky_events?select=*`), get('/preview-data.json')],
  storeCounts: { schedule: 1, subjects: 1, study_plan: 1, files: 19, syllabuses: 19 },
  skeletonCount: 0,
  textLength: 900,
  outputFiles: ['index.html', 'preview-data.json', 'assets'],
  mode: 'real',
  visual: { 'calendar 320px dark': [], 'calendar 390px dark': [] },
};

describe('evaluateHealth', () => {
  it('passes a working real-data build', () => {
    expect(evaluateHealth(healthy)).toEqual({ ok: true, failures: [] });
  });

  it('passes a demo build without the real-data stores', () => {
    const demo: HealthObservations = {
      ...healthy,
      storeCounts: { schedule: 1 },
      outputFiles: ['index.html', 'assets'],
      mode: 'demo',
    };
    expect(evaluateHealth(demo).ok).toBe(true);
  });

  // The defect this script exists for: the app fetched its data and nothing
  // was listening, so every screen sat on a skeleton and looked merely slow.
  it('fails when the app is stuck on skeletons', () => {
    const r = evaluateHealth({ ...healthy, skeletonCount: 12 });
    expect(r.ok).toBe(false);
    expect(r.failures.map((f) => f.check)).toContain('stuck on skeletons');
  });

  it('fails when a required store is empty', () => {
    const r = evaluateHealth({ ...healthy, storeCounts: { ...healthy.storeCounts, files: 0 } });
    expect(r.failures.map((f) => f.detail).join()).toMatch(/`files` is empty/);
  });

  // The driver reports a failed count as -1. Before this, -1 sailed past the
  // `=== 0` test and an unreadable store read as healthy.
  it('fails when a store cannot be counted', () => {
    const r = evaluateHealth({
      ...healthy,
      storeCounts: { ...healthy.storeCounts, files: -1 },
    });
    expect(r.failures.map((f) => f.check)).toContain('store unreadable');
  });

  it('fails when a required store is missing entirely', () => {
    const without = { ...healthy.storeCounts };
    delete without.subjects;
    const r = evaluateHealth({ ...healthy, storeCounts: without });
    expect(r.failures.map((f) => f.detail).join()).toMatch(/no `subjects` store/);
  });

  it('fails on a request to IS Mendelu', () => {
    const r = evaluateHealth({
      ...healthy,
      requests: [...healthy.requests, get('https://is.mendelu.cz/auth/student/studium.pl')],
    });
    expect(r.failures.map((f) => f.check)).toContain('forbidden request');
  });

  // Named writes, and the two the first version's denylist missed entirely.
  it.each([
    'track_daily_usage',
    'submit_suggestion',
    'submit_feedback',
    'set_event_rsvp',
    'increment_post_view',
    'increment_post_click',
    'some_rpc_added_next_semester',
  ])('fails on the write RPC %s', (rpc) => {
    const r = evaluateHealth({
      ...healthy,
      requests: [...healthy.requests, post(`${SUPA}/rest/v1/rpc/${rpc}`)],
    });
    expect(r.ok).toBe(false);
    expect(r.failures.map((f) => f.check)).toContain('supabase write');
  });

  // Every supabase.rpc() is a POST, read-only ones included, so the rule cannot
  // simply be "no POST to Supabase".
  it('allows the read-only RPC even though it is a POST', () => {
    const r = evaluateHealth({
      ...healthy,
      requests: [...healthy.requests, post(`${SUPA}/rest/v1/rpc/get_event_rsvps`)],
    });
    expect(r.ok).toBe(true);
  });

  it('fails a bare table write', () => {
    const r = evaluateHealth({
      ...healthy,
      requests: [...healthy.requests, { url: `${SUPA}/rest/v1/spolky_events`, method: 'PATCH' }],
    });
    expect(r.failures.map((f) => f.check)).toContain('supabase write');
  });

  // Read-only society content is expected and must not trip the check, or the
  // gate cries wolf and gets muted.
  it('allows the read-only society calls', () => {
    const r = evaluateHealth({
      ...healthy,
      requests: [
        ...healthy.requests,
        post(`${SUPA}/rest/v1/rpc/get_event_rsvps`),
        get(`${SUPA}/rest/v1/spolky_events?select=id`),
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('fails if the page fetched the raw scrape rather than the sanitised file', () => {
    const r = evaluateHealth({
      ...healthy,
      requests: [...healthy.requests, get('/dev-real-data.json')],
    });
    expect(r.failures.map((f) => f.check)).toContain('forbidden request');
  });

  it('fails if the raw scrape is sitting in the build output', () => {
    const r = evaluateHealth({
      ...healthy,
      outputFiles: [...healthy.outputFiles, 'dev-real-data.json'],
    });
    expect(r.failures.map((f) => f.check)).toContain('raw scrape in output');
  });

  // A blank page trips no other rule, because nothing rendered to be wrong.
  it('fails a page that rendered nothing', () => {
    const r = evaluateHealth({ ...healthy, textLength: 12 });
    expect(r.failures.map((f) => f.check)).toContain('nothing rendered');
  });

  // Measured from the real demo build: the calendar on a day with no lessons
  // renders ~190 characters and is entirely correct. A threshold that failed
  // it would cry wolf on the first honest screen it met.
  it('passes a legitimately short screen', () => {
    expect(evaluateHealth({ ...healthy, textLength: 190 }).ok).toBe(true);
  });

  it('reports every problem at once rather than stopping at the first', () => {
    const r = evaluateHealth({
      ...healthy,
      skeletonCount: 3,
      textLength: 4,
      requests: [get('https://is.mendelu.cz/x')],
    });
    expect(r.failures.length).toBeGreaterThanOrEqual(3);
  });
});

describe('layout findings', () => {
  const overflow = {
    kind: 'overflow' as const,
    sel: 'div.some-panel',
    detail: 'document scrolls 34px wider than the viewport',
    severity: 'error' as const,
  };
  const lowContrast = {
    kind: 'contrast-text' as const,
    sel: 'span.hint',
    detail: 'text contrast 2.15:1 against its surface',
    severity: 'warn' as const,
  };

  it('fails on horizontal overflow, naming the width', () => {
    const r = evaluateHealth({
      ...healthy,
      visual: { ...healthy.visual, 'subjects 320px light': [overflow] },
    });
    expect(r.ok).toBe(false);
    expect(r.failures.map((f) => f.check)).toContain('layout overflow · subjects 320px light');
  });

  it('fails on a collision', () => {
    const collision = { ...overflow, kind: 'collision' as const, detail: 'a covers b' };
    const r = evaluateHealth({
      ...healthy,
      visual: { ...healthy.visual, 'map 430px dark': [collision] },
    });
    expect(r.failures.map((f) => f.check)).toContain('layout collision · map 430px dark');
  });

  // Contrast carries judgement and this repo has pre-existing theme-token
  // findings. Failing on them would block unrelated PRs until someone muted the
  // gate, which is how a useful gate dies.
  it('does NOT fail on a contrast warning', () => {
    const r = evaluateHealth({
      ...healthy,
      visual: { ...healthy.visual, 'exams 390px light': [lowContrast] },
    });
    expect(r.ok).toBe(true);
  });

  it('names the element in the failure, so the log is actionable alone', () => {
    const r = evaluateHealth({
      ...healthy,
      visual: { ...healthy.visual, 'subjects 320px dark': [overflow] },
    });
    expect(r.failures[0]!.detail).toContain('div.some-panel');
  });

  it('reports a failure at each view/width/theme independently', () => {
    const r = evaluateHealth({
      ...healthy,
      visual: {
        'calendar 320px dark': [overflow],
        'calendar 390px dark': [],
        'settings 430px light': [overflow],
      },
    });
    expect(r.failures.filter((f) => f.check.startsWith('layout'))).toHaveLength(2);
  });
});

describe('formatHealthReport', () => {
  it('says OK when healthy', () => {
    expect(formatHealthReport({ ok: true, failures: [] }, 'demo')).toMatch(/OK \(demo data\)/);
  });

  it('names each failure so a CI log is actionable on its own', () => {
    const out = formatHealthReport(evaluateHealth({ ...healthy, skeletonCount: 5 }), 'real');
    expect(out).toMatch(/FAILED \(real data\)/);
    expect(out).toMatch(/stuck on skeletons/);
    expect(out).toMatch(/5 element/);
  });
});
