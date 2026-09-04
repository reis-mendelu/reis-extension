import { describe, it, expect, beforeEach } from 'vitest';
import { formatSnapshotAge, mountSnapshotAge } from '../snapshotAge';

const NOW = new Date('2026-09-04T12:00:00.000Z');

describe('formatSnapshotAge', () => {
  it('says today for a snapshot taken this morning', () => {
    expect(formatSnapshotAge('2026-09-04T08:00:00.000Z', NOW)).toBe('data scraped today');
  });

  it('counts whole days', () => {
    expect(formatSnapshotAge('2026-09-02T08:00:00.000Z', NOW)).toBe('data scraped 2 days ago');
  });

  it('uses the singular for one day', () => {
    expect(formatSnapshotAge('2026-09-03T08:00:00.000Z', NOW)).toBe('data scraped 1 day ago');
  });

  // An unreadable date must not silently render as "today", which would be the
  // most misleading possible answer.
  it('says so when the date cannot be read', () => {
    expect(formatSnapshotAge('not-a-date', NOW)).toBe('snapshot date unknown');
  });

  // The snapshot's actual `lastSync` field is a numeric epoch-ms timestamp
  // (confirmed against public/preview-data.json), not an ISO string —
  // stringifying it first (`String(1788509744145)`) produces an Invalid
  // Date, so the function must accept the number directly.
  it('reads a numeric epoch timestamp, the shape the snapshot actually carries', () => {
    expect(formatSnapshotAge(Date.UTC(2026, 8, 2, 8, 0, 0), NOW)).toBe('data scraped 2 days ago');
  });
});

describe('mountSnapshotAge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows nothing outside the real-data build', () => {
    mountSnapshotAge({ VITE_PREVIEW_BUILD: 'true' }, '2026-09-04T08:00:00.000Z', document);
    expect(document.querySelector('[data-testid="snapshot-age"]')).toBeNull();
  });

  it('shows the age in the real-data build', () => {
    mountSnapshotAge(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      '2026-09-02T08:00:00.000Z',
      document
    );
    const el = document.querySelector('[data-testid="snapshot-age"]');
    expect(el?.textContent).toContain('2 days ago');
  });

  it('mounts only once', () => {
    const env = { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' };
    mountSnapshotAge(env, '2026-09-04T08:00:00.000Z', document);
    mountSnapshotAge(env, '2026-09-04T08:00:00.000Z', document);
    expect(document.querySelectorAll('[data-testid="snapshot-age"]')).toHaveLength(1);
  });

  it('accepts the numeric epoch timestamp the snapshot actually carries', () => {
    mountSnapshotAge(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      Date.UTC(2026, 8, 2, 8, 0, 0),
      document
    );
    const el = document.querySelector('[data-testid="snapshot-age"]');
    expect(el?.textContent).toContain('2 days ago');
  });
});
