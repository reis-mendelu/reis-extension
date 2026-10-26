import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Society pins are drawn wherever event pins are: the desktop's CampusMapView
 * and the phone/iPad MapScreen each mount their own EventLayer, and a pin
 * layer mounted in only one of them shipped invisible on the other (caught in
 * screenshots, 2026-10-24).
 */
const MOUNTS = [
  'src/components/CampusMap/CampusMapView.tsx',
  'src/components/mobile/screens/MapScreen.tsx',
];

describe('society pins on both trees', () => {
  it.each(MOUNTS)('%s mounts SocietyPinLayer beside EventLayer', (path) => {
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/<EventLayer\b/);
    expect(src).toMatch(/<SocietyPinLayer\b/);
  });
});
