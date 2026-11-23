import campusPaths from './campusPaths.json';
import type { Entrance } from '../../utils/indoor/roomDirections';

const GRAPH = (
  campusPaths as unknown as {
    graph: { nodes: [number, number][]; buildings: Record<string, number[]> };
  }
).graph;

function door(letter: string, level: number): Entrance | null {
  const node = GRAPH.buildings[letter]?.[0];
  const at = node === undefined ? undefined : GRAPH.nodes[node];
  return at ? { at: [at[0], at[1]], level } : null;
}

/**
 * The buildings room directions cover, by map building id, with the entrance
 * they start from and the floor it opens onto. Added one building at a time:
 * floor numbering differs between them (A/C/Q/Z count the ground floor as 0,
 * B/E/M/X as 1) and each door's floor has to be checked, not assumed.
 *
 * Q: its one mapped door, on the east side, opens onto floor 0 — the Vrátnice
 * is 9 m inside it on floor 0, where floor −1 has classrooms. Q sits on a
 * slope; the ground there is 1.7 m under floor 0, the steps up to the door.
 */
const entrances: Record<number, Entrance> = {};
const q = door('Q', 0);
if (q) entrances[0] = q;

export const ROOM_ENTRANCES: Readonly<Record<number, Entrance>> = entrances;
