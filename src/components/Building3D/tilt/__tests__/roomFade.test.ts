import { describe, expect, it } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { roomFade } from '../roomFade';
import { LOOK } from '../tiltLook';

function slab() {
  const g = new Group();
  const rooms: [number, string, number][] = [
    [1, '#86efac', 0.6], // a classroom, in the flat map's green
    [2, '#93c5fd', 0.6], // an office, far across the floor
    [3, '#f9a8d4', 0.6], // the lit room
  ];
  for (const [id, color, opacity] of rooms) {
    const m = new Mesh(
      new PlaneGeometry(4, 4),
      new MeshBasicMaterial({ color, opacity, transparent: true })
    );
    m.userData.roomId = id;
    m.position.x = id * 40;
    g.add(m);
  }
  return g;
}
const hex = (g: Group, id: number) =>
  `#${((g.children.find((c) => c.userData.roomId === id) as Mesh).material as MeshBasicMaterial).color.getHexString()}`;
const opacity = (g: Group, id: number) =>
  ((g.children.find((c) => c.userData.roomId === id) as Mesh).material as MeshBasicMaterial)
    .opacity;

describe('roomFade', () => {
  it('keeps the floor in the flat map’s colours — the plan the student just saw', () => {
    const g = slab();
    roomFade(g, 3)(1);
    expect(hex(g, 1)).toBe('#86efac');
    expect(hex(g, 2)).toBe('#93c5fd');
  });

  it('keeps the whole floor, however far a room is from the lit one', () => {
    const g = slab();
    roomFade(g, 3)(1);
    expect(opacity(g, 2)).toBeGreaterThan(0.5);
  });

  it('keeps the other rooms out of the depth buffer, so overlapping fills never hide each other', () => {
    const g = slab();
    roomFade(g, 3);
    const m = (id: number) =>
      (g.children.find((c) => c.userData.roomId === id) as Mesh).material as MeshBasicMaterial;
    expect(m(1).depthWrite).toBe(false);
    expect(m(3).depthWrite).toBe(true);
  });

  it('turns only the target room orange, fully opaque', () => {
    const g = slab();
    roomFade(g, 3)(1);
    expect(hex(g, 3)).toBe(LOOK.target);
    expect(opacity(g, 3)).toBe(1);
  });

  it('starts from the flat map, so the handover frame matches it', () => {
    const g = slab();
    roomFade(g, 3)(0);
    expect(hex(g, 3)).toBe('#f9a8d4');
  });
});
