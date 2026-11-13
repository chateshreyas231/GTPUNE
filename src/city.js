import * as THREE from "three";
export const origin = { lat: 18.5167, lon: 73.841 };
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
      width: n === 0 ? 24 : 16,
    });
    roads.push({
      points: [
        [n, -850],
        [n, 850],
      ],
      width: n === 0 ? 24 : 16,
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

export function roadWidthFromTags(tags = {}) {
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

// Original blocks in the holes between surveyed footprints. Each one keeps a
// narrow gap from its neighbours and stays off the carriageway.
export function fillBuildingGaps(buildings, roads) {
  const cell = 28;
  const gap = 0.85;
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
    const half = Math.max(1.6, (road.width || 7) / 2);
    const pts = road.points || [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i];
      const seg = {
        a,
        b,
        half,
        minX: Math.min(a[0], b[0]) - half,
        maxX: Math.max(a[0], b[0]) + half,
        minZ: Math.min(a[1], b[1]) - half,
        maxZ: Math.max(a[1], b[1]) + half,
      };
      coverGrid(roadGrid, cell, seg, seg);
    }
  }
  const onRoad = (x, z) => {
    for (const seg of gridNear(roadGrid, cell, x, z)) {
      if (x < seg.minX || x > seg.maxX || z < seg.minZ || z > seg.maxZ) continue;
      if (segmentDistance(x, z, seg.a, seg.b) < seg.half) return true;
    }
    return false;
  };
  const occupied = (x, z, ignore) => {
    for (const item of gridNear(grid, cell, x, z)) {
      if (item === ignore) continue;
      if (x < item.minX || x > item.maxX || z < item.minZ || z > item.maxZ) continue;
      if (inside(x, z, item.building.points)) return item;
    }
    return null;
  };
  const infill = [];
  const used = new Set();
  const made = new Map();
  for (const item of boxes) {
    if ((made.get(item.i) || 0) >= 2) continue;
    const points = item.building.points;
    const closed =
      points.length > 3 &&
      Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < 0.05;
    const n = closed ? points.length - 1 : points.length;
    for (let i = 0; i < n && (made.get(item.i) || 0) < 2; i++) {
      const p0 = points[i],
        p1 = points[(i + 1) % n];
      const dx = p1[0] - p0[0],
        dz = p1[1] - p0[1],
        len = Math.hypot(dx, dz);
      if (len < 4.5 || len > 80) continue;
      const mx = (p0[0] + p1[0]) / 2,
        mz = (p0[1] + p1[1]) / 2;
      let nx = -dz / len,
        nz = dx / len;
      if (inside(mx + nx * 0.6, mz + nz * 0.6, points)) {
        nx = -nx;
        nz = -nz;
      }
      if (onRoad(mx + nx * 1.4, mz + nz * 1.4)) continue;
      let clear = 1.1;
      let neighbor = null;
      for (const d of [3.2, 6, 9, 12, 15]) {
        const x = mx + nx * d,
          z = mz + nz * d;
        if (onRoad(x, z)) break;
        const hit = occupied(x, z, item);
        if (hit) {
          neighbor = hit;
          break;
        }
        clear = d;
      }
      if (!neighbor || clear < 3.4 || clear > 14) continue;
      const outer = clear - 0.45;
      const inner = gap;
      if (outer - inner < 2.3) continue;
      const depth = outer - inner;
      const along = Math.min(len - 1.4, 11);
      if (along < 3.6) continue;
      const cx = mx + nx * (inner + depth / 2);
      const cz = mz + nz * (inner + depth / 2);
      const key = `${Math.round(cx / 4)}:${Math.round(cz / 4)}`;
      if (used.has(key)) continue;
      const hx = (dx / len) * (along / 2),
        hz = (dz / len) * (along / 2),
        px = nx * (depth / 2),
        pz = nz * (depth / 2);
      const footprint = [
        [cx - hx - px, cz - hz - pz],
        [cx + hx - px, cz + hz - pz],
        [cx + hx + px, cz + hz + pz],
        [cx - hx + px, cz - hz + pz],
      ];
      if (footprint.some(([x, z]) => onRoad(x, z) || occupied(x, z, null))) continue;
      if (onRoad(cx, cz) || occupied(cx, cz, null)) continue;
      const height = Math.min(
        36,
        Math.max(
          3,
          ((item.building.height || 9) + (neighbor.building.height || 9)) / 2,
        ),
      );
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
      const stored = { ...bounds, building: extra, i: -1 - infill.length };
      coverGrid(grid, cell, bounds, stored);
      used.add(key);
      made.set(item.i, (made.get(item.i) || 0) + 1);
      infill.push(extra);
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

