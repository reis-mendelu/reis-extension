import { describe, it, expect } from 'vitest';
import { changeLines, diffWorld } from '../overviewDiff';
import { parseSnapshot, snapshotOf, type World } from '../overviewRecord';

const f = (n: number, m = '1. 1. 2026') => ({
  url: `https://x/download=${n}`,
  label: `f${n}.pdf`,
  modified: m,
});
const world = (over: Partial<World> = {}): World => ({
  subjects: [{ code: 'A-1', name: 'Alpha' }],
  files: { 'A-1': [f(1), f(2)] },
  points: { 'A-1': [{ key: 'PH / T1', text: 'Body=5' }] },
  boxes: [
    {
      key: 'A-1|Box',
      code: 'A-1',
      name: 'Box',
      deadline: '1.1.2030',
      open: true,
      submission: '',
      points: '',
    },
  ],
  exams: [
    {
      key: 'A-1|s|t1',
      code: 'A-1',
      section: 'z',
      state: 'open',
      date: '2.2.2030',
      time: '9:00',
      room: '',
    },
  ],
  ...over,
});
const seen = (w = world()) => snapshotOf(w, null);

describe('diffWorld', () => {
  it('finds nothing when nothing is different', () => {
    expect(diffWorld(seen(), world())).toEqual([]);
  });

  it('leaves the old record alone for a part that was not read, and says nothing about it', () => {
    const prev = seen();
    const failed = world({ files: {}, points: {}, boxes: undefined, exams: undefined });
    expect(diffWorld(prev, failed)).toEqual([]);
    const next = snapshotOf(failed, prev);
    expect(next.files['A-1']).toEqual(prev.files['A-1']);
    expect(next.points['A-1']).toEqual(prev.points['A-1']);
    expect(next.boxes).toEqual(prev.boxes);
    expect(next.exams).toEqual(prev.exams);
    // and when it comes back unchanged it is still quiet
    expect(diffWorld(next, world())).toEqual([]);
  });

  it('keeps no grade in the record, only a fingerprint', () => {
    expect(JSON.stringify(seen())).not.toContain('Body=5');
  });

  it('does not take a registered term, or one already seen, for a new one', () => {
    const w = world({
      exams: [
        {
          key: 'A-1|s|t9',
          code: 'A-1',
          section: 'z',
          state: 'registered',
          date: '3.3.2030',
          time: '',
          room: '',
        },
      ],
    });
    expect(diffWorld(seen(), w)).toEqual([]);
  });

  it('is not fooled by keys named like object properties', () => {
    const w = world({
      files: {
        'A-1': [
          { url: '__proto__', label: 'p', modified: '1' },
          { url: 'constructor', label: 'c', modified: '1' },
        ],
      },
      points: { 'A-1': [{ key: 'toString', text: '1' }] },
    });
    const prev = snapshotOf(w, null);
    expect(diffWorld(prev, w)).toEqual([]);
    const plain = world({
      files: { 'A-1': [{ url: 'x', label: 'x', modified: '1' }] },
      points: { 'A-1': [] },
    });
    expect(diffWorld(snapshotOf(plain, null), w).map((c) => c.text)).toEqual([
      'New file in A-1: p (1)',
      'New file in A-1: c (1)',
      'File gone from IS in A-1: x',
      'New points row in A-1: toString',
    ]);
  });
});

describe('changeLines', () => {
  it('sums up a long run of files per subject instead of cutting, and keeps every other change', () => {
    const many = Array.from({ length: 50 }, (_, i) => f(i + 10));
    const changes = diffWorld(
      seen(),
      world({
        files: { 'A-1': [f(1), f(2), ...many] },
        points: { 'A-1': [{ key: 'PH / T1', text: 'Body=9' }] },
      })
    );
    const lines = changeLines(changes);
    expect(lines).toEqual([
      '50 new files in A-1 (see the map below)',
      '1 new or changed points rows in A-1 (see the map below)',
    ]);
  });
});

describe('a part that could not be read last time', () => {
  it('is reported as new when it is read later, not recorded unseen', () => {
    const unread = world({ files: {}, points: {}, boxes: undefined, exams: undefined });
    const prev = snapshotOf(unread, null);
    expect(prev.files['A-1']).toBeUndefined();
    const lines = diffWorld(prev, world()).map((c) => c.text);
    expect(lines).toEqual([
      expect.stringContaining('New file in A-1: f1.pdf'),
      expect.stringContaining('New file in A-1: f2.pdf'),
      expect.stringContaining('New points row in A-1: PH / T1'),
      expect.stringContaining('New assignment box in A-1: Box'),
      expect.stringContaining('New exam term in A-1'),
    ]);
    // once reported and recorded, it is quiet again
    expect(diffWorld(snapshotOf(world(), prev), world())).toEqual([]);
  });

  it('still reports a brand-new subject as one line, and a part still unread as nothing', () => {
    const prev = seen();
    const w = world({
      subjects: [
        { code: 'A-1', name: 'Alpha' },
        { code: 'B-2', name: 'Beta' },
      ],
      files: { 'A-1': [f(1), f(2)], 'B-2': [f(7), f(8)] },
      points: { 'A-1': [{ key: 'PH / T1', text: 'Body=5' }] },
    });
    expect(diffWorld(prev, w).map((c) => c.text)).toEqual(['New subject: B-2 Beta']);
  });
});

describe('parseSnapshot', () => {
  it('reads what it wrote and nothing else', () => {
    expect(parseSnapshot(JSON.stringify(seen()))).toEqual(seen());
    for (const bad of [
      undefined,
      '',
      'nope',
      '{}',
      '[]',
      '{"version":2,"subjects":{},"files":{},"points":{}}',
    ]) {
      expect(parseSnapshot(bad)).toBeNull();
    }
  });
});
