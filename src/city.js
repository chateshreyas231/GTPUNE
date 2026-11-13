import * as THREE from "three";
export const origin = { lat: 18.5167, lon: 73.841 };
// One tight lane each way, plus a kerb strip a parked scooter can occupy.
// Wider survey tags are narrowed to this carriageway before anything drives them.
export const DRIVE_LANE_METERS = 2.25;
export const BIKE_PARK_METERS = 0.75;
export const PUNE_CARRIAGE_METERS = DRIVE_LANE_METERS * 2 + BIKE_PARK_METERS * 2;
export function project(lat, lon) {
  return [(lon - origin.lon) * 105500, -(lat - origin.lat) * 111320];
}
export function fallbackCity() {
  const roads = [];
  for (let n = -600; n <= 600; n += 150) {
    roads.push({
      points: [
        [-850, n],
        [850, n],
      ],
      width: PUNE_CARRIAGE_METERS,
      sidewalk: 1.6,
    });
    roads.push({
      points: [
        [n, -850],
        [n, 850],
      ],
      width: PUNE_CARRIAGE_METERS,
      sidewalk: 1.6,
    });
  }
  const buildings = [];
  let seed = 42;
  const rnd = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let x = -750; x < 750; x += 150)
    for (let z = -750; z < 750; z += 150)
      for (let j = 0; j < 4; j++) {
        const bx = x + 35 + (j % 2) * 65,
          bz = z + 35 + Math.floor(j / 2) * 65;
        const w = 24 + rnd() * 18,
          d = 24 + rnd() * 18;
        buildings.push({
          points: [
            [bx - w / 2, bz - d / 2],
            [bx + w / 2, bz - d / 2],
            [bx + w / 2, bz + d / 2],
            [bx - w / 2, bz + d / 2],
          ],
          height: 9 + Math.floor(rnd() * 6) * 3,
          color: rnd(),
        });
      }
  const stops = [
    { name: "FC ROAD", point: [-5, -450] },
    { name: "KOTHRUD", point: [-600, 300] },
    { name: "DECCAN GYMKHANA", point: [-5, 70] },
  ];
  return {
    source: "illustrative",
    roads,
    buildings,
    spawn: [-5, 70],
    stops,
    places: [],
  };
}
// Survey constants from public/data/pune-osm.json. See docs/MEASUREMENTS.md.
// 46 buildings carry both height and building:levels. Their storey median is
// 3.33 m and the lower quartile is 3.00 m, so an untagged level is 3 m.
export const STOREY_METERS = 3;
// IRC urban lane, used only when a way has lanes but no width tag.
export const LANE_METERS = 3.5;
// Modal `lanes` among tagged ways: primary 2 (108/196), secondary 2 (66/85),
// tertiary 2 (57/76), trunk 2 (16/27), residential 2 (25/44).
const CLASS_LANES = {
  motorway: 2,
  trunk: 2,
  primary: 2,
  secondary: 2,
  tertiary: 2,
  residential: 2,
  unclassified: 2,
};
// Median floors of buildings of this type that have a height or level tag.
// hotel (n=2) and a college levels value of 0 are not used as defaults.
const TYPE_FLOORS = {
  apartments: 5,
  residential: 4,
  yes: 4,
  house: 2,
  detached: 2,
  bungalow: 1,
  shed: 1,
  commercial: 3,
  retail: 4,
  school: 4,
  college: 4,
  university: 4,
  office: 5,
  industrial: 3,
  hospital: 7,
  temple: 1,
  train_station: 6,
  dormitory: 2,
};

export function parseMeters(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null) return NaN;
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)(?:\s*m)?$/i);
  return match ? Number(match[1]) : NaN;
}

function surveyedRoadWidth(tags = {}) {
  const tagged = parseMeters(tags.width);
  if (tagged >= 1 && tagged <= 40)
    return { width: tagged, widthSource: "width-tag" };
  const lanes = parseMeters(tags.lanes);
  if (lanes >= 1 && lanes <= 8)
    return { width: lanes * LANE_METERS, widthSource: "lanes" };
  if (tags.highway === "service" || tags.highway === "living_street")
    return { width: 5, widthSource: "class-default" };
  return {
    width: (CLASS_LANES[tags.highway] ?? 2) * LANE_METERS,
    widthSource: "class-default",
  };
}

// The mesh and the traffic use the narrower of the survey and a Pune carriageway:
// one lane each way plus room for parked bikes. A service street that is already
// narrower stays at the surveyed width.
export function roadWidthFromTags(tags = {}) {
  const surveyed = surveyedRoadWidth(tags);
  return {
    width: Math.min(surveyed.width, PUNE_CARRIAGE_METERS),
    widthSource: surveyed.widthSource,
  };
}

