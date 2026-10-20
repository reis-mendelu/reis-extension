import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../components/CampusMap/mapInstance', () => ({ redrawBasemap: vi.fn() }));

import { redrawBasemap } from '../../../components/CampusMap/mapInstance';
import { createOsmTileAccessSlice, type OsmTileAccessSlice } from '../createOsmTileAccessSlice';

function makeSlice(): () => OsmTileAccessSlice {
  let state: OsmTileAccessSlice;
  const set = (p: Partial<OsmTileAccessSlice>) => {
    state = { ...state, ...p };
  };
  const get = () => state;
  state = (
    createOsmTileAccessSlice as unknown as (s: typeof set, g: typeof get) => OsmTileAccessSlice
  )(set, get);
  return get;
}

describe('createOsmTileAccessSlice', () => {
  beforeEach(() => vi.mocked(redrawBasemap).mockClear());

  it('starts out checking, which shows no banner', () => {
    expect(makeSlice()().osmTileAccess).toBe('checking');
  });

  it('redraws the basemap when access goes from missing to granted, wherever it was granted', () => {
    const get = makeSlice();
    get().setOsmTileAccess('missing');
    get().setOsmTileAccess('granted');
    expect(get().osmTileAccess).toBe('granted');
    expect(redrawBasemap).toHaveBeenCalledOnce();
  });

  it('does not redraw on the first answer, when nothing anonymous was drawn', () => {
    const get = makeSlice();
    get().setOsmTileAccess('granted');
    get().setOsmTileAccess('granted');
    expect(redrawBasemap).not.toHaveBeenCalled();
  });
});
