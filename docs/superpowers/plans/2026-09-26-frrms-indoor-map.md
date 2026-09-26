# FRRMS (budova Z) Indoor Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tap on FRRMS opens a 1.NP–4.NP floor stack (default 2.NP) with every room drawn, and IS rooms (Aula, Z1–Z11, Z13–Z15, Z24–Z26, Z28, Coworking) resolve to their own room.

**Architecture:**
- **Private pipeline.** The drawing-derived pipeline in the private folder `~/Documents/reis/frrms-indoor-research/`, never a repo, exports one committed-safe file: `spaces.geojson`, geometry plus codes, no drawing text beyond room names.
- **reis-data.** A new curated building `source/curated/Z/`, turned into a normal `Building` + CDN rooms file + IS labels by a tested generator, `scripts/curatedZ.mjs`. `buildMapData.mjs` merges it.
- **reis-extension.** It bundles the regenerated data. Landmarks sharing Z's outline stop being drawn, and the routing gate learns that a building with no graph nodes has no walk.

**Tech Stack:**
- Private pipeline: Python 3.14 venv (pymupdf, opencv, shapely, pyproj, scipy).
- reis-data: Node ESM scripts tested with `node --test`, no package.json.
- reis-extension: React/TypeScript, Vitest, Leaflet, Zustand.

**Spec:** `docs/superpowers/specs/2026-09-26-frrms-indoor-map-design.md` (amended by this plan in "Spec amendments" below; the executor reads both).

## Global Constraints

- **The tender PDFs never enter a repo, a build, or a PR.** They live in the kit
  `~/Downloads/frrms-indoor-handover_1.zip`. Only derived geometry, pasport codes and
  printed room names may be committed.
- **Building:** id `9000001`, `name` `"Z"`, `description` `"Budova Z (FRRMS)"`.
- **Floors:** ids `9000010` / `9000011` / `9000012` / `9000013` = levels 0 / 1 / 2 / 3, listed
  top first. `name` is the level as a string. `defaultFloorId` is `9000011` (2.NP).
- **Level = NP − 1**, and 3.NP uses 2.NP's fitted transform.
- **Rooms:** ids from `9001000` up, in sorted order. Code prefix `BZ00` (synthetic, documented).
- **Room naming follows the MENDELU data convention:** `name` = `passportNumber` = `BZ00<pasport>`,
  the IS label reaches the UI through `isRoomLabels.json`, and a printed name goes in
  `nickname`. A space with no pasport code gets `name` `""` and `passportNumber` `null`.
- **Dropped categories:** `roof`, `roof?`, `void`, `courtyard`. `terrace`, `dorm` and `dorm?`
  become `other`.
- `META.campus.bounds` must be byte-identical before and after.
- **Exclusions:** no routing-graph nodes for Z, no 1.PP, no 5.–8.NP.
- **Dependency:** the "Aula (ČP II.)" campus-aware label fix (separate session,
  task_5ffef4c7) must be merged into `test` before Task E1.
- **reis-extension:** base every PR on `test` (`gh pr create --base test`). Locally run only
  the touched vitest files plus `npm run typecheck`; leave repo-wide lint, format and the
  full test run to CI.
- **reis-data:** PRs go to `main`, which is its default and only branch. A reis-data merge is
  harmless before the app release, because no released app lists building 9000001.
- **Never modify an IS HTML parser** (CLAUDE.md "Parser Rules"). Nothing here needs one.

## Spec amendments (decided while planning, from reading the code)

1. **Naming.** The spec said `name` = IS label. Real rooms use `name` = passport code, and
   `roomLabel()` (`src/components/CampusMap/mapHelpers.ts:158`) shows the IS label via
   `isLabelForCode`. Z follows that convention. The coworking room shows its IS label and
   carries `nickname` `"Coworking"`, which search matches.
2. **Z's IS pairing** comes from the curated table `source/curated/Z/is-rooms.json`, not
   from `pairIsRooms.mjs` Číslo arithmetic. That table is where 284/285 → N2084/N2085 and
   the wrong Z11/Z15 records are resolved, each with its evidence. `pairIsRooms.mjs` is
   unchanged.
3. **Landmarks 1587 and 1616 stay in `landmarks.json`,** so search, the Places list and
   Kolej Akademie's "Také zde: FRRMS" line keep working. They are **not drawn**, because
   they share Z's outline, landmarks draw on top of buildings, and they would swallow every
   tap. Focusing landmark 1587 (type `building`) opens building Z. There is no new "also
   here" line on a building, because buildings have no card; a tap goes straight to the
   floor plan.
4. **K01–K03 (Budova K)** move from landmark 1587 to `{kind:'building', id:9000001}`. The
   student sees the same outline as today, so nothing regresses.
5. `canRouteFrom` returns false for a building with no graph nodes, even with no position
   fix. Without that, a Z lesson offers a "Trasa" whose press draws nothing.

---

## Part P — private pipeline (`~/Documents/reis/frrms-indoor-research/`)

This folder is not a repo. Task P0 makes it a **local-only** git repo, never pushed, so
these tasks can commit.

### Task P0: Make the private folder reproducible

**Files:**
- Create: `~/Documents/reis/frrms-indoor-research/.gitignore`
- Create: `~/Documents/reis/frrms-indoor-research/requirements.lock`
- Create: `~/Documents/reis/frrms-indoor-research/kit/` (unzipped kit, gitignored)

- [ ] **Step 1: Unzip the kit next to the research, and gitignore PDFs and caches**

```bash
cd ~/Documents/reis/frrms-indoor-research
mkdir -p kit && unzip -oq ~/Downloads/frrms-indoor-handover_1.zip -d kit
printf 'kit/\n*.pdf\nresearch/tmp/*.pkl\nresearch/vfk/\nresearch/projgrids/\n__pycache__/\n.venv/\n' > .gitignore
```

- [ ] **Step 2: Create the venv and pin versions**

```bash
python3 -m venv .venv && .venv/bin/pip -q install pymupdf opencv-python-headless shapely pyproj scipy numpy pillow
.venv/bin/pip freeze > requirements.lock
```

- [ ] **Step 3: Record the input hashes and init a local repo**

```bash
shasum -a 256 kit/frrms-indoor-handover/sources/*.pdf > sources.sha256
git init -q && git add -A && git commit -qm "private: FRRMS research snapshot (never pushed)"
git remote -v   # must print nothing
```

Expected: `git remote -v` prints nothing.

### Task P1: 3.NP georeferenced with 2.NP's transform

2.NP and 3.NP share one page placement (phase correlation 0 px). 3.NP's own fit has a
5.7 m outlier. The fit's rotation origin is the outline centroid, which differs per sheet,
so reusing the fit parameters is wrong. The full image-px → UTM affine has to be reused.

**Files:**
- Modify: `pipeline_scratch/frrms_floor.py` (fit section + outputs)
- Test: `pipeline_scratch/test_fit_from.py`

**Interfaces:**
- Produces: `<out>_fit.json` gains `"affine": [a, b, c, d, e, f]` (UTM33 x = a·px + b·py + c, y = d·px + e·py + f). The CLI gains `--fit-from <fit.json>`, which skips fitting and uses that affine.

- [ ] **Step 1: Write the failing test**