// Sidewalks are not width-tagged. These sit inside the measured p10 gap from
// the centerline to the nearest footprint. See docs/MEASUREMENTS.md.
export function sidewalkMeters(name = "") {
  const n = String(name).toLowerCase();
  if (n.includes("gokhale") || n.includes("off fc")) return 2.4;
  if (
    n.includes("jangli maharaj") ||
    n.includes("karve road") ||
    n.includes("paud road")
  )
    return 2.2;
  return 1.6;
}

export function buildingSizeFromTags(tags = {}) {
  const tagged = parseMeters(tags.height);
  if (tagged > 0) {
    const height = Math.min(120, Math.max(3, tagged));
    return {
      height,
      floors: Math.max(1, Math.round(height / STOREY_METERS)),
      heightSource: "height-tag",
    };
  }
  const levels = parseMeters(tags["building:levels"]);
  if (levels > 0 && levels < 60) {
    const floors = Math.max(1, Math.round(levels));
    return {
      height: Math.min(120, Math.max(3, floors * STOREY_METERS)),
      floors,
      heightSource: "levels-tag",
    };
  }
  const floors = TYPE_FLOORS[tags.building] || TYPE_FLOORS.yes;
  return {
    height: floors * STOREY_METERS,
    floors,
    heightSource: "type-default",
  };
}

export function placeKindFromTags(tags = {}) {
  if (tags.amenity === "school") return "school";
  if (tags.amenity === "college" || tags.amenity === "university") return "college";
  if (tags.leisure === "playground") return "playground";
  if (tags.amenity === "fuel") return "fuel";
  if (
    tags.amenity === "gym" ||
    tags.leisure === "fitness_centre" ||
    tags.leisure === "fitness_station"
  )
    return "gym";
  if (tags.shop) return "store";
  return null;
}

const PLACE_LABEL = {
  school: "School",
  college: "College",
  store: "Store",
  playground: "Playground",
  fuel: "Fuel",
  gym: "Gym",
};

// The map label is the OpenStreetMap name. An untagged kind is absent.
export function placeNameFromTags(tags = {}, kind) {
  const named = String(tags.name || tags["name:en"] || "").trim();
  return named || PLACE_LABEL[kind] || "Place";
}

export function elementPoint(element) {
  if (Array.isArray(element.geometry) && element.geometry.length) {
    let x = 0,
      z = 0;
    for (const p of element.geometry) {
      const q = project(p.lat, p.lon);
      x += q[0];
      z += q[1];
    }
    return [x / element.geometry.length, z / element.geometry.length];
  }
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon))
    return project(element.lat, element.lon);
  return null;
}

export function placesFromElements(elements) {
  const places = [];
  for (const element of elements || []) {
    const kind = placeKindFromTags(element.tags);
    if (!kind) continue;
    const point = elementPoint(element);
    if (!point) continue;
    places.push({
      kind,
      point,
      osm: true,
      name: placeNameFromTags(element.tags, kind),
    });
  }
  return places;
}

export function parseOSM(data) {
  if (!Array.isArray(data.elements))
    throw Error("Invalid OpenStreetMap response");
  const roads = [],
    buildings = [];
  for (const e of data.elements) {
    if (!e.geometry?.length || !e.tags) continue;
    const points = e.geometry.map((p) => project(p.lat, p.lon));
    if (
      e.tags.highway &&
      [
        "motorway",
        "trunk",
        "primary",
        "secondary",
        "tertiary",
        "residential",
        "unclassified",
        "service",
        "living_street",
      ].includes(e.tags.highway)
    ) {
      const measured = roadWidthFromTags(e.tags);
      roads.push({
        points,
        width: measured.width,
        widthSource: measured.widthSource,
        sidewalk: sidewalkMeters(e.tags.name),
        name: e.tags.name,
        highway: e.tags.highway,
      });
    }
    if (e.tags.building && points.length >= 4) {
      const measured = buildingSizeFromTags(e.tags);
      buildings.push({
        points,
        height: measured.height,
        floors: measured.floors,
        heightSource: measured.heightSource,
        kind: e.tags.building,
        color: ((e.id || 0) % 100) / 100,
      });
    }
  }
  if (!roads.length) throw Error("Map contains no driveable roads");
  const nearest = (p) => {
    let best,
      d = Infinity;
    for (const r of roads)
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1],
          b = r.points[i],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          t = Math.max(
            0,
            Math.min(
              1,
              ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) /
                (dx * dx + dz * dz || 1),
            ),
          );
        const q = [a[0] + t * dx, a[1] + t * dz],
          dd = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (dd < d) {
          d = dd;
          best = q;
        }
      }
    return best;
  };
  const spawn = nearest([0, 0]);
  const stops = [
    { name: "FC ROAD", point: nearest(project(18.5235, 73.8412)) },
    { name: "KOTHRUD", point: nearest(project(18.5074, 73.8077)) },
    { name: "DECCAN GYMKHANA", point: spawn },
  ];
  const surveyed = buildings.length;
  const infill = fillBuildingGaps(buildings, roads);
  for (const extra of infill) buildings.push(extra);
  return {
    source: "OpenStreetMap",
    roads,
    buildings,
    spawn,
    stops,
    places: placesFromElements(data.elements),
    surveyed,
    infill: infill.length,
  };
}
export function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(
        1,
        ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
      ),
    );
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
export function inside(x, z, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}

