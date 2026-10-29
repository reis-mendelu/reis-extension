import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { useVisibleMapEvents } from '../useVisibleMapEvents';
import { MOCK_MAP_EVENTS } from '../../components/CampusMap/__tests__/fixtures/mockMapEvents';
import type { MapEvent } from '../../types/events';

/**
 * The seam behind every map surface (pins, the Akce list, the peek band), so
 * one assertion here holds for all three, on both trees.
 */
const at = (societyId: string, subscribersOnly: boolean, id: string): MapEvent => ({
  ...MOCK_MAP_EVENTS[0]!,
  id,
  societyId,
  subscribersOnly,
});
const events = [
  at('esn', false, 'esn-public'),
  at('esn', true, 'esn-erasmus'),
  at('supef', false, 'supef-public'),
  at('au_frrms', false, 'frrms-public'),
  at('ey', false, 'ey'),
  at('reis', false, 'reis'),
];
const ids = () => renderHook(() => useVisibleMapEvents()).result.current.map((e) => e.id);

describe('useVisibleMapEvents', () => {
  beforeEach(() => {
    useAppStore.setState({
      mapEvents: events,
      societies: BUNDLED_SOCIETIES,
      userFaculty: 'PEF',
      userProgramme: 'B-OI',
      isErasmus: false,
      impersonation: null,
    });
  });

  it('a regular student sees what they always did', () => {
    expect(ids()).toEqual(['esn-public', 'supef-public', 'frrms-public', 'ey', 'reis']);
  });

  it("an exchange student (Z-EXC) sees ESN only, and reIS's own", () => {
    useAppStore.setState({ userProgramme: 'Z-EXC' });
    expect(ids()).toEqual(['esn-public', 'esn-erasmus', 'reis']);
  });

  it('the Erasmus text flag alone adds ESN events and hides nothing', () => {
    useAppStore.setState({ isErasmus: true });
    expect(ids()).toEqual([
      'esn-public',
      'esn-erasmus',
      'supef-public',
      'frrms-public',
      'ey',
      'reis',
    ]);
  });
});
