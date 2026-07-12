import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toPlaceResult, searchPlaces, type PhotonFeature } from '../placeSearch';

const feature = (props: Partial<PhotonFeature['properties']>, coord: [number, number]): PhotonFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: coord },
  properties: { osm_id: 1, osm_type: 'N', ...props },
});

describe('toPlaceResult', () => {
  it('maps a Photon feature to {name, context, coord} with [lng, lat] order', () => {
    const r = toPlaceResult(
      feature({ osm_id: 42, osm_type: 'N', name: 'Bar, který neexistuje', city: 'Brno', street: 'Dvořákova' }, [16.6097, 49.1959])
    );
    expect(r.name).toBe('Bar, který neexistuje');
    expect(r.context).toBe('Brno, Dvořákova');
    expect(r.coord).toEqual([16.6097, 49.1959]);
    expect(r.id).toBe('N42');
  });

  it('falls back to the street name when the place has no name', () => {
    const r = toPlaceResult(feature({ street: 'Zemědělská', city: 'Brno' }, [16.61, 49.21]));
    expect(r.name).toBe('Zemědělská');
  });
});

describe('searchPlaces', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not hit the network for a blank/too-short query', async () => {
    expect(await searchPlaces(' ')).toEqual([]);
    expect(await searchPlaces('a')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('queries Photon with the term + a Brno bias and normalizes results', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          feature({ osm_id: 7, osm_type: 'W', name: 'Lužánky', city: 'Brno' }, [16.6085, 49.2067]),
        ],
      }),
    } as Response);

    const res = await searchPlaces('Lužánky');
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('photon.komoot.io/api');
    expect(url).toContain('q=Lu%C5%BE%C3%A1nky');
    expect(url).toMatch(/lat=49\.\d+/); // Brno/MENDELU bias applied
    expect(url).toMatch(/lon=16\.\d+/);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ name: 'Lužánky', coord: [16.6085, 49.2067] });
  });

  it('returns [] and does not throw when the request fails', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
    expect(await searchPlaces('anything')).toEqual([]);
  });

  it('drops features that have neither a name nor a street', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          feature({ osm_id: 1, city: 'Brno' }, [16.6, 49.2]), // no name, no street → dropped
          feature({ osm_id: 2, name: 'Utopia', city: 'Brno' }, [16.61, 49.19]),
        ],
      }),
    } as Response);
    const res = await searchPlaces('utopia');
    expect(res).toHaveLength(1);
    expect(res[0]!.name).toBe('Utopia');
  });
});