function footprintBounds(points) {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of points) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  return { minX, maxX, minZ, maxZ };
}

function coverGrid(grid, cell, box, item) {
  const x0 = Math.floor(box.minX / cell),
    x1 = Math.floor(box.maxX / cell),
    z0 = Math.floor(box.minZ / cell),
    z1 = Math.floor(box.maxZ / cell);
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const key = `${x}:${z}`;
      let list = grid.get(key);
      if (!list) grid.set(key, (list = []));
      list.push(item);
    }
}

function gridNear(grid, cell, x, z) {
  const cx = Math.floor(x / cell),
    cz = Math.floor(z / cell),
    out = [];
  for (let ix = cx - 1; ix <= cx + 1; ix++)
    for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const list = grid.get(`${ix}:${iz}`);
      if (list) out.push(...list);
    }
  return out;
}

// Original blocks in the open ground around surveyed footprints. Each one keeps
// a narrow gap from its neighbours, stays off the carriageway and the sidewalk,
// and takes the height of the buildings beside it.
const INFILL_GAP = 0.85;
const INFILL_MIN_DEPTH = 2.8;
const INFILL_ROW_DEPTH = 14;
const INFILL_MAX_ROWS = 2;
const INFILL_MIN_ALONG = 3.8;
const INFILL_MAX_ALONG = 16;
const NEIGHBOR_REACH = 32;
const PROBE_STEP = 0.4;

