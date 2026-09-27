import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { cutShell, LOOK } from '../tiltLook';

const STOREYS = [-1, 0, 1, 2, 3].map((level, i) => ({ level, elevation: i * 3.5, height: 3.5 }));

/** A storey node as the glTF has it: facade, floor cap, window band, per level. */
function model() {
  const root = new Group();
  for (const { level } of STOREYS) {
    const node = new Group();
    node.userData.level = level;
    for (const name of ['facade', 'floor', 'window']) {
      const material = new MeshBasicMaterial();
      material.name = name;
      const mesh = new Mesh(new BoxGeometry(10, 3.5, 10), material);
      mesh.name = `${name}@${level}`;
      node.add(mesh);
    }
    root.add(node);
  }
  return root;
}
const mesh = (root: Group, name: string, level: number) =>
  root.getObjectByName(`${name}@${level}`) as Mesh;
const color = (m: Mesh) => `#${(m.material as MeshBasicMaterial).color.getHexString()}`;

describe('cutShell', () => {
  it('removes every storey above the room, instead of ghosting it', () => {
    const root = model();
    cutShell(root, 1, STOREYS);
    for (const level of [2, 3])
      for (const name of ['facade', 'floor', 'window'])
        expect(mesh(root, name, level).visible).toBe(false);
  });

  it('draws the storeys below as one plain solid, without lines', () => {
    const root = model();
    cutShell(root, 1, STOREYS);
    for (const level of [-1, 0]) {
      const facade = mesh(root, 'facade', level);
      expect(facade.visible).toBe(true);
      expect(color(facade)).toBe(LOOK.below);
      expect((facade.material as MeshBasicMaterial).transparent).toBe(false);
      expect(facade.children).toHaveLength(0);
      expect(mesh(root, 'window', level).visible).toBe(false);
    }
  });

  it("draws the room's storey as glass with corner lines on a solid floor", () => {
    const root = model();
    cutShell(root, 1, STOREYS);
    const facade = mesh(root, 'facade', 1);
    expect((facade.material as MeshBasicMaterial).opacity).toBe(LOOK.glassOpacity);
    expect(facade.children.length).toBeGreaterThan(0);
    expect(color(mesh(root, 'floor', 1))).toBe(LOOK.plate);
  });

  it('draws no ring and no orange anywhere on the building', () => {
    const root = model();
    cutShell(root, 1, STOREYS);
    const colours: string[] = [];
    root.traverse((o) => {
      const m = (o as { material?: { color?: { getHexString(): string } } }).material;
      if (o.visible && m?.color) colours.push(`#${m.color.getHexString()}`);
    });
    expect(colours).not.toContain(LOOK.target);
  });

  it('cuts nothing above the top storey', () => {
    const root = model();
    cutShell(root, 3, STOREYS);
    expect(mesh(root, 'facade', 3).visible).toBe(true);
  });

  it('draws the whole building as glass when no floor is known, not as a solid block', () => {
    const root = model();
    cutShell(root, null, STOREYS);
    for (const { level } of STOREYS) {
      const facade = mesh(root, 'facade', level);
      expect(facade.visible).toBe(true);
      expect((facade.material as MeshBasicMaterial).opacity).toBe(LOOK.glassOpacity);
      expect(mesh(root, 'floor', level).visible).toBe(false);
    }
  });
});
