import { describe, it, expect } from 'vitest';
import { migrateAssociationIds, RENAMED_ASSOCIATION_IDS } from '../renamedAssociations';

describe('migrateAssociationIds', () => {
  it('rewrites a renamed id', () => {
    expect(migrateAssociationIds(['af'])).toEqual(['usaf']);
  });

  it('leaves the other societies alone', () => {
    expect(migrateAssociationIds(['esn', 'af', 'ldf'])).toEqual(['esn', 'usaf', 'ldf']);
  });

  // The list feeds `includes` checks and a keyed render, so a student who
  // somehow holds both spellings must come out with one entry, not two.
  it('collapses a duplicate created by the rename', () => {
    expect(migrateAssociationIds(['usaf', 'af'])).toEqual(['usaf']);
  });

  // Returning the same instance is what lets the caller skip an IndexedDB
  // write on every single boot for the vast majority of students.
  it('returns the same array instance when nothing changed', () => {
    const saved = ['esn', 'ldf'];
    expect(migrateAssociationIds(saved)).toBe(saved);
  });

  it('handles an empty list', () => {
    const saved: string[] = [];
    expect(migrateAssociationIds(saved)).toBe(saved);
  });

  it('records the af -> usaf rename', () => {
    expect(RENAMED_ASSOCIATION_IDS.af).toBe('usaf');
  });
});
