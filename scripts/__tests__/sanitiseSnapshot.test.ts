import { describe, it, expect } from 'vitest';
import { sanitiseSnapshot } from '../sanitiseSnapshot';

// Shape copied from the real snapshot; every value here is invented.
const raw = {
  lastSync: '2026-09-04T09:00:00.000Z',
  schedule: [{ date: '20260904' }],
  classmates: {
    'EXC-KPSIT': [
      {
        name: 'Novakova Jana, Bc.',
        personId: 100904,
        photoUrl: 'https://is.mendelu.cz/auth/lide/foto.pl?id=100904;lang=cz',
        messageUrl: '/auth/posta/nova_zprava.pl?uzivatel=100904',
        studyInfo: 'PEF N-OI-ZNUR prez [sem 3, roc 2]',
      },
      {
        name: 'Dvorak Petr',
        personId: 100905,
        photoUrl: 'https://is.mendelu.cz/auth/lide/foto.pl?id=100905;lang=cz',
        messageUrl: '/auth/posta/nova_zprava.pl?uzivatel=100905',
        studyInfo: 'PEF B-EM prez [sem 1, roc 1]',
      },
    ],
    'EBC-M': [],
  },
};

describe('sanitiseSnapshot', () => {
  it('keeps every group and every row', () => {
    const { data } = sanitiseSnapshot(raw);
    const c = data.classmates as Record<string, unknown[]>;
    expect(Object.keys(c).sort()).toEqual(['EBC-M', 'EXC-KPSIT']);
    expect(c['EXC-KPSIT']).toHaveLength(2);
    expect(c['EBC-M']).toHaveLength(0);
  });

  // Each of these re-identifies the person the fake name was meant to protect:
  // photoUrl and messageUrl both embed the personId.
  it('removes every identifying field', () => {
    const { data } = sanitiseSnapshot(raw);
    const first = (data.classmates as Record<string, Record<string, unknown>[]>)['EXC-KPSIT']![0]!;
    expect(first).not.toHaveProperty('personId');
    expect(first).not.toHaveProperty('photoUrl');
    expect(first).not.toHaveProperty('messageUrl');
  });

  it('replaces the real name and keeps studyInfo', () => {
    const { data } = sanitiseSnapshot(raw);
    const first = (data.classmates as Record<string, Record<string, unknown>[]>)['EXC-KPSIT']![0]!;
    expect(first.name).not.toBe('Novakova Jana, Bc.');
    expect(typeof first.name).toBe('string');
    expect((first.name as string).length).toBeGreaterThan(0);
    expect(first.studyInfo).toBe('PEF N-OI-ZNUR prez [sem 3, roc 2]');
  });

  // Stable output keeps a diff of two snapshots readable.
  it('generates the same name for the same row twice', () => {
    const first = (out: ReturnType<typeof sanitiseSnapshot>) =>
      (out.data.classmates as Record<string, Record<string, unknown>[]>)['EXC-KPSIT']![0]!.name;
    expect(first(sanitiseSnapshot(raw))).toBe(first(sanitiseSnapshot(raw)));
  });

  it('leaves the owner-s own data untouched', () => {
    const { data } = sanitiseSnapshot(raw);
    expect(data.schedule).toEqual(raw.schedule);
    expect(data.lastSync).toBe(raw.lastSync);
  });

  // The load-bearing one. If IS adds a field next semester, the deploy must
  // stop rather than silently upload it.
  it('throws on an unrecognised classmate field, naming it', () => {
    const withEmail = {
      ...raw,
      classmates: {
        'EXC-KPSIT': [{ ...raw.classmates['EXC-KPSIT'][0], email: 'jana@mendelu.cz' }],
      },
    };
    expect(() => sanitiseSnapshot(withEmail)).toThrow(/email/);
  });

  it('reports what it changed', () => {
    const { report } = sanitiseSnapshot(raw);
    expect(report.join('\n')).toMatch(/2 classmate/);
  });

  // The outer guard. A future scraper change could add a top-level key
  // (forum posts, group project members) carrying someone else's data, and
  // that must stop the upload rather than pass through unexamined.
  it('throws on an unrecognised top-level key, naming it', () => {
    const withExtra = { ...raw, forumPosts: [{ author: 'Jana Novakova' }] };
    expect(() => sanitiseSnapshot(withExtra)).toThrow(/forumPosts/);
  });

  it('does not throw when a known top-level key is simply absent', () => {
    const withoutSchedule: Record<string, unknown> = { ...raw };
    delete withoutSchedule.schedule;
    expect(() => sanitiseSnapshot(withoutSchedule)).not.toThrow();
  });
});
