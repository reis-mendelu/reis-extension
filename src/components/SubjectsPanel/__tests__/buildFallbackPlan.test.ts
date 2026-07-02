import { describe, it, expect } from 'vitest';
import { buildFallbackPlan } from '../buildFallbackPlan';
import type { SubjectsData } from '@/types/documents';

const subjects: SubjectsData = {
  version: 1,
  lastUpdated: '2026-07-02T00:00:00.000Z',
  data: {
    'EBC-ST': {
      displayName: 'Statistika (display)',
      fullName: 'EBC-ST Statistika',
      nameCs: 'Statistika',
      nameEn: 'Statistics',
      subjectCode: 'EBC-ST',
      subjectId: '123456',
      folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1',
      fetchedAt: '2026-07-02T00:00:00.000Z',
    },
    'EBC-XX': {
      displayName: 'Display Only',
      fullName: 'EBC-XX Display Only',
      subjectCode: 'EBC-XX',
      folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=2',
      fetchedAt: '2026-07-02T00:00:00.000Z',
    },
  },
};

describe('buildFallbackPlan', () => {
  it('maps every subject into one block/one group as enrolled, unfulfilled', () => {
    const plan = buildFallbackPlan(subjects, 'cs');
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].groups).toHaveLength(1);
    const list = plan.blocks[0].groups[0].subjects;
    expect(list).toHaveLength(2);
    const st = list.find(s => s.code === 'EBC-ST')!;
    expect(st.id).toBe('123456');
    expect(st.isEnrolled).toBe(true);
    expect(st.isFulfilled).toBe(false);
    expect(st.credits).toBe(0);
  });

  it('picks nameEn for en and nameCs for cs', () => {
    const en = buildFallbackPlan(subjects, 'en').blocks[0].groups[0].subjects.find(s => s.code === 'EBC-ST')!;
    const cs = buildFallbackPlan(subjects, 'cs').blocks[0].groups[0].subjects.find(s => s.code === 'EBC-ST')!;
    expect(en.name).toBe('Statistics');
    expect(cs.name).toBe('Statistika');
  });

  it('falls back to displayName when the language name is missing', () => {
    const s = buildFallbackPlan(subjects, 'en').blocks[0].groups[0].subjects.find(x => x.code === 'EBC-XX')!;
    expect(s.name).toBe('Display Only');
  });

  it('missing subjectId maps to empty id', () => {
    const s = buildFallbackPlan(subjects, 'cs').blocks[0].groups[0].subjects.find(x => x.code === 'EBC-XX')!;
    expect(s.id).toBe('');
  });

  it('handles an empty subjects store', () => {
    const plan = buildFallbackPlan({ version: 1, lastUpdated: '', data: {} }, 'cs');
    expect(plan.blocks[0].groups[0].subjects).toHaveLength(0);
    expect(plan.creditsAcquired).toBe(0);
    expect(plan.creditsRequired).toBe(0);
    expect(plan.isFulfilled).toBe(false);
  });
});
