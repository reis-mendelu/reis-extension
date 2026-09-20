# Campus navigation — "take me to my next lesson" — design

Date: 2026-09-20
Status: approved, ready for an implementation plan

## The idea

reIS already draws the walk from each campus gate to each campus building, with
a "4 min" chip on the end of it. What it cannot do is start from where the
student is actually standing, and it cannot answer the question they actually
have, which is not "how do I get to the campus" but "am I going to be late."

This adds one move: **tap once, and the map draws the walk from your GPS
position to the room your next lesson is in, with the time it will take.**

The reason this is worth building — and the reason it is not a thin wrapper
over Google Maps, which walks anyone to Zemědělská for free — is two things a
public router structurally cannot do:

1. **It routes through the botanical garden.** The garden is a through-route
   between Černá Pole and the campus that MENDELU students may cross with their
   ISIC, weekdays 06:00–20:00, free. No public router will ever suggest a route
   through a ticketed garden, because for the public it is not a route. For a
   student coming from FRRMS it is the direct line.
2. **It ends at the building, not at the gate.** Google's campus is one grey
   polygon. reIS knows the student's next lesson is in `Q31`, that `Q31` is in
   building Q, and where building Q's door is.

Neither of those is available to a student anywhere else, on any app.

## What was decided, and by whom

Four forks, settled with the maintainer on 2026-09-20:

| Fork | Decision |
|---|---|
| Destination | **The next lesson's room.** Not a picker, not "the campus". |
| Location | **One `getCurrentPosition()` on tap.** Not a following dot. |
| Routing | **On-device, from an arbitrary point.** Not snapping to a named gate. |
| The garden | **Route through it.** Weekdays only; weekends get a text note, not a second route. |

## Scope

### In

- A build-time routing graph committed alongside the existing campus paths.
- Two new walking corridors: FRRMS / Kolej Akademie (~840 m from campus centre,
  north) and the JAK dormitories (~1.26 km, east).
- A shipped routing module: snap an arbitrary coordinate to the network, then
  shortest path to a destination building.
- Capacitor geolocation, one fix per tap, mobile only.
- Destination resolution from the timetable.
- A dev-only position override so all of this is testable without standing
  outside.

### Out, deliberately

- **The FRRMS interior.** FRRMS is budova Z; its rooms (Z1–Z28 / N20xx) are not
  in `rooms-index.json`, because the My MENDELU map API carries only 7 buildings
  and Z is not one of them. A student at FRRMS whose next lesson is *at FRRMS*
  therefore gets nothing from this feature. That is a real hole and it is not a
  bug in this work — it is blocked on obtaining the floor plans and a sublicence
  from MENDELU (see the `frrms-floor-plans-sources` note). Named here so it is
  not rediscovered as a defect.
- **A weekend around-route.** See "The garden, and weekends" below.
- **A following blue dot / turn-by-turn.** One fix, by decision.
- **Public transport.** The bundled POIs carry DPMB line lists per stop and the
  sets do intersect usefully, but that is a separate feature with its own
  correctness problems (a naive line-set intersection routes a student to a
  night bus at 10am). Not in this work.
- **New building footprints.** Explicitly rejected by the maintainer; the map
  has the buildings it needs.

## Architecture

### 1. The graph has to be emitted, because there isn't one

This is the largest piece of the work and the least visible, so it goes first.

What `src/data/map/campusPaths.json` ships today:

- `routes` — 49 precomputed walks (7 entrances × 7 buildings), each a `from`,
  `to`, `lengthM` and a coordinate list.
- `network` — 13 strokes. These are *rendering* geometry: deduplicated, merged,
  shaped for drawing a dotted trail.
- `entrances` — 7 points.

What it does not ship is nodes and edges. `buildGraph`, `snapAnchors` and
`walksFrom` live in `scripts/lib/*.mjs` and are build-time Node — the header
comment says "none of this ships," and that was correct until now.

Routing from an arbitrary GPS fix needs adjacency, and **adjacency cannot be
recovered from `network` at runtime.** Those strokes were merged for drawing;
reconstructing which stroke touches which would mean matching coordinates by
proximity, which is precisely the failure mode `scripts/lib/remoteCorridor.mjs`
was written to refuse:

> the two coordinates for it differ in the 7th decimal, which is exactly where
> nodeKey stops calling two points the same node

So `fetch-campus-paths.mjs` gains a fourth output key:

```jsonc
{
  "graph": {
    // Deduplicated [lon, lat], 6 dp — the same rounding as every other
    // geometry in this file.
    "nodes": [[16.617241, 49.210133], ...],
    // [fromIndex, toIndex, lengthM, gateId?] — undirected, each pair once.
    // `gateId` is present only on edges that are not always walkable; see
    // "Closed edges" below. Absent on the overwhelming majority.
    "edges": [[0, 1, 34.2], [7, 8, 61.0, "garden"], ...]
  }
}
```

Index pairs rather than repeated coordinates, because the coordinate list is the
bulk of the file and an edge that names its endpoints by value would double it.
`lengthM` is precomputed at build time so the runtime never does trigonometry
per edge during a search.

`network`, `routes` and `entrances` stay exactly as they are. The existing
entrance-fan interaction keeps using `routes` and is not touched by this work;
the graph is additive.

### 2. Corridors, not a wider region

`REGION` in `fetch-campus-paths.mjs` is `BUILDINGS.campus.bounds` plus a 50 m
margin, and everything downstream assumes campus scale. Widening it to reach the
JAK dormitories would silently rewrite the 49 committed campus routes as a side
effect of a feature about something else.

Instead, each off-campus origin gets its **own Overpass extract and its own
declared anchor**, generalising the two-pass structure the script already runs
for the garden corridor: build the campus graph, ask it where the anchor node
actually landed, rebuild with the corridor pinned to that node. `corridorWays`
already does the pinning and already refuses a corridor that does not start
where it claims to.

Two corridors:

| Corridor | Joins at | Roughly |
|---|---|---|
| FRRMS / Kolej Akademie | `Brána u FRRMS` (the garden's Gen. Píky gate) | 840 m straight-line, through the garden |
| JAK dormitories A–D | `Brána Lesnická`, the campus's eastern gate | 1.26 km straight-line |

A corridor's anchor is *declared*, never inferred — that is the whole point of
`corridorWays`. `Brána Lesnická` is the stated anchor for the JAK corridor
because it is the campus opening on the side the dorms are on; if the extract
shows the walk genuinely arriving at the Zemědělská tram stop instead, the
anchor is changed in the script and the corridor re-cut. It is not resolved by
letting the build pick whichever node happens to be nearest.

A measured Overpass extract over the combined bbox
(`49.2085,16.6125,49.2195,16.6325`, footway/path/steps/pedestrian/living_street
plus non-parking service ways) returns **798 ways / 4,380 vertices**. Clipped to
ways within ~60 m of a computed route, most of that falls away. `campusPaths.json`
is 28 KB today; the implementation plan must state the measured size after
clipping, and if it lands above ~120 KB the clipping radius is the dial to turn.
It is bundled, not fetched, so this is bundle size and not a network call.

### 3. Drawing a route across nothing

The map has **no tile layer**, by design — that is what keeps the zero-external-
calls stance. On campus this works because the buildings are the context. A
1.26 km route in from the JAK dorms has no context at all: it would render as an
orange line across white.

So each corridor's own OSM ways are drawn as the same dotted `network` trail
already used for the campus. The streets you walk along become the basemap. This
is a design element, not a later polish pass — without it the feature renders as
a line in a void.

### 4. Where the graph meets `splitAnchors`

`scripts/lib/campusPlaces.mjs` pushes landmarks with `RANK.building`, and
`splitAnchors` then drops them from both branches — they are not lettered
buildings so they are not walk *ends*, and they are not gates or stops so they
are not *entrances* either. The comment there explains why that exclusion is
deliberate: a landmark admitted to entrances would ship with `kind: 'building'`
and break the rule that a building draws its own letter and never also gets a
pill.

FRRMS and the JAK dorms need to be origins. That means a new rank admitted to
`entranceNodes` with `CampusEntrance.kind: 'other'`, which the type already
carries and nothing currently emits. This is the guard most likely to bite two
hours into implementation, which is why it is in the spec rather than left to be
discovered.

### 5. The runtime routing module

New, shipped, under `src/utils/routing/` — split to respect the 200-line rule:

- `snapToGraph(graph, [lon, lat])` → the nearest point on the nearest edge, plus
  the two node indices it sits between and the distance to each. Returns `null`
  beyond a cutoff (proposal: 250 m), which is how "you are not near the campus"
  is represented. A student in Prague gets an honest nothing, not a route from
  the main gate.
- `shortestWalk(graph, from, toNodeIndices, isOpen)` → Dijkstra over `edges`,
  returning the polyline and total `lengthM`. Multi-target because a building is
  a set of nodes (its door nodes), not one point.
- `buildingNodes(graph, buildingName)` → the node indices that count as arriving
  at that building.

All three are pure functions over committed data, so all three are test-first
with fixtures. No React, no store, no async.

**Closed edges.** The graph contains the garden corridor, and the garden is shut
at weekends and outside 06:00–20:00. Greying the route card is not enough: left
alone, Dijkstra returns the garden route at 21:00 on a Saturday, and worse, will
happily use the garden as an intermediate leg of some unrelated journey. So
availability is a property of the graph, not of the card — `shortestWalk` takes
an `isOpen(gateId) => boolean` predicate and skips any edge whose `gateId` is
shut. The router then answers "what can you actually walk right now," and the
card only has to explain the answer. This is why `gateId` is a fourth element on
the edge tuple rather than a display-time concern.

There is exactly one gate id today, `"garden"`. The mechanism is general because
the cost of making it general is one string.

### 6. Geolocation

`@capacitor/geolocation`, new dependency.

- **`getCurrentPosition()` only.** The plugin docs warn that `watchPosition`
  "can consume a large amount of energy," and a route drawn on screen does not
  need re-deriving while you walk along it looking at it.
- **Capacitor-gated.** On web the app is a `chrome-extension://` iframe inside
  `is.mendelu.cz`, where geolocation would need `allow="geolocation"` set on the
  iframe by the content script. Scoping the feature to native sidesteps that
  question entirely, and a student sitting at a desk has no use for it anyway.
- Permissions: `NSLocationWhenInUseUsageDescription` (iOS),
  `ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION` (Android; FINE is required
  for high accuracy from Android 12).
- **The release APK gets verified separately.** R8 strips plugins, and a debug
  build proves nothing about that.
- Accuracy is 5–20 m in the open. Sufficient for "which building are you near,"
  never sufficient for a floor or a room, and nothing in this design depends on
  more.

State lives in a slice (`createMapSlice` or a sibling), never in component
state. The store holds the last fix and the computed route; components read
synchronously, per the project's data-flow rule.

### 7. Destination: the next lesson

The chain. The first two hops are verified against real bundled data; the last
is the new code this design adds:

```
lesson room string  →  resolveRoomCode()  →  rooms-index entry
                    →  entry.buildingId   →  buildings.json name
                    →  buildingNodes(graph, name)
```

Checked against the shipped index: `BA39N4051` → `Q31` → `buildingId 0` → `"Q"`.
The `buildingNodes` hop is unverified for the obvious reason that the graph does
not exist yet; it is step 1 of the sequencing. `buildingId === 0` is a real
building, and the existing constraint applies — never use truthiness to
mean "no building selected."

The rule for when there is no obvious next lesson, decided rather than left to
four ad-hoc branches during implementation:

- **Next lesson remaining today** → route to it.
- **No lesson left today** → fall back to a building picker. Not "next lesson
  whenever," which would cheerfully route someone to Thursday.
- **Already inside the destination building** → no route; say you are there.
- **Lesson already started** → still route, and say how late. The student knows
  they are late; the useful number is how much later they are about to be.
- **Room does not resolve** (`resolveRoomCode` returns `null`) → no button. This
  matches the existing contract: callers offer the button only when the room
  resolves, because `focusRoomByCode` on an unknown room does nothing visible.
  This is the branch a FRRMS lesson falls into today.

### 8. The garden, and weekends

Students cross with an ISIC, **weekdays 06:00–20:00**. Weekends closed. The
published visitor hours on `arboretum.mendelu.cz` (Mon–Fri 07:00–15:00, 150 Kč)
describe the paying public and **must not** be used for routing — they
understate the student window by five hours at the end of the day, which is most
of the afternoon teaching block.

The route card carries "free with your ISIC, tap at the Gen. Píky gate," because
a first-year does not know the shortcut is theirs, and that sentence is the
feature.

**Weekends get a note, not a route.** The garden ways are currently the only
thing joining the Gen. Píky side to the campus graph, so an "around" route is a
third corridor with its own extract down Gen. Píky and Lesnická and its own
anchor join — a pipeline stage, not a flag. On a weekend the garden route is
shown greyed with "closed at weekends — walk around via Gen. Píky." Honest,
near-free, and revisitable if anyone asks for the real line.

Gating rule: `day <= Friday && hour >= 6 && hour < 20`, evaluated against the
device clock. Czech public holidays are not modelled; the failure there is a
student walking to a gate that does not open, a handful of days a year. Noted,
accepted, and cheap to add later as a date list if it turns out to matter.

While `scripts/fetch-campus-paths.mjs` is open, its comment claiming the garden
is "ticketed and shuts at dusk" gets corrected — it is wrong on both halves.

## Error handling and degradation

Every one of these is a state the student can reach, and none may produce a
button that looks fine and does nothing:

| Condition | Behaviour |
|---|---|
| Permission denied | Explain once, offer the building picker. Never re-prompt in a loop. |
| Permission "prompt-with-rationale" | Show why before asking. |
| Location services off | `checkPermissions()` throws; treat as denied, same path. |
| Fix times out (10 s default) | Keep the picker; do not spin indefinitely. |
| Fix lands > 250 m from any node | "You're not near campus" — no route invented. |
| Accuracy worse than ~100 m | Route, but say the start is approximate. |
| No next lesson today | Building picker. |
| Room unresolvable | No button at all. |

Errors route through `logError('Routing.method', err)` — local `console.error`
only, per the project's no-transmission rule. No payload data in `extra`.

## Testing and verification

Unit tests, test-first, on everything pure: `snapToGraph` (including the
beyond-cutoff `null` and the point-between-two-edges case), `shortestWalk`
(including unreachable, and multi-target picking the nearer door), the
destination rule table above, and the garden gating predicate at its
boundaries — 05:59, 06:00, 19:59, 20:00, Saturday.

A shape test on the emitted `graph`, mirroring the existing
`__tests__/pathLayers.test.ts` approach: every edge index in range, no
self-edges, no duplicate pairs, and the graph connected enough that every
building is reachable from every corridor origin. A disconnected graph is the
failure this feature would otherwise ship silently.

**The verification that counts is not a unit test.** Per this project's own
history of green signals that lie, the evidence for "done" is a route rendered
on screen from a simulated position:

- A **dev-only `?at=<lat>,<lon>` override**, `import.meta.env.DEV`-stripped from
  shipped builds exactly as `devForcedPlatform()` is. **`lat,lon` order, not the
  `[lon, lat]` this codebase stores geometry in** — the value gets pasted
  straight out of Google Maps by a human, so it takes the order a human copies,
  and the parser transposes once at that boundary. The same reasoning as `'cz'`
  vs the `'cs'` locale: convert where the outside world meets the app, not
  everywhere else. This is a named task, not
  an afterthought — it is what makes JAK, FRRMS and mid-campus positions
  testable in the browser harness without GPS or a walk.
- Fixtures for: JAK Blok A, FRRMS, a point midway across campus between B and M,
  a point 2 km away, and a point inside the destination building.
- The iOS Simulator's custom location for the real-device pass.
- `verify:ui` screenshots at 320/390/430 for the route card, both themes.

## Open risks

- **`walkMinutes` is a flat 80 m/min.** Honest for a 400 m courtyard crossing.
  Over 1.26 km with an ISIC gate mid-route it is a guess wearing a number's
  clothes. One real walk, timed, before the figure is printed as fact — and if
  it is off, the fix is a per-corridor factor, not a global one.
- **Committed size.** Stated as measured in the implementation plan, not
  estimated.
- **Graph connectivity across the garden join.** The corridor pin is declared,
  not inferred, and `corridorWays` throws rather than stretching. If OSM's
  geometry at the Gen. Píky gate moves, the build fails loudly — which is the
  intended behaviour, but the plan should say who notices.

## Sequencing

1. Emit `graph` from the build; shape tests. No user-visible change.
2. Port snap + Dijkstra into `src/`; unit tests. Still no user-visible change.
3. The dev `?at=` override.
4. Route rendering from a simulated position, destination chosen with a building
   picker. The picker is built here and is the same one section 7 falls back to
   when there is no next lesson — it is not throwaway scaffolding.
5. The two corridors.
6. Destination from the next lesson.
7. Capacitor geolocation; native permissions; release-APK verification.

Steps 1–4 are shippable-but-invisible and de-risk everything after them: by the
end of step 4 a route from an arbitrary point renders on screen with no native
code involved at all.