export function fillBuildingGaps(buildings, roads) {
  const cell = 28;
  const boxes = [];
  const grid = new Map();
  for (let i = 0; i < buildings.length; i++) {
    const building = buildings[i];
    if (!building.points || building.points.length < 3) continue;
    const box = footprintBounds(building.points);
    const item = { ...box, building, i };
    boxes.push(item);
    coverGrid(grid, cell, box, item);
  }
  const roadGrid = new Map();
  for (const road of roads || []) {
    const clearance =
      Math.max(1.4, (road.width || PUNE_CARRIAGE_METERS) / 2) +
      (road.sidewalk ?? 1.6);
    const pts = road.points || [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i];
      const seg = {
        a,
        b,
        clearance,
        minX: Math.min(a[0], b[0]) - clearance,
        maxX: Math.max(a[0], b[0]) + clearance,
        minZ: Math.min(a[1], b[1]) - clearance,
        maxZ: Math.max(a[1], b[1]) + clearance,
      };
      coverGrid(roadGrid, cell, seg, seg);
    }
  }
  const onRoad = (x, z) => {
    for (const seg of gridNear(roadGrid, cell, x, z)) {
      if (x < seg.minX || x > seg.maxX || z < seg.minZ || z > seg.maxZ) continue;
      if (segmentDistance(x, z, seg.a, seg.b) < seg.clearance) return true;
    }
    return false;
  };
  const occupied = (x, z, ignore) => {
    for (const item of gridNear(grid, cell, x, z)) {
      if (item === ignore) continue;
      if (
        x < item.minX - 0.05 ||
        x > item.maxX + 0.05 ||
        z < item.minZ - 0.05 ||
        z > item.maxZ + 0.05
      )
        continue;
      if (inside(x, z, item.building.points)) return item;
    }
    return null;
  };
  const nearestNeighbor = (item) => {
    const x0 = Math.floor((item.minX - NEIGHBOR_REACH) / cell),
      x1 = Math.floor((item.maxX + NEIGHBOR_REACH) / cell),
      z0 = Math.floor((item.minZ - NEIGHBOR_REACH) / cell),
      z1 = Math.floor((item.maxZ + NEIGHBOR_REACH) / cell);
    let best = null,
      bestD = NEIGHBOR_REACH;
    const seen = new Set();
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const list = grid.get(`${x}:${z}`);
        if (!list) continue;
        for (const other of list) {
          if (other === item || other.i < 0 || seen.has(other)) continue;
          seen.add(other);
          const dx =
              item.minX > other.maxX
                ? item.minX - other.maxX
                : other.minX > item.maxX
                  ? other.minX - item.maxX
                  : 0,
            dz =
              item.minZ > other.maxZ
                ? item.minZ - other.maxZ
                : other.minZ > item.maxZ
                  ? other.minZ - item.maxZ
                  : 0,
            dist = Math.hypot(dx, dz);
          if (dist < bestD) {
            bestD = dist;
            best = other;
          }
        }
      }
    return best;
  };
  const infill = [];
  const used = new Set();
  for (const item of boxes) item.neighbor = nearestNeighbor(item);
  const blockedAt = (x, z, nx, nz, d, ignore) => {
    const px = x + nx * d,
      pz = z + nz * d;
    if (onRoad(px, pz)) return "road";
    const occ = occupied(px, pz, ignore);
    if (occ) return occ;
    return null;
  };
  const probe = (x, z, nx, nz, ignore) => {
    const coarse = [1.2, 3.2, 6, 10, 16, 24, 34];
    let prev = PROBE_STEP,
      limit = null;
    for (const d of coarse) {
      if (blockedAt(x, z, nx, nz, d, ignore)) {
        limit = d;
        break;
      }
      prev = d;
    }
    if (limit == null) return { roadAt: Infinity, buildingAt: Infinity, hit: null };
    let roadAt = Infinity,
      buildingAt = Infinity,
      hit = null;
    for (let d = prev; d <= limit + 0.01; d += PROBE_STEP) {
      const block = blockedAt(x, z, nx, nz, d, ignore);
      if (block === "road") {
        roadAt = d;
        break;
      }
      if (block && block !== "road") {
        buildingAt = d;
        hit = block;
        break;
      }
    }
    return { roadAt, buildingAt, hit };
  };
  const commit = (footprint, height) => {
    let sx = 0,
      sz = 0;
    for (const p of footprint) {
      sx += p[0];
      sz += p[1];
    }
    const key = `${Math.round(sx / footprint.length / 3)}:${Math.round(sz / footprint.length / 3)}`;
    if (used.has(key)) return false;
    const samples = footprint.slice();
    samples.push([sx / footprint.length, sz / footprint.length]);
    for (let i = 0; i < footprint.length; i++) {
      const a = footprint[i],
        b = footprint[(i + 1) % footprint.length];
      samples.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    }
    if (samples.some(([x, z]) => onRoad(x, z) || occupied(x, z, null))) return false;
    const extra = {
      points: footprint,
      height,
      floors: Math.max(1, Math.round(height / STOREY_METERS)),
      heightSource: "infill",
      kind: "yes",
      color: ((infill.length * 17) % 100) / 100,
      infill: true,
    };
    const bounds = footprintBounds(footprint);
    coverGrid(grid, cell, bounds, {
      ...bounds,
      building: extra,
      i: -1 - infill.length,
    });
    used.add(key);
    infill.push(extra);
    return true;
  };
  const placeRows = (ax, az, dx, dz, len, nx, nz, span, buildable, height) => {
    let inner = INFILL_GAP,
      rows = 0,
      placed = 0;
    while (rows < INFILL_MAX_ROWS && buildable - inner >= INFILL_MIN_DEPTH) {
      const depth = Math.min(INFILL_ROW_DEPTH, buildable - inner);
      const hx = (dx / len) * (span / 2),
        hz = (dz / len) * (span / 2),
        px = nx * (depth / 2),
        pz = nz * (depth / 2),
        cx = ax + nx * (inner + depth / 2),
        cz = az + nz * (inner + depth / 2);
      const footprint = [
        [cx - hx - px, cz - hz - pz],
        [cx + hx - px, cz + hz - pz],
        [cx + hx + px, cz + hz + pz],
        [cx - hx + px, cz - hz + pz],
      ];
      if (commit(footprint, height)) placed++;
      else if (span > INFILL_MIN_ALONG + 1) {
        const shorter = Math.max(INFILL_MIN_ALONG, span * 0.55);
        if (shorter < span - 0.4)
          placed += placeRows(ax, az, dx, dz, len, nx, nz, shorter, buildable, height)
            ? 1
            : 0;
        break;
      } else break;
      inner += depth + INFILL_GAP;
      rows++;
    }
    return placed;
  };
  for (const item of boxes) {
    const neighbor = item.neighbor;
    if (!neighbor) continue;
    const points = item.building.points;
    const closed =
      points.length > 3 &&
      Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) <
        0.05;
    const n = closed ? points.length - 1 : points.length;
    for (let i = 0; i < n; i++) {
      const p0 = points[i],
        p1 = points[(i + 1) % n];
      const dx = p1[0] - p0[0],
        dz = p1[1] - p0[1],
        len = Math.hypot(dx, dz);
      if (len < INFILL_MIN_ALONG) continue;
      let nx = -dz / len,
        nz = dx / len;
      const mx = (p0[0] + p1[0]) / 2,
        mz = (p0[1] + p1[1]) / 2;
      if (inside(mx + nx * 0.6, mz + nz * 0.6, points)) {
        nx = -nx;
        nz = -nz;
      }
      let cursor = 0.55;
      while (cursor + INFILL_MIN_ALONG <= len - 0.4) {
        const span = Math.min(INFILL_MAX_ALONG, len - 0.4 - cursor);
        const u = cursor + span / 2,
          ax = p0[0] + (dx / len) * u,
          az = p0[1] + (dz / len) * u;
        const seen = probe(ax, az, nx, nz, item);
        let buildable;
        let other = neighbor.building;
        if (seen.buildingAt < seen.roadAt) {
          other = seen.hit?.building || other;
          buildable = seen.buildingAt - PROBE_STEP - INFILL_GAP;
        } else if (Number.isFinite(seen.roadAt)) {
          buildable = seen.roadAt - PROBE_STEP;
        } else {
          buildable = INFILL_GAP + INFILL_MAX_ROWS * (INFILL_ROW_DEPTH + INFILL_GAP);
        }
        if (buildable - INFILL_GAP >= INFILL_MIN_DEPTH) {
          const height = Math.min(
            36,
            Math.max(3, ((item.building.height || 9) + (other.height || 9)) / 2),
          );
          placeRows(ax, az, dx, dz, len, nx, nz, span, buildable, height);
        }
        cursor += span + INFILL_GAP;
      }
    }
  }
  return infill;
}