```python
# pipeline_scratch/test_fit_from.py
import json, subprocess, sys
from shapely.geometry import shape
PY = sys.executable
K = '../kit/frrms-indoor-handover/'
EX = ['--exclude', '0,0,192,1191', '0,983,233,1191']
def run(pdf, out, *extra):
    subprocess.run([PY, 'frrms_floor.py', K + 'sources/' + pdf, '0', out,
                    '--footprint', K + 'data/osm_footprint_building_Z.geojson', *EX, *extra], check=True)

def test_fit_json_has_affine_and_fit_from_reproduces_2np():
    run('2NP_G01_koberce2016_EZAK1803.pdf', '/tmp/p1_2NP')
    fit = json.load(open('/tmp/p1_2NP_fit.json'))
    assert len(fit['affine']) == 6
    run('2NP_G01_koberce2016_EZAK1803.pdf', '/tmp/p1_2NPb', '--fit-from', '/tmp/p1_2NP_fit.json')
    a = json.load(open('/tmp/p1_2NP_rooms.geojson'))['features']
    b = json.load(open('/tmp/p1_2NPb_rooms.geojson'))['features']
    assert [f['properties']['seg_id'] for f in a] == [f['properties']['seg_id'] for f in b]
    for fa, fb in zip(a, b):
        assert shape(fa['geometry']).symmetric_difference(shape(fb['geometry'])).area < 1e-12

def test_3np_with_2np_affine_keeps_seg_ids():
    run('3NP_G02_koberce2016_EZAK1803.pdf', '/tmp/p1_3NP', '--fit-from', '/tmp/p1_2NP_fit.json')
    ids = [f['properties']['seg_id'] for f in json.load(open('/tmp/p1_3NP_rooms.geojson'))['features']]
    ref = [f['properties']['seg_id'] for f in json.load(open(K + 'work/3NP_rooms.geojson'))['features']]
    assert ids == ref
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd ~/Documents/reis/frrms-indoor-research/pipeline_scratch && ../.venv/bin/python -m pytest -q test_fit_from.py` (install `pytest` into `.venv` first).
Expected: FAIL with `KeyError: 'affine'`.

- [ ] **Step 3: Implement the affine and `--fit-from`**

Add `ap.add_argument('--fit-from')` next to the other arguments. Replace everything from
`iou = lambda p:` through the `to_geo = …` line with the block below. Keep the existing
`place`, `O` and `P0` definitions.

```python
import numpy as np
from shapely import affinity as _aff
def affine_of(p):
    # Probe three image points through the exact fitted placement, then solve for the 2x3 affine.
    src = [(0.0, 0.0), (1000.0, 0.0), (0.0, 1000.0)]
    dst = [place(_aff.scale(Polygon([(x, y), (x + 1, y), (x, y + 1)]), S, -S, origin=(0, 0)), r_x).exterior.coords[0]
           for x, y in src]
    (x0, y0), (x1, y1), (x2, y2) = dst
    return [(x1 - x0) / 1000, (x2 - x0) / 1000, x0, (y1 - y0) / 1000, (y2 - y0) / 1000, y0]
if a.fit_from:
    A = json.load(open(a.fit_from))['affine']
    fit = {'affine': A, 'fit_from': a.fit_from}
else:
    iou = lambda p: (lambda P: P.intersection(O).area / P.union(O).area)(place(P0, p))
    th0 = max(range(0, 360, 2), key=lambda t: iou([t, 1, 0, 0]))
    r = minimize(lambda p: -iou(p), [th0, 1, 0, 0], method='Nelder-Mead', options={'maxiter': 3000})
    r_x = r.x
    A = affine_of(r_x)
    fit = {'params': list(map(float, r.x)), 'iou': float(-r.fun),
           'iou_rot180': float(iou([r.x[0] + 180, r.x[1], r.x[2], r.x[3]])),
           'plan_footprint_m2': float(bld.sum() * S * S), 'osm_footprint_m2': float(O.area), 'affine': A}
json.dump(fit, open(a.out + '_fit.json', 'w'), indent=1)
print('fit', fit)
to_geo = lambda Pimg: _aff.affine_transform(Pimg, [A[0], A[1], A[3], A[4], A[2], A[5]])
```

Check the probe. `place()` takes a polygon in metres (image px × S, y flipped). The probe
triangle's first vertex is the probed point, so `exterior.coords[0]` is its image.

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `../.venv/bin/python -m pytest -q test_fit_from.py`
Expected: 2 passed.

- [ ] **Step 5: Regenerate 3.NP and commit**

```bash
../.venv/bin/python frrms_floor.py ../kit/frrms-indoor-handover/sources/2NP_G01_koberce2016_EZAK1803.pdf 0 out/2NP --footprint ../kit/frrms-indoor-handover/data/osm_footprint_building_Z.geojson --exclude 0,0,192,1191 0,983,233,1191
../.venv/bin/python frrms_floor.py ../kit/frrms-indoor-handover/sources/3NP_G02_koberce2016_EZAK1803.pdf 0 out/3NP --footprint ../kit/frrms-indoor-handover/data/osm_footprint_building_Z.geojson --exclude 0,0,192,1191 0,983,233,1191 --fit-from out/2NP_fit.json
cd .. && git add pipeline_scratch && git commit -qm "pipeline: reusable affine; 3.NP on 2.NP's transform"
```

### Task P2: 1.NP corridors segmented

On the 1.NP sheet (tender 4051, page 13) corridors are hatched in black, so the pipeline
reads them as wall. Hatch drawings are many thin parallel line items in one path; walls
are not.

**Files:**
- Modify: `pipeline_scratch/frrms_floor.py` (the `blk` keep-filter)
- Test: `pipeline_scratch/test_hatch.py`

**Interfaces:**
- Produces: the CLI flag `--drop-hatch`. With it, a drawing whose items are ≥ 8 `'l'` segments, all within 1.5° of one angle, and stroke width ≤ 0.3 pt, is not rasterised as wall.

- [ ] **Step 1: Write the failing test**

The printed corridor codes must now land inside segmented spaces.

```python
# pipeline_scratch/test_hatch.py
import json, subprocess, sys
PY = sys.executable; K = '../kit/frrms-indoor-handover/'
CORRIDORS = {'N1019', 'N1075', 'N1027', 'N1076', 'N1074', 'N1062'}
def test_drop_hatch_puts_corridor_codes_inside_spaces():
    subprocess.run([PY, 'frrms_floor.py', K + 'sources/1NP_E2_osvetleni2020_EZAK4051.pdf', '13', '/tmp/p2_1NP',
                    '--footprint', K + 'data/osm_footprint_building_Z.geojson',
                    '--exclude', '0,548,1190,842', '440,380,880,515', '--drop-hatch'], check=True)
    labels = json.load(open('/tmp/p2_1NP_labels.json'))
    inside = {l['code'] for l in labels if l['seg_id'] is not None}
    assert CORRIDORS <= inside, CORRIDORS - inside
```

- [ ] **Step 2: Run it and watch it fail**

Run: `../.venv/bin/python -m pytest -q test_hatch.py`
Expected: FAIL (argparse: unrecognized `--drop-hatch`).

- [ ] **Step 3: Implement the hatch filter**

```python
ap.add_argument('--drop-hatch', action='store_true')
# ... after parse_args:
import math as _m
def is_hatch(d):
    if (d.get('width') or 0) > 0.3: return False
    ls = [it for it in d['items'] if it[0] == 'l']
    if len(ls) < 8 or len(ls) != len(d['items']): return False
    ang = [(_m.degrees(_m.atan2(it[2].y - it[1].y, it[2].x - it[1].x)) % 180) for it in ls]
    ref = ang[0]
    return all(min(abs(x - ref), 180 - abs(x - ref)) <= 1.5 for x in ang)
base_blk = lambda d: d.get('color') == (0.0, 0.0, 0.0) or d.get('fill') == (0.0, 0.0, 0.0)
blk = (lambda d: base_blk(d) and not is_hatch(d)) if a.drop_hatch else base_blk
```

- [ ] **Step 4: Run the test again and confirm it passes**

Run: `../.venv/bin/python -m pytest -q test_hatch.py test_fit_from.py`
Expected: all pass.

