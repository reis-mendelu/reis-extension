import { describe, it, expect } from 'vitest';
import { parseCoordinate } from '../parseCoordinate';

// Kotlářská 51a, Brno — the venue from the task list that started this.
const LAT = 49.2078989;
const LNG = 16.6030499;

describe('parseCoordinate', () => {
  it('reads "lat, lng" as Google Maps copies it, and returns [lng, lat]', () => {
    expect(parseCoordinate('49.2078989, 16.6030499')).toEqual({ coord: [LNG, LAT] });
  });

  it('reads it without the space, with a space only, and with a semicolon', () => {
    expect(parseCoordinate('49.2078989,16.6030499')?.coord).toEqual([LNG, LAT]);
    expect(parseCoordinate('49.2078989 16.6030499')?.coord).toEqual([LNG, LAT]);
    expect(parseCoordinate(' 49.2078989; 16.6030499 ')?.coord).toEqual([LNG, LAT]);
  });

  it('reads Czech decimal commas when the pair is split by a semicolon or a space', () => {
    expect(parseCoordinate('49,2078989; 16,6030499')?.coord).toEqual([LNG, LAT]);
    expect(parseCoordinate('49,2078989 16,6030499')?.coord).toEqual([LNG, LAT]);
  });

  it('reads N/E suffixes and degrees-minutes-seconds', () => {
    expect(parseCoordinate('49.2078989N, 16.6030499E')?.coord).toEqual([LNG, LAT]);
    const dms = parseCoordinate(`49°12'28.4"N 16°36'11.0"E`)!.coord;
    expect(dms[1]).toBeCloseTo(49.20789, 4);
    expect(dms[0]).toBeCloseTo(16.60306, 4);
  });

  it('puts a pair typed lng-first back in order when only that order lands in Czechia', () => {
    expect(parseCoordinate('16.6030499, 49.2078989')?.coord).toEqual([LNG, LAT]);
  });

  it('takes the pin from a Google Maps place link, with the place name', () => {
    const url =
      'https://www.google.com/maps/place/Padagali/@49.2079,16.6005,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d49.2078989!4d16.6030499!16s';
    // !3d!4d is the place itself; @ is only where the viewport was centred.
    expect(parseCoordinate(url)).toEqual({ coord: [LNG, LAT], name: 'Padagali' });
  });

  it('decodes a place name that Google writes with + and percent-escapes', () => {
    const url =
      'https://www.google.com/maps/place/Kotl%C3%A1%C5%99sk%C3%A1+51a,+602+00+Brno/@49.2078989,16.6030499,17z';
    expect(parseCoordinate(url)).toEqual({
      coord: [LNG, LAT],
      name: 'Kotlářská 51a, 602 00 Brno',
    });
  });

  it('falls back to the @ centre, and reads ?q= and ?ll= links', () => {
    expect(
      parseCoordinate('https://www.google.com/maps/@49.2078989,16.6030499,15z')?.coord
    ).toEqual([LNG, LAT]);
    expect(parseCoordinate('https://maps.google.com/?q=49.2078989,16.6030499')?.coord).toEqual([
      LNG,
      LAT,
    ]);
    expect(
      parseCoordinate('https://maps.apple.com/?ll=49.2078989,16.6030499&q=Padagali')?.coord
    ).toEqual([LNG, LAT]);
  });

  it('reads a Mapy.cz link, whose x is longitude and y latitude', () => {
    expect(
      parseCoordinate('https://mapy.cz/zakladni?x=16.6030499&y=49.2078989&z=17')?.coord
    ).toEqual([LNG, LAT]);
  });

  it('leaves venue names, addresses and room codes to the search', () => {
    expect(parseCoordinate('Kotlářská 51a, 602 00 Brno-střed')).toBeNull();
    expect(parseCoordinate('Q01')).toBeNull();
    expect(parseCoordinate('Lužánky')).toBeNull();
    expect(parseCoordinate('602 00')).toBeNull();
    expect(parseCoordinate('2024, 2025')).toBeNull();
  });

  it('rejects numbers that are not a place on Earth', () => {
    expect(parseCoordinate('149.2, 16.6')).toBeNull();
    expect(parseCoordinate('49.2, 216.6')).toBeNull();
  });

  it('cannot read a short link, which hides the place behind a redirect', () => {
    expect(parseCoordinate('https://maps.app.goo.gl/AbCdEf123')).toBeNull();
  });
});