export function makeCar(color = 0xeee6cc, rickshaw = false) {
  const g = new THREE.Group();
  const box = (w, h, d, c, x, y, z) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.45,
        metalness: 0.25,
      }),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  box(1.85, 0.6, 3.8, color, 0, 0.7, 0);
  box(1.6, 0.65, 1.9, rickshaw ? 0xf6c455 : color, 0, 1.3, 0.1);
  box(1.47, 0.45, 0.03, 0x244449, 0, 1.35, -0.87);
  box(1.47, 0.45, 0.03, 0x244449, 0, 1.35, 1.07);
  box(0.03, 0.42, 1.65, 0x244449, -0.81, 1.35, 0.1);
  box(0.03, 0.42, 1.65, 0x244449, 0.81, 1.35, 0.1);
  box(1.8, 0.16, 0.13, 0x454744, 0, 0.5, -1.95);
  for (const x of [-0.62, 0.62]) {
    box(0.4, 0.2, 0.05, 0xffecc3, x, 0.8, -1.93);
    box(0.35, 0.18, 0.05, 0xb03828, x, 0.8, 1.93);
  }
  for (const x of [-0.92, 0.92])
    for (const z of [-1.15, 1.15]) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 0.22, 12),
        new THREE.MeshStandardMaterial({ color: 0x202b2b }),
      );
      m.rotation.z = Math.PI / 2;
      m.position.set(x, 0.4, z);
      g.add(m);
    }
  return g;
}
export {
  stepGait,
  person,
  residentProfile,
  RESIDENTS,
  orbitLook,
  footLookActive,
  footPace,
  beginJump,
  WALK_SPEED,
  RUN_SPEED,
  JUMP_SPEED,
} from "./people.js";
export {
  mulberry32,
  nodeKey,
  splitRoadsAtJunctions,
  roadAdjacency,
  planTrip,
  segmentPoint,
  tripPolyline,
  advanceAlong,
  chooseGoal,
  laneLateral,
  sidewalkLateral,
} from "./routes.js";
export {
  STREET_FLEET,
  CAR_BODIES,
  BIKE_BODIES,
  BODY_LABELS,
  VEHICLE_TONES,
  fleetBody,
  distanceGain,
  makeVehicle,
  makeMotorcycle,
} from "./vehicles.js";

