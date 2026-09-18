import { describe, it, expect, vi } from 'vitest';
// @ts-expect-error — plain .mjs helper, no types
import { assembleOuterRings, ringContaining, largestRing, ringCentroid } from '../osmRings.mjs';

/**
 * The case that motivated splitting this out: an OSM multipolygon's outer
 * boundary is often several OPEN ways that must be walked end-to-end. Closing
 * each member independently invents an edge across the gap, which yields a
 * plausible polygon with a wrong boundary — and the site's centre and bounds
 * are computed from that boundary.
 */
describe('assembleOuterRings', () => {
  // A unit square, as four open segments, deliberately shuffled and with two
  // of them reversed — OSM guarantees neither order nor winding.
  const square = [
    [
      [0, 0],
      [1, 0],
    ],
    [
      [1, 1],
      [1, 0],
    ], // reversed
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
    ], // reversed
  ];

  it('walks shuffled, reversed open ways into one closed ring', () => {
    const rings = assembleOuterRings(square);
    expect(rings).toHaveLength(1);
    const ring = rings[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    // Four corners, plus the repeated closing vertex.
    expect(ring).toHaveLength(5);
    expect(ringCentroid(ring.slice(0, -1))).toEqual([0.5, 0.5]);
  });

  it('passes an already-closed way through unchanged', () => {
    const closed = [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ];
    expect(assembleOuterRings(closed)).toEqual(closed);
  });

  it('keeps two separate rings separate', () => {
    const far = [
      [
        [10, 10],
        [11, 10],
        [11, 11],
        [10, 11],
        [10, 10],
      ],
    ];
    expect(assembleOuterRings([...square, ...far])).toHaveLength(2);
  });

  it('DROPS a boundary that cannot be closed rather than fabricating an edge', () => {
    const warn = vi.fn();
    const gap = [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [1, 0],
        [1, 1],
      ],
      // the return leg to [0,0] is missing
    ];
    expect(assembleOuterRings(gap, warn)).toHaveLength(0);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('ring selection', () => {
  const inner = [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
    [0, 0],
  ];
  const detached = [
    [10, 10],
    [20, 10],
    [20, 20],
    [10, 20],
    [10, 10],
  ];

  it('picks the ring enclosing the point, even when another is far larger', () => {
    // This is the real-world shape: the detached parcel has the bigger area, so
    // a "largest ring" heuristic would frame the map on empty ground.
    expect(ringContaining([detached, inner], [2, 2])).toEqual(inner);
    expect(largestRing([detached, inner])).toEqual(detached);
  });

  it('returns null when no ring contains the point', () => {
    expect(ringContaining([inner], [100, 100])).toBeNull();
  });
});