**If the hatch criterion needs tuning, tune only the three numbers.** If after tuning more
than 2 of the 6 codes still fall outside every space, stop and report. The fallback, which
the spec accepts, is that 1.NP ships without corridor polygons. The rooms are unaffected.

- [ ] **Step 5: Re-place the 1.NP codes on the new seg ids**

Seg ids change with `--drop-hatch`. Regenerate `out/1NP` with the flag. Rerun the
registration placement against the new segmentation: `research/rerun_place.py` reads
stored registrations (`research/tmp/res_*.json`) and calls `Reg.place`. Point `base.py`'s
1.NP inputs at `pipeline_scratch/out/1NP_*` first. `rerun_place.py`'s `__main__` lists
the sheet configs, so run it for every `1NP` entry.

Acceptance: every code previously inside a seg (`research/placed_codes_1NP.json`,
`seg_id != null`) is still inside one, and still passes the area gate
(printed m² ≈ 1.06 × seg area, ±25 %).

- [ ] **Step 6: Commit**

```bash
cd .. && git add -A pipeline_scratch research && git commit -qm "pipeline: 1.NP hatch-aware segmentation, codes re-placed"
```

### Task P3: Export `spaces.geojson`, the only file that leaves this folder

**Files:**
- Create: `research/export_spaces.py`
- Test: `research/test_export_spaces.py`

**Interfaces:**
- Consumes: `research/frrms_structure.geojson` after rerunning `merge_structure.py` with P1/P2 outputs. Point `merge_structure.py`'s `KIT + f'work/{fl}_rooms.geojson'` at `../pipeline_scratch/out/{fl}_rooms.geojson` for 1NP and 3NP.
- Produces: `research/export/spaces.geojson`, a FeatureCollection with exactly these properties per feature:
  `{ "spaceId": "<level>:<seg>" | "hall:Z14" | "hall:Z15", "level": 0..3, "code": "N2024" | null, "namePrinted": string | null, "category": string | null, "areaM2": number }`.
  Polygons only, coordinates rounded to 7 dp, features sorted by `spaceId`.

**Export rules** (all in `export_spaces.py`, each tested):
1. **Floors:** drop 1.NP–4.NP point-only features and every feature with level > 3.
2. **Tiered halls:** drop 2.NP segs whose representative point lies inside a hand-cut hall (`hall:Z14` / `hall:Z15`). Those are the seat-row slivers.
3. **Aula drum:** 2.NP seg 16 gets `code: null` and `namePrinted: null`. N1000 lives on 1.NP (seg 239 before P2; after P2, whichever seg holds the N1000 code).
4. **Floor check:** a code's floor digit must match `level`: `N<d>…` → level `d-1`, `P…` → `-1`. A mismatch is an error, not a skip.
5. **Unique codes:** a code may appear at most once across the file. A duplicate is an error.
6. **Names:** `namePrinted` is the printed name only. Never copy notes, evidence or any other drawing text.

- [ ] **Step 1: Write the failing tests**

```python
# research/test_export_spaces.py
import json, subprocess, sys
from shapely.geometry import shape
def load():
    subprocess.run([sys.executable, 'export_spaces.py'], check=True)
    return json.load(open('export/spaces.geojson'))['features']
def test_properties_are_exactly_the_contract():
    for f in load():
        assert set(f['properties']) == {'spaceId', 'level', 'code', 'namePrinted', 'category', 'areaM2'}
        assert f['geometry']['type'] == 'Polygon'
def test_codes_unique_and_on_their_floor():
    codes = [f['properties'] for f in load() if f['properties']['code']]
    assert len({p['code'] for p in codes}) == len(codes)
    for p in codes:
        c = p['code']; lvl = -1 if c[0] == 'P' else int(c[1]) - 1
        assert lvl == p['level'], p
def test_halls_replace_slivers_and_aula_drum_is_unnamed():
    fs = load(); by = {f['properties']['spaceId']: f for f in fs}
    assert 'hall:Z14' in by and 'hall:Z15' in by
    halls = [shape(by[h]['geometry']) for h in ('hall:Z14', 'hall:Z15')]
    for f in fs:
        p = f['properties']
        if p['level'] == 1 and not p['spaceId'].startswith('hall:'):
            pt = shape(f['geometry']).representative_point()
            assert not any(h.contains(pt) for h in halls), p['spaceId']
    assert by['1:16']['properties']['code'] is None
def test_sorted_and_byte_stable():
    load(); a = open('export/spaces.geojson', 'rb').read()
    load(); assert a == open('export/spaces.geojson', 'rb').read()
    ids = [f['properties']['spaceId'] for f in json.loads(a)['features']]
    assert ids == sorted(ids)
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd research && ../.venv/bin/python -m pytest -q test_export_spaces.py`
Expected: FAIL (no `export_spaces.py`).

- [ ] **Step 3: Implement `export_spaces.py`**

```python
"""frrms_structure.geojson -> export/spaces.geojson: the only drawing-derived file that is committed anywhere."""
import json, os, re
from shapely.geometry import shape
from shapely.ops import transform
from pyproj import Transformer
TO_UTM = Transformer.from_crs(4326, 32633, always_xy=True).transform
F = json.load(open('frrms_structure.geojson'))['features']
LEVEL = {'1.NP': 0, '2.NP': 1, '3.NP': 2, '4.NP': 3}
def rnd(g):
    return {'type': 'Polygon', 'coordinates': [[[round(x, 7), round(y, 7)] for x, y in ring] for ring in g['coordinates']]}
halls = {f['properties']['is_label']: shape(f['geometry']) for f in F
         if f['properties']['floor'] == '2.NP' and f['properties']['seg_id'] is None and f['geometry']['type'] == 'Polygon'}
out, seen = [], set()
for f in F:
    p = f['properties']
    if f['geometry']['type'] != 'Polygon' or p['floor'] not in LEVEL: continue
    lvl = LEVEL[p['floor']]
    if p['seg_id'] is None:
        sid = f"hall:{p['is_label']}"
    else:
        sid = f"{lvl}:{p['seg_id']}"
        if lvl == 1 and any(h.contains(shape(f['geometry']).representative_point()) for h in halls.values()): continue
    code, name = p.get('code'), p.get('name_printed')
    if sid == '1:16': code, name = None, None            # Aula's upper volume: N1000 is on 1.NP
    if code:
        want = -1 if code[0] == 'P' else int(code[1]) - 1
        if want != lvl: raise SystemExit(f'{sid}: code {code} belongs on level {want}, not {lvl}')
        if code in seen: raise SystemExit(f'{sid}: duplicate code {code}')
        seen.add(code)
    out.append({'type': 'Feature', 'geometry': rnd(f['geometry']), 'properties': {
        'spaceId': sid, 'level': lvl, 'code': code, 'namePrinted': name,
        'category': p.get('category'), 'areaM2': round(transform(TO_UTM, shape(f['geometry'])).area, 1)}})
out.sort(key=lambda f: f['properties']['spaceId'])
os.makedirs('export', exist_ok=True)
json.dump({'type': 'FeatureCollection', 'features': out}, open('export/spaces.geojson', 'w'), ensure_ascii=False, sort_keys=True, separators=(',', ':'))
print(len(out), 'spaces,', len(seen), 'codes')
```

`areaM2` is computed from the polygon in UTM 33N for every feature, halls included, so it never depends on which strand supplied the space.

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `../.venv/bin/python -m pytest -q test_export_spaces.py`
Expected: 4 passed. If rule 4 or 5 raises, the offending placement is wrong. Fix it in
`merge_structure.py` (it came from one of the research strands) and record why in its notes.
Never weaken the check.

- [ ] **Step 5: Commit**

```bash
cd .. && git add -A research && git commit -qm "export: spaces.geojson contract + tests"
```

---

## Part D — reis-data (PR 1)

