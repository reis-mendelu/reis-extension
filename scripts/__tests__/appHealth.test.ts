import { describe, it, expect } from 'vitest';
import { evaluateHealth, formatHealthReport, type HealthObservations } from '../appHealth';

/** A build that is working, in real-data mode. */
const healthy: HealthObservations = {
  requests: ['https://x.supabase.co/rest/v1/spolky_events?select=*', '/preview-data.json'],
  storeCounts: { schedule: 1, subjects: 1, study_plan: 1, files: 19, syllabuses: 19 },
  skeletonCount: 0,
  textLength: 900,
  outputFiles: ['index.html', 'preview-data.json', 'assets'],
  mode: 'real',
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

  it('fails when a required store is missing entirely', () => {
    const { subjects: _omitted, ...without } = healthy.storeCounts;
    const r = evaluateHealth({ ...healthy, storeCounts: without });
    expect(r.failures.map((f) => f.detail).join()).toMatch(/no `subjects` store/);
  });

  it('fails on a request to IS Mendelu', () => {
    const r = evaluateHealth({
      ...healthy,
      requests: [...healthy.requests, 'https://is.mendelu.cz/auth/student/studium.pl'],
    });
    expect(r.failures.map((f) => f.check)).toContain('forbidden request');
  });

  it.each([
    'https://x.supabase.co/rest/v1/rpc/track_daily_usage',
    'https://x.supabase.co/rest/v1/rpc/submit_suggestion',
    'https://x.supabase.co/rest/v1/rpc/submit_feedback',
    'https://x.supabase.co/rest/v1/rpc/set_event_rsvp',
  ])('fails on the write RPC %s', (url) => {
    const r = evaluateHealth({ ...healthy, requests: [...healthy.requests, url] });
    expect(r.ok).toBe(false);
  });

  // Read-only society content is expected and must not trip the check, or the
  // gate cries wolf and gets muted.
  it('allows the read-only society calls', () => {
    const r = evaluateHealth({
      ...healthy,
      requests: [
        ...healthy.requests,
        'https://x.supabase.co/rest/v1/rpc/get_event_rsvps',
        'https://x.supabase.co/rest/v1/spolky_events?select=id',
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('fails if the page fetched the raw scrape rather than the sanitised file', () => {
    const r = evaluateHealth({
      ...healthy,
      requests: [...healthy.requests, '/dev-real-data.json'],
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
      requests: ['https://is.mendelu.cz/x'],
    });
    expect(r.failures.length).toBeGreaterThanOrEqual(3);
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
