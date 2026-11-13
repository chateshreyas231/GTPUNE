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
  return {
    source: "illustrative",
    roads,
    buildings,
    spawn: [-5, 70],
    stops: [
      { name: "FC ROAD", point: [-5, -450] },
      { name: "KOTHRUD", point: [-600, 300] },
      { name: "DECCAN GYMKHANA", point: [-5, 70] },
    ],
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
  return {
    source: "OpenStreetMap",
    roads,
    buildings,
    spawn,
    stops: [
      { name: "FC ROAD", point: nearest(project(18.5235, 73.8412)) },
      { name: "KOTHRUD", point: nearest(project(18.5074, 73.8077)) },
      { name: "DECCAN GYMKHANA", point: spawn },
    ],
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
export function person(index) {
  const g = new THREE.Group(),
    skin = [0x8a553b, 0xb67b50, 0x754b38, 0xcc996b][index % 4],
    shirt = [0xe9ac52, 0x8aaea6, 0xb66c65, 0xeff0d7, 0x816c9a][index % 5];
  const mat = (c) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const add = (geo, c, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  add(new THREE.SphereGeometry(0.19, 16, 12), skin, 0, 1.65, 0).scale.set(
    0.86,
    1.12,
    0.9,
  );
  add(
    new THREE.SphereGeometry(0.195, 12, 8),
    0x242322,
    0,
    1.76,
    0.015,
  ).scale.set(0.92, 0.55, 0.97);
  add(new THREE.CylinderGeometry(0.085, 0.09, 0.12, 8), skin, 0, 1.43, 0);
  add(
    new THREE.CylinderGeometry(0.23, 0.19, 0.58, 12),
    shirt,
    0,
    1.1,
    0,
  ).scale.z = 0.65;
  for (const x of [-0.065, 0.065]) {
    add(new THREE.SphereGeometry(0.025, 8, 6), 0xe6dac8, x, 1.68, -0.16);
    add(new THREE.SphereGeometry(0.012, 6, 6), 0x242424, x, 1.68, -0.181);
  }
  add(new THREE.SphereGeometry(0.035, 8, 6), skin, 0, 1.61, -0.18);
  const legs = [],
    arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, 0.83, 0);
    g.add(leg);
    legs.push(leg);
    add(new THREE.CapsuleGeometry(0.09, 0.48, 4, 8), 0x344848, 0, -0.3, 0, leg);
    add(new THREE.BoxGeometry(0.17, 0.13, 0.3), 0x262823, 0, -0.7, -0.05, leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.25, 1.34, 0);
    g.add(arm);
    arms.push(arm);
    add(new THREE.CapsuleGeometry(0.065, 0.4, 4, 8), skin, 0, -0.25, 0, arm);
    add(new THREE.SphereGeometry(0.075, 8, 6), skin, 0, -0.53, 0, arm);
  }
  g.userData.walk = (time, amount = 1) => {
    legs.forEach(
      (p, i) =>
        (p.rotation.x = Math.sin(time * 6 + i * Math.PI) * 0.45 * amount),
    );
    arms.forEach(
      (p, i) =>
        (p.rotation.x = -Math.sin(time * 6 + i * Math.PI) * 0.35 * amount),
    );
  };
  return g;
}