Work in a reis-data worktree or branch: `git -C ~/Documents/reis/reis-data switch -c claude/curated-building-z`.
Before each commit, run the tests: `node --test scripts/*.test.mjs` from the reis-data root.

### Task D1: Curated inputs for building Z

**Files:**
- Create: `source/curated/Z/building.json`
- Create: `source/curated/Z/spaces.geojson` (copy of P3's `export/spaces.geojson`)
- Create: `source/curated/Z/is-rooms.json`
- Create: `source/curated/Z/README.md`

**Interfaces:**
- Produces:
  - `building.json` is `{ id, name, description, outline, defaultFloorId, floors: [{id, level, name}] }`. It has no `center`, `bounds` or `roomCount`; D2 computes those.
  - `is-rooms.json` is an array of `{ label, pasport, spaceId, seats, confidence, evidence, nickname? }`.

- [ ] **Step 1: Write `building.json`**

`outline` must be **byte-for-byte the `outline` of landmark 1587** in
`source/mendelu-landmarks.json`, so the extension can match them exactly (Task E2).

```bash
cd ~/Documents/reis/reis-data && mkdir -p source/curated/Z && node -e '
const fs=require("fs"); const L=JSON.parse(fs.readFileSync("source/mendelu-landmarks.json","utf8")).landmarks;
const o=L.find(l=>l.id===1587).outline;
const b={id:9000001,name:"Z",description:"Budova Z (FRRMS)",outline:o,defaultFloorId:9000011,
 floors:[{id:9000013,level:3,name:"3"},{id:9000012,level:2,name:"2"},{id:9000011,level:1,name:"1"},{id:9000010,level:0,name:"0"}]};
fs.writeFileSync("source/curated/Z/building.json", JSON.stringify(b,null,2)+"\n");'
cp ~/Documents/reis/frrms-indoor-research/research/export/spaces.geojson source/curated/Z/spaces.geojson
```

- [ ] **Step 2: Write `is-rooms.json` from the research inventory**

This is one row per IS room on 1.NP–4.NP, 20 rows. Take `spaceId` from
`spaces.geojson`, found by the room's pasport `code`. For the halls, use `hall:Z14` /
`hall:Z15`. `seats` comes from `research/is_catalogue_Z.json` `capacity`. `confidence` is
the inventory's `identity_confidence`. `evidence` is one plain sentence.

These rows must be exactly:

| label | pasport | note |
|---|---|---|
| Aula | N1000 | on 1.NP |
| Z1 | N2011 | |
| Z2 | N2008 | |
| Z3 | N2009 | |
| Z4 | N2010 | |
| Z5 | N2013 | |
| Z6 | N2014 | |
| Z7 | N2015 | |
| Z8 | N2025 | |
| Z9 | N2027 | |
| Z10 | N2029 | |
| Z11 | N2031 | evidence: "IS links an 11 m² storeroom; placed at the 83 m² end room by façade numbering" |
| Z13 | N2012 | |
| Z14 | N2024 | spaceId `hall:Z14` |
| Z15 | N2028 | spaceId `hall:Z15`; evidence: "IS links a 0.94 m² shaft" |
| Z24 | N2084 | evidence: "IS Číslo is door number 284" |
| Z25 | N2086 | |
| Z26 | N2081 | |
| Z28 | N2085 | evidence: "IS Číslo is door number 285; printed 'Učebna 28'" |
| Zasedačka FRRMS 4NP | N4002 | `nickname`: "Coworking" |

If a pasport has no space in `spaces.geojson` (Z11's N2031, Z15's N2028 and the halls
may lack a printed code), the row's `spaceId` wins. D2 writes the row's pasport onto
that space.

- [ ] **Step 3: Write `README.md`**

It covers:
- **Provenance:** tenders 1803/4051/4971/7573/8290/8329/5054 on zakazky.mendelu.cz, cited
  by number; the kit sha256 hashes from `sources.sha256`; OSM way 305942870 (a RÚIAN import).
- **What the files are:** derived geometry and public IS facts, no drawings.
- **Prefix:** `BZ00` is synthetic.
- **Licence:** accepted by Dominik on 2026-09-26.
- **Regenerating:** how to regenerate `spaces.geojson` (Part P of this plan, in the private
  folder).
- **Corrections:** a walk correction edits `is-rooms.json` only.

- [ ] **Step 4: Commit**

```bash
git add source/curated/Z && git commit -m "data: curated inputs for budova Z (FRRMS)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task D2: `curatedZ.mjs` turns the inputs into a Building, rooms and IS labels

**Files:**
- Create: `scripts/curatedZ.mjs`
- Test: `scripts/curatedZ.test.mjs`

**Interfaces:**
- Consumes: the D1 files.
- Produces:
  `export function buildCuratedZ({ building, spaces, isRooms }) → { building, rooms, labels }`, where:
  - `building` is a full `Building`: `center` [lat, lon], `bounds` [[S, W], [N, E]], and `floors[].roomCount`.
  - `rooms` is a FeatureCollection of `RoomProperties`.
  - `labels` is `[{ code, label }]`, in the same shape as `pairIsRooms` labels. If the Aula fix added a `campus` field to labels, add `campus: 'ČP II.'` here to match.

  Also `export const Z_PREFIX = 'BZ00'`.

- [ ] **Step 1: Write the failing tests**

```js
// scripts/curatedZ.test.mjs — Run: node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCuratedZ, Z_PREFIX } from './curatedZ.mjs';

const ring = [[16.61, 49.218], [16.611, 49.218], [16.611, 49.219], [16.61, 49.218]];
const building = { id: 9000001, name: 'Z', description: 'Budova Z (FRRMS)', outline: { type: 'Polygon', coordinates: [ring] },
  defaultFloorId: 9000011, floors: [{ id: 9000011, level: 1, name: '1' }, { id: 9000010, level: 0, name: '0' }] };
const sq = (x) => ({ type: 'Polygon', coordinates: [[[x, 49.2181], [x + 1e-4, 49.2181], [x + 1e-4, 49.2182], [x, 49.2181]]] });
const sp = (spaceId, level, code, namePrinted, category) =>
  ({ type: 'Feature', geometry: sq(16.61 + level * 1e-3 + Number(spaceId.split(':')[1] || 0) * 1e-5),
     properties: { spaceId, level, code, namePrinted, category, areaM2: 50 } });
const spaces = { type: 'FeatureCollection', features: [
  sp('0:239', 0, 'N1000', 'Aula', 'teaching'),
  sp('1:65', 1, 'N2011', 'Učebna Z1', 'teaching'),
  sp('1:2', 1, 'N2001', 'Knihovna', 'other'),
  sp('1:39', 1, null, null, 'courtyard'),
  sp('1:77', 1, null, null, null),
  sp('1:149', 1, null, null, null),
] };
const isRooms = [
  { label: 'Aula', pasport: 'N1000', spaceId: '0:239', seats: 190, confidence: 'confirmed', evidence: 'printed' },
  { label: 'Z1', pasport: 'N2011', spaceId: '1:65', seats: 24, confidence: 'confirmed', evidence: 'printed' },
  { label: 'Z11', pasport: 'N2031', spaceId: '1:149', seats: 64, confidence: 'low', evidence: 'IS links a storeroom' },
];
const run = () => buildCuratedZ({ building, spaces, isRooms });

test('drops roofs, voids and courtyards; keeps unnamed spaces unnamed', () => {
  const { rooms } = run();
  assert.equal(rooms.features.length, 5);
  const blank = rooms.features.find((f) => f.properties.passportNumber === null);
  assert.equal(blank.properties.name, '');
});

test('names follow the MENDELU convention: name = passportNumber = BZ00<pasport>', () => {
  const z1 = run().rooms.features.find((f) => f.properties.name === `${Z_PREFIX}N2011`);
  assert.equal(z1.properties.passportNumber, 'BZ00N2011');
  assert.equal(z1.properties.category, 'teaching');
  assert.equal(z1.properties.seats, 24);
  assert.equal(z1.properties.floorId, 9000011);
  assert.equal(z1.properties.floorLevel, 1);
});

test('an IS row gives its pasport to a space that has no printed code (Z11)', () => {
  const z11 = run().rooms.features.find((f) => f.properties.name === 'BZ00N2031');
  assert.ok(z11);
  assert.equal(z11.properties.seats, 64);
});

test('printed names become nicknames for non-IS rooms', () => {
  const lib = run().rooms.features.find((f) => f.properties.name === 'BZ00N2001');
  assert.equal(lib.properties.nickname, 'Knihovna');
  assert.equal(lib.properties.category, 'other');
});

test('labels pair every IS row to its code', () => {
  assert.deepEqual(run().labels, [
    { code: 'BZ00N1000', label: 'Aula' }, { code: 'BZ00N2011', label: 'Z1' }, { code: 'BZ00N2031', label: 'Z11' }]);
});

test('ids are sequential from 9001000 in sorted order and stable across runs', () => {
  const a = run().rooms.features.map((f) => f.properties.id);
  assert.deepEqual(a, [9001000, 9001001, 9001002, 9001003, 9001004]);
  assert.deepEqual(JSON.stringify(run()), JSON.stringify(run()));
});

test('building gets center [lat,lon], bounds [[S,W],[N,E]] and roomCount without structure', () => {
  const { building: b } = run();
  assert.deepEqual(b.bounds, [[49.218, 16.61], [49.219, 16.611]]);
  assert.equal(b.center.length, 2);
  assert.ok(b.center[0] > 49 && b.center[1] > 16);
  assert.equal(b.floors.find((f) => f.level === 1).roomCount, 4);
});

test('an IS row pointing at a missing space fails the build', () => {
  assert.throws(() => buildCuratedZ({ building, spaces, isRooms: [...isRooms,
    { label: 'Z9', pasport: 'N2027', spaceId: '1:999', seats: 40, confidence: 'inferred', evidence: 'x' }] }), /1:999/);
});

test('two spaces with one code fail the build', () => {
  const dup = { ...spaces, features: [...spaces.features, sp('1:70', 1, 'N2011', null, null)] };
  assert.throws(() => buildCuratedZ({ building, spaces: dup, isRooms }), /N2011/);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test scripts/curatedZ.test.mjs`
Expected: FAIL (`Cannot find module './curatedZ.mjs'`).

- [ ] **Step 3: Implement `scripts/curatedZ.mjs`**

```js
// Budova Z (FRRMS) is not in the MENDELU map API — it never was surveyed there.
// Its rooms are derived from public tender drawings (source/curated/Z/README.md)
// and arrive here as source/curated/Z/spaces.geojson. This turns them into the
// same shapes the API buildings have, so nothing downstream special-cases Z.
//
// `BZ00` is a SYNTHETIC passport prefix: MENDELU's own are BA01..BA39, and none
// is defined for Z. It exists because rooms-index and the app key rooms by a
// prefixed passport code.
export const Z_PREFIX = 'BZ00';
const FIRST_ROOM_ID = 9001000;
const DROP = new Set(['roof', 'roof?', 'void', 'courtyard']);
const CATEGORY = { teaching: 'teaching', office: 'office', service: 'service', circulation: 'circulation' };

function bbox(ring) {
  let S = Infinity, W = Infinity, N = -Infinity, E = -Infinity;
  for (const [lon, lat] of ring) {
    S = Math.min(S, lat); N = Math.max(N, lat); W = Math.min(W, lon); E = Math.max(E, lon);
  }
  return [[S, W], [N, E]];
}

export function buildCuratedZ({ building, spaces, isRooms }) {
  const floorByLevel = new Map(building.floors.map((f) => [f.level, f]));
  const spaceIds = new Set(spaces.features.map((f) => f.properties.spaceId));
  const isBySpace = new Map();
  for (const r of isRooms) {
    if (!spaceIds.has(r.spaceId)) throw new Error(`curatedZ: ${r.label} points at missing space ${r.spaceId}`);
    isBySpace.set(r.spaceId, r);
  }
  const seen = new Set();
  const features = [];
  for (const f of spaces.features) {
    const p = f.properties;
    if (DROP.has(p.category)) continue;
    const floor = floorByLevel.get(p.level);
    if (!floor) throw new Error(`curatedZ: no floor for level ${p.level} (${p.spaceId})`);
    const is = isBySpace.get(p.spaceId);
    const pasport = is ? is.pasport : p.code;
    const code = pasport ? `${Z_PREFIX}${pasport}` : null;
    if (code) {
      if (seen.has(code)) throw new Error(`curatedZ: ${pasport} is on two spaces`);
      seen.add(code);
    }
    features.push({ type: 'Feature', geometry: f.geometry, spaceId: p.spaceId, properties: {
      id: 0, buildingId: building.id, floorId: floor.id, floorLevel: p.level,
      name: code ?? '', nickname: is ? (is.nickname ?? null) : (p.namePrinted ?? null),
      type: is ? 'classroom' : 'room', category: is ? 'teaching' : (CATEGORY[p.category] ?? 'other'),
      label: is ? 'Classroom' : (p.namePrinted ?? ''), passportNumber: code, seats: is ? is.seats : null,
      hasProjector: false, hasWhiteboard: false, code: null } });
  }
  features.sort((a, b) => a.properties.floorLevel - b.properties.floorLevel
    || a.properties.name.localeCompare(b.properties.name) || a.spaceId.localeCompare(b.spaceId));
  features.forEach((f, i) => { f.properties.id = FIRST_ROOM_ID + i; delete f.spaceId; });

  const bounds = bbox(building.outline.coordinates[0]);
  const floors = building.floors.map((fl) => ({ ...fl,
    roomCount: features.filter((f) => f.properties.floorId === fl.id && f.properties.category !== 'structure').length }));
  const labels = isRooms.map((r) => ({ code: `${Z_PREFIX}${r.pasport}`, label: r.label }))
    .sort((a, b) => a.code.localeCompare(b.code) || a.label.localeCompare(b.label));
  return {
    building: { id: building.id, name: building.name, description: building.description, outline: building.outline,
      center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2], bounds,
      defaultFloorId: building.defaultFloorId, floors },
    rooms: { type: 'FeatureCollection', features },
    labels,
  };
}
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `node --test scripts/*.test.mjs`
Expected: all pass, including the existing pairIsRooms/placeIsRooms suites.

- [ ] **Step 5: Commit**

```bash
git add scripts/curatedZ.mjs scripts/curatedZ.test.mjs && git commit -m "feat(map): curated building Z generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task D3: `buildMapData.mjs` merges Z; ČP II. rooms without a plan go to building Z

**Files:**
- Modify: `scripts/buildMapData.mjs` (load curated after the `const pois = …` line; steps 1, 2, 3, 5, 6)
- Modify: `scripts/placeIsRooms.mjs` (the `CAMPUS['ČP II.']` entry and the CAMPUS `need` check)
- Test: `scripts/placeIsRooms.test.mjs` (update lines ~55 and ~135)

**Interfaces:**
- Consumes: `buildCuratedZ` from D2.
- Produces: `buildings.json` with 8 buildings (the `campus` key untouched), `map/rooms-9000001.geojson`, rooms-index entries for Z, and `isRoomLabels.json` including the Z labels. In `isRoomPlaces.json`, only K01–K03 remain for ČP II., with `{kind:'building', id:9000001}`.

- [ ] **Step 1: Update the placeIsRooms tests first**

In `scripts/placeIsRooms.test.mjs`, the fixtures' `buildings` must include
`{ id: 9000001, name: 'Z' }`. Change the ČP II. expectation (around lines 55 and 135) from
`{ kind: 'landmark', id: 1587 }` to `{ kind: 'building', id: 9000001 }`, and use
`K01` as the example label: Z rooms are now paired, so they are skipped. Add:

```js
test('a ČP II. room already paired (Z14) is not placed; K01 goes to building Z', () => {
  const cat = [
    { campusId: 139, campusCode: 'ČP II.', building: 'Z', label: 'Z14', number: 'N2024' },
    { campusId: 139, campusCode: 'ČP II.', building: 'Budova K', label: 'K01', number: 'P1055' },
  ];
  const { places } = placeIsRooms(cat, new Set(['Z14']), maps);
  assert.deepEqual(places, [{ label: 'K01', campus: 'ČP II.', kind: 'building', id: 9000001 }]);
});
```

(`maps` is the fixture object the file already builds; add Z to its `buildings`.)

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test scripts/placeIsRooms.test.mjs`
Expected: FAIL (the kind is still `landmark`).

- [ ] **Step 3: Implement it in `placeIsRooms.mjs`**

```js
  // Budova Z (FRRMS) has a floor plan since 2026-09 (source/curated/Z), so its
  // rooms are paired and never reach this table. What is left on ČP II. is
  // Budova K (K01–K03, ÚCB AF), which has no plan: show building Z, the same
  // outline landmark 1587 gave it before.
  'ČP II.': { kind: 'building', id: 9000001 },
```

In the `CAMPUS` branch, check the id against the right set per kind:

```js
    } else if (CAMPUS[r.campusCode]) {
      target = CAMPUS[r.campusCode];
      const ids = target.kind === 'landmark' ? landmarkIds : target.kind === 'building' ? new Set(buildingId.values()) : remoteIds;
      need(ids.has(target.id), `${target.kind} ${target.id}`);
    }
```

- [ ] **Step 4: Merge curated data in `buildMapData.mjs`**

Immediately after `const pois = read('source/mendelu-pois.geojson');`:

```js
import { buildCuratedZ } from './curatedZ.mjs';   // move to the import block at the top
// Curated buildings (not in the MENDELU API): separate inputs, so an API re-fetch
// never wipes them. Appended AFTER the API data; META.campus is left untouched.
const curatedZ = buildCuratedZ({
  building: read('source/curated/Z/building.json'),
  spaces: read('source/curated/Z/spaces.geojson'),
  isRooms: read('source/curated/Z/is-rooms.json'),
});
buildings.buildings.push(curatedZ.building);
rooms.features.push(...curatedZ.rooms.features);
```

Steps 1–3 then include Z automatically: they iterate `buildings` and `rooms`. In step 5,
append the curated labels after `pairIsRooms`, then re-sort:

```js
const paired = pairIsRooms(read('source/is-room-catalogue.json'), rooms, buildings);
const labels = [...paired.labels, ...curatedZ.labels]
  .sort((a, b) => a.code.localeCompare(b.code) || a.label.localeCompare(b.label));
const report = paired.report;
```

Step 6 already passes `new Set(labels.map((l) => l.label))`, so Z's labels are skipped there.
If the Aula fix changed how `placeIsRooms` keys paired labels (label + campus), pass the
Z labels in that shape.

- [ ] **Step 5: Build into a scratch dir and check the output**

```bash
node --test scripts/*.test.mjs
rm -rf /tmp/zbuild && node scripts/buildMapData.mjs --ext=/tmp/zbuild
node -e '
const fs=require("fs"); const b=JSON.parse(fs.readFileSync("/tmp/zbuild/buildings.json","utf8"));
const old=JSON.parse(fs.readFileSync("source/mendelu-buildings.json","utf8"));
if (JSON.stringify(b.campus)!==JSON.stringify(old.campus)) throw "campus changed";
const z=b.buildings.find(x=>x.id===9000001); console.log(b.buildings.length, z.floors.map(f=>f.name+":"+f.roomCount).join(" "));
const L=JSON.parse(fs.readFileSync("/tmp/zbuild/isRoomLabels.json","utf8")).filter(l=>l.code.startsWith("BZ00")); console.log("Z labels", L.length);
const P=JSON.parse(fs.readFileSync("/tmp/zbuild/isRoomPlaces.json","utf8")).filter(p=>p.campus==="ČP II."); console.log(P.map(p=>p.label+"->"+p.kind+":"+p.id).join(" "));'
ls -l map/rooms-9000001.geojson
```

Expected output:
- `8`, then four floors with non-zero room counts.
- `Z labels 20`.
- `K01->building:9000001 K02->building:9000001 K03->building:9000001`.
- The file `map/rooms-9000001.geojson` exists.

The script also rewrites `map/rooms-<id>.geojson` for the seven API buildings. `git status`
must show **only** `map/rooms-9000001.geojson` as new under `map/`, with no diff on the others.
If the others changed, stop: the API snapshot and the repo disagree. Report it rather
than committing it.

- [ ] **Step 6: Commit**

```bash
git add scripts/buildMapData.mjs scripts/placeIsRooms.mjs scripts/placeIsRooms.test.mjs map/rooms-9000001.geojson
git commit -m "feat(map): merge curated building Z; ČP II. leftovers point at it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task D4: reis-data PR

- [ ] **Step 1: Push and open the PR**

Push identity and merge rules: memory `github-push-identity`.

```bash
git push -u origin claude/curated-building-z
gh pr create --repo reis-mendelu/reis-data --base main --title "Curated building Z (FRRMS): 4 floors of rooms" --body "$(cat <<'EOF'
Adds budova Z as a curated building (source/curated/Z): 1.NP–4.NP, rooms derived from public tender drawings (provenance in its README; no drawings committed), IS pairing from an explicit table (is-rooms.json). buildMapData merges it; ČP II. leftovers (K01–K03) point at building Z instead of landmark 1587. Campus bounds unchanged.

Harmless before the app release: no released app lists building 9000001, so nobody fetches rooms-9000001.geojson yet.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Enable Auto-fix** (memory `always-enable-auto-fix`).

- [ ] **Step 3: Ask Dominik to approve the merge.** E4 needs the file on the jsDelivr
  `@main` CDN to render rooms in the dev app. Do not merge without his yes.

---

## Part E — reis-extension (PR 2)

Work in a worktree branched from an up-to-date `test`. First bring the branch up to date
with the ccd_host `sync_with_base_branch` tool.

### Task E0: The Aula fix is in

- [ ] **Step 1: Confirm the campus-aware Aula fix has merged into `test`**

Run: `git log origin/test --oneline -30 | grep -i aula`
Expected: a merged commit for "Aula (ČP II.)". If it is absent, **stop**: without it,
the Z label "Aula" collides with building A's (`IS_CODE_BY_LABEL` in
`src/utils/rooms/lookupRoom.ts` keys by label only).

- [ ] **Step 2: Note the label shape the fix left**

Run: `head -12 src/data/map/isRoomLabels.json`
Record it: `{code,label}` or `{code,label,campus}`. D2/D3 must emit the same shape. If
they don't, fix D2's `labels` and rebuild before E1.

### Task E1: Bundle the regenerated data; update tests that assumed seven buildings

**Files:**
- Modify: `src/data/map/buildings.json`, `src/data/map/isRoomLabels.json`, `src/data/map/isRoomPlaces.json`, `src/data/map/rooms-index.json` (Z entries only)
- Modify tests:
  - `src/data/map/__tests__/mapData.test.ts:22`
  - `src/utils/routing/__tests__/nextLessonTarget.test.ts:60`
  - `src/utils/rooms/__tests__/lookupRoomPlace.test.ts:15`
  - `src/store/slices/__tests__/createMapSlice.test.ts:173`
  - `campusGraph.test.ts:85` and `campusWalksData.test.ts:11` (`find src -name 'campus*Graph*.test.ts' -o -name 'campusWalksData.test.ts'`)

- [ ] **Step 1: Update the tests to the new truth**

- `mapData.test.ts`: rename to `'has 8 buildings (7 surveyed + curated Z) each with a defaultFloorId'`, `toHaveLength(8)`.
- `nextLessonTarget.test.ts`: the Z25 case becomes:

```ts
  it('targets a FRRMS room now that budova Z has a floor plan', () => {
    const t = nextLessonTarget([lesson('20260921', '13:00', 'Z25 (ČP II.)')], MON_10);
    expect(t!.buildingName).toBe('Z');
  });
```

- `lookupRoomPlace.test.ts:15`: replace the `['Z11 (ČP II.)', 'landmark', 1587]` row with `['K01 (ČP II.)', 'building', 9000001]`, a Budova K room with no plan.
- `createMapSlice.test.ts:173`: replace `['Z11 (ČP II.)', 1587, 'Z11']` with `['K01 (ČP II.)', 9000001, 'K01']`. Adjust the assertion if it checks `kind` (a building target flies to the building centre, see `focusRoomPlace.ts:33`).
- `campusGraph.test.ts` / `campusWalksData.test.ts`: where they compare the graph's buildings to `buildings.json`, exclude buildings that deliberately have no walks, with the reason:

```ts
// Budova Z (FRRMS) has a floor plan but no routing-graph nodes in v1 — walking
// into Z is out of scope (docs/superpowers/specs/2026-09-26-frrms-indoor-map-design.md).
const NO_WALKS = new Set(['Z']);
```

- Add to `lookupRoomPlace.test.ts` (or the lookupRoom test) one test on the real bundled
  data. It fails until Step 3 copies the data in:

```ts
  it.each([['Z14 (ČP II.)', 'BZ00N2024'], ['Aula (ČP II.)', 'BZ00N1000'], ['Zasedačka FRRMS 4NP (ČP II.)', 'BZ00N4002']])(
    '%s resolves to its Z room', (raw, code) => {
      const t = lookupRoomTarget(raw, INDEX);
      expect(t?.kind).toBe('room');
      expect(t?.kind === 'room' && t.entry.code).toBe(code);
    });
  it('plain "Aula" still means building A', () => {
    const t = lookupRoomTarget('Aula', INDEX);
    expect(t?.kind === 'room' && t.entry.code).toBe('BA01N3054');
  });
```

(`INDEX` is `rooms-index.json` imported as the file already does elsewhere, e.g. `import INDEX from '../../../data/map/rooms-index.json'`.)

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run mapData nextLessonTarget lookupRoomPlace createMapSlice campusGraph campusWalksData`
Expected: FAIL on 8 buildings, Z25, K01 and Z14.

- [ ] **Step 3: Copy the data**

Rebuild into scratch with the merged reis-data (`node ~/Documents/reis/reis-data/scripts/buildMapData.mjs --ext=/tmp/zbuild`). Then:

```bash
cmp /tmp/zbuild/landmarks.json src/data/map/landmarks.json && cmp /tmp/zbuild/remotePlaces.json src/data/map/remotePlaces.json
cp /tmp/zbuild/buildings.json /tmp/zbuild/isRoomLabels.json /tmp/zbuild/isRoomPlaces.json src/data/map/
node -e '
const fs=require("fs"); const p="src/data/map/rooms-index.json";
const cur=JSON.parse(fs.readFileSync(p,"utf8")).filter(e=>e.buildingId!==9000001);
const z=JSON.parse(fs.readFileSync("/tmp/zbuild/rooms-index.json","utf8")).filter(e=>e.buildingId===9000001);
fs.writeFileSync(p, JSON.stringify([...cur,...z]));'
npx prettier --write src/data/map/buildings.json src/data/map/isRoomLabels.json src/data/map/isRoomPlaces.json src/data/map/rooms-index.json
git diff --stat src/data/map/
```

Expected:
- Both `cmp` pass.
- `rooms-index.json` changes by additions only. Check with `git diff src/data/map/rooms-index.json | grep '^-' | grep -v '^---'`, which must print nothing beyond formatting.
- The only Z-related `isRoomPlaces.json` rows left are K01–K03.

**Never** copy `/tmp/zbuild/rooms-index.json` wholesale: the bundled one carries hand
edits (the building X merges, suppressed rooms), guarded by `mergedRooms.test.ts`.

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `npx vitest run mapData nextLessonTarget lookupRoomPlace createMapSlice campusGraph campusWalksData mergedRooms lookupRoom && npm run typecheck`
Expected: PASS. If vitest's worker handshake times out under load, use
`--no-file-parallelism --maxWorkers=1`.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(map): bundle budova Z (FRRMS) — 4 floors, 20 IS rooms

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task E2: Landmarks that share Z's outline are not drawn; "FRRMS" opens the floor plan

**Files:**
- Create: `src/components/CampusMap/landmarkBuilding.ts`
- Test: `src/components/CampusMap/__tests__/landmarkBuilding.test.ts`
- Modify: `src/components/CampusMap/mapLayers.ts` (remove `LANDMARK_LETTERS` at :18, and its use at :147; skip shared landmarks in `drawLandmarks`)
- Modify: `src/store/slices/createMapSlice.ts:149` (`focusLandmarkById`)
- Test: `src/store/slices/__tests__/createMapSlice.test.ts`

**Interfaces:**
- Produces: `export function buildingSharingOutline(l: Landmark, buildings: readonly Building[]): Building | undefined`

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/CampusMap/__tests__/landmarkBuilding.test.ts
import { describe, it, expect } from 'vitest';
import buildingsJson from '../../../data/map/buildings.json';
import landmarksJson from '../../../data/map/landmarks.json';
import { buildingSharingOutline } from '../landmarkBuilding';
import type { BuildingsMeta, Landmark } from '../../../types/campusMap';

const B = (buildingsJson as BuildingsMeta).buildings;
const L = (landmarksJson as { landmarks: Landmark[] }).landmarks;
const byId = (id: number) => L.find((l) => l.id === id)!;

describe('buildingSharingOutline', () => {
  it('FRRMS (1587) and Kolej Akademie (1616) share budova Z', () => {
    expect(buildingSharingOutline(byId(1587), B)?.name).toBe('Z');
    expect(buildingSharingOutline(byId(1616), B)?.name).toBe('Z');
  });
  it('every other landmark is its own place', () => {
    const shared = L.filter((l) => buildingSharingOutline(l, B)).map((l) => l.id).sort();
    expect(shared).toEqual([1587, 1616]);
  });
});
```

In `createMapSlice.test.ts`:

```ts
  it('focusing the FRRMS landmark opens budova Z instead of a no-floor-plan card', () => {
    useAppStore.getState().focusLandmarkById(1587);
    const s = useAppStore.getState();
    expect(s.activeBuildingId).toBe(9000001);
    expect(s.mapSelection?.kind).not.toBe('poi');
  });
  it('Kolej Akademie keeps its card (it is a dormitory, not the faculty)', () => {
    useAppStore.getState().focusLandmarkById(1616);
    const s = useAppStore.getState();
    expect(s.mapSelection?.kind === 'poi' && s.mapSelection.poi.id).toBe(1616);
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run landmarkBuilding createMapSlice`
Expected: FAIL (the module doesn't exist; `activeBuildingId` is null).

- [ ] **Step 3: Implement it**

```ts
// src/components/CampusMap/landmarkBuilding.ts
import type { Building, Landmark } from '../../types/campusMap';

const ringKey = (ring: readonly (readonly number[])[]) =>
  ring.map((p) => `${p[0]!.toFixed(7)},${p[1]!.toFixed(7)}`).join(';');

/**
 * The building a landmark is drawn as, when both carry the same outline.
 *
 * FRRMS (1587) and Kolej Akademie (1616) are one structure, and since 2026-09
 * that structure is budova Z with a floor plan (reis-data source/curated/Z,
 * whose outline is copied from 1587). Landmarks draw on top of buildings, so
 * drawing either would swallow every tap on Z. They stay in landmarks.json for
 * search and the Places list, and are simply not drawn a second time.
 */
export function buildingSharingOutline(
  l: Landmark,
  buildings: readonly Building[]
): Building | undefined {
  const key = ringKey(l.outline.coordinates[0]!);
  return buildings.find((b) => ringKey(b.outline.coordinates[0]!) === key);
}
```

In `mapLayers.ts`:
- Delete `LANDMARK_LETTERS` and its comment. The building's own label draws "Z".
- Import `buildingsJson` and `buildingSharingOutline`.
- At the top of the `for (const l of LANDMARKS)` loop in `drawLandmarks`, add
  `if (buildingSharingOutline(l, BUILDINGS)) continue;`, where
  `const BUILDINGS = (buildingsJson as BuildingsMeta).buildings;`.
- Replace the letter branch with `poly.bindTooltip(LANDMARK_LABELS.get(l.id) ?? l.name);`.

In `createMapSlice.ts` `focusLandmarkById`, directly after the unknown-landmark guard:

```ts
    // FRRMS is budova Z, which has a floor plan: open it. Kolej Akademie shares
    // the outline but is the dormitory, so it keeps its own card.
    const building = l.type === 'building' ? buildingSharingOutline(l, META.buildings) : undefined;
    if (building) {
      get().setMapBuilding(building.id);
      return;
    }
```

(`META` / `buildingsJson` may already be imported in the slice. If not, import them the
way `focusRoomPlace.ts:4-6` does.)

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `npx vitest run landmarkBuilding createMapSlice LandmarkPicker mapLayers && npm run typecheck`
Expected: PASS. If a test asserted `LANDMARK_LETTERS` or a drawn 1587 polygon, update it
to the new truth: Z is drawn once, as a building.

- [ ] **Step 5: Commit**

```bash
git add src/components/CampusMap src/store/slices
git commit -m "feat(map): budova Z replaces the FRRMS landmark outline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task E3: No dead "Trasa" for a building the router cannot reach

**Files:**
- Modify: `src/utils/routing/routableStart.ts:47` (`canRouteFrom`); refresh the doc comment above it (lines ~25–45) and the one above `nextLessonTarget` in `src/utils/routing/nextLessonTarget.ts` (~50–60, ~84–95), which say Z does not resolve
- Test: the existing routableStart test (`find src -name 'routableStart*.test.ts'`), or create `src/utils/routing/__tests__/routableStart.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { canRouteFrom } from '../routableStart';

describe('canRouteFrom', () => {
  it('offers no walk to budova Z, even with no position fix — Z has no graph nodes in v1', () => {
    expect(canRouteFrom(null, 'Z')).toBe(false);
  });
  it('still offers a walk to a graph building when the position is unknown', () => {
    expect(canRouteFrom(null, 'Q')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run routableStart`
Expected: FAIL (`canRouteFrom(null, 'Z')` returns true).

- [ ] **Step 3: Implement the guard**

```ts
export function canRouteFrom(at: [number, number] | null, buildingName: string): boolean {
  // A building with no nodes has no walk from anywhere — budova Z in v1. Checked
  // before the no-fix branch, which otherwise offers a press that draws nothing.
  const targets = GRAPH.buildings[buildingName] ?? [];
  if (targets.length === 0) return false;
  if (!at) return true;
  const snap = snapToGraph(GRAPH, at);
  if (!snap) return false;
  const now = devForcedNow() ?? new Date();
  const isOpen = (gate: string) => isGateOpen(gate, now);
  return shortestWalk(GRAPH, snap, targets, isOpen) !== null;
}
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `npx vitest run routableStart nextLessonTarget RoutePicker RouteButton && npm run typecheck`
Expected: PASS. `RoutePicker.test.tsx:33-36` still asserts Z is absent from routing, which
stays true.

- [ ] **Step 5: Commit**

```bash
git add src/utils/routing
git commit -m "fix(routing): no Trasa offer for a building without graph nodes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task E4: Verify both trees at phone and tablet widths

This needs the reis-data PR merged: the dev app fetches `rooms-9000001.geojson` from
jsDelivr `@main`. jsDelivr may cache a branch for up to 12 h. If the file 404s just
after the merge, purge `https://purge.jsdelivr.net/gh/reis-mendelu/reis-data@main/map/rooms-9000001.geojson`.

- [ ] **Step 1: Load the `verify-ui` skill and follow it.** Serve with `npm run dev:web`
  (skill `dev-real-data`). Checks, each by DOM or geometry assertion, never a screenshot
  alone:
  - **Desktop tree (extension layout):**
    - a tap on Z opens floor view on 2.NP;
    - FloorStack shows `3 2 1 0`;
    - floor 2.NP renders room polygons;
    - searching `Z14` focuses a room on 2.NP;
    - picking "FRRMS / Kolej Akademie" in Places opens the floor plan;
    - the Kolej Akademie card still shows "Také zde".
  - **Phone tree at 320/390/430 and tablet width,** both themes. The same checks via
    MapScreen and FloorSwitcher. FloorSwitcher must not collide with the bottom sheet at
    320 with four floor buttons.
  - **A timetable lesson in `Z11 (ČP II.)`:** its room card opens Z11 (not the landmark),
    and there is **no Trasa** button.
  - **The rest of the campus:** framing is unchanged, meaning the opening view is identical
    before and after (compare `map.getBounds()`).
- [ ] **Step 2: Send the before/after PNGs to Dominik with `SendUserFile`** (memory
  `verifying-ui-work`), at phone and tablet sizes and on the desktop tree.

### Task E5: Walk corrections, then the extension PR

- [ ] **Step 1: Apply the walk photos when they arrive.**
  - Map each photographed sign to its space via walk order (EXIF timestamps) against
    `spaces.geojson`.
  - Edit only `source/curated/Z/is-rooms.json` (`spaceId`, `confidence: "confirmed"`,
    `evidence: "door sign photo YYYY-MM-DD"`).
  - Rerun D3 Step 5, push to the reis-data PR (or a follow-up PR if merged), and repeat
    E1 Step 3.
  - Goal condition Dominik will set, verbatim: "Every FRRMS room students see in IS on
    1.NP–2.NP — Aula, Z1, Z2, Z3, Z4, Z5, Z6, Z7, Z8, Z9, Z10, Z11, Z13, Z14, Z15, Z24,
    Z25, Z26, Z28 — is matched to exactly one space in frrms_structure.geojson with
    identity_confidence "confirmed", each backed by a door-sign photo or printed drawing
    text, with no two rooms on the same space".
- [ ] **Step 2: Open the PR against `test`**

```bash
git push -u origin HEAD
gh pr create --base test --title "feat(map): budova Z (FRRMS) indoor map — 4 floors, every room" --body "$(cat <<'EOF'
Tap FRRMS → floor stack 1.NP–4.NP (opens on 2.NP), every room drawn; Z1–Z28, Aula and the coworking room resolve to their room. Data from reis-data#<n> (curated building Z). Landmarks 1587/1616 share Z's outline and are no longer drawn; "FRRMS" in Places opens the floor plan. No walking routes into Z yet (no graph nodes): canRouteFrom now refuses a building without nodes, so no dead Trasa.

Both UI trees (shared CampusMap/ + data); verified at 320/390/430 + tablet, both themes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Enable Auto-fix and bind the PR** (the ccd_pr tools `get_status` / `bind_pr`).
