import * as THREE from "three";
export const origin = { lat: 18.5167, lon: 73.841 };
export function project(lat, lon) {
  return [(lon - origin.lon) * 105500, -(lat - origin.lat) * 111320];
}
export function hashBuildingId(id) {
  let hash = 2166136261;
  const text = String(id ?? "");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
const LOW_BUILDINGS = new Set([
  "house",
  "hut",
  "shed",
  "garage",
  "roof",
  "gazebo",
  "guardhouse",
  "bungalow",
  "detached",
  "retail",
  "kiosk",
  "service",
  "cabin",
]);
const TALL_BUILDINGS = new Set([
  "apartments",
  "residential",
  "commercial",
  "office",
  "hotel",
  "dormitory",
  "flats",
  "hospital",
  "college",
  "university",
  "public",
  "train_station",
]);
function clampMeters(meters) {
  return Math.min(120, Math.max(3, Math.round(meters * 10) / 10));
}
function storiesFor(id, kind = "yes") {
  const hash = hashBuildingId(id);
  const roll = hash % 100;
  if (LOW_BUILDINGS.has(kind)) {
    const base = 1 + (hash % 4);
    return roll < 10 ? Math.min(6, base + 2) : base;
  }
  if (TALL_BUILDINGS.has(kind)) {
    if (roll < 20) return 8 + (hash % 9);
    return 2 + (hash % 5);
  }
  if (roll < 8) return 7 + (hash % 8);
  return 1 + (hash % 6);
}
export function buildingHeight(id, tags = {}) {
  const tagged = parseFloat(tags.height);
  if (Number.isFinite(tagged) && tagged > 0) return clampMeters(tagged);
  const levels = Number(tags["building:levels"]);
  if (Number.isFinite(levels) && levels > 0) return clampMeters(levels * 3);
  return clampMeters(storiesFor(id, tags.building) * 3);
}
const MASS_KINDS = ["setback", "shop", "awning", "balcony"];
export function buildingMass(id) {
  return MASS_KINDS[hashBuildingId(id) % MASS_KINDS.length];
}
export function openRing(points) {
  if (!points?.length) return [];
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 1 && first[0] === last[0] && first[1] === last[1])
    return points.slice(0, -1);
  return points.slice();
}
export function signedArea(points) {
  const ring = openRing(points);
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  return area / 2;
}
export function offsetPolygon(points, distance) {
  const ring = openRing(points);
  const count = ring.length;
  if (count < 3 || !distance) return ring.map((p) => [p[0], p[1]]);
  const inward = signedArea(ring) >= 0 ? 1 : -1;
  const dist = distance * inward;
  const out = [];
  for (let i = 0; i < count; i++) {
    const prev = ring[(i + count - 1) % count];
    const cur = ring[i];
    const next = ring[(i + 1) % count];
    let e1x = cur[0] - prev[0];
    let e1z = cur[1] - prev[1];
    let e2x = next[0] - cur[0];
    let e2z = next[1] - cur[1];
    const len1 = Math.hypot(e1x, e1z) || 1;
    const len2 = Math.hypot(e2x, e2z) || 1;
    e1x /= len1;
    e1z /= len1;
    e2x /= len2;
    e2z /= len2;
    const n1x = -e1z;
    const n1z = e1x;
    const n2x = -e2z;
    const n2z = e2x;
    let bx = n1x + n2x;
    let bz = n1z + n2z;
    const bl = Math.hypot(bx, bz) || 1;
    bx /= bl;
    bz /= bl;
    const cos = n1x * bx + n1z * bz;
    const denom = Math.abs(cos) < 0.25 ? Math.sign(cos || 1) * 0.25 : cos;
    let miter = dist / denom;
    const cap = Math.abs(distance) * 3;
    if (Math.abs(miter) > cap) miter = Math.sign(miter) * cap;
    out.push([cur[0] + bx * miter, cur[1] + bz * miter]);
  }
  return out;
}
export function insetFootprint(points, distance) {
  const ring = openRing(points);
  const next = offsetPolygon(ring, distance);
  const before = signedArea(ring);
  const after = signedArea(next);
  if (before * after <= 0) return null;
  if (Math.abs(after) < Math.abs(before) * 0.28) return null;
  return next;
}
function centroid(points) {
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p[0];
    z += p[1];
  }
  return [x / points.length, z / points.length];
}
function edgeRecord(a, b, cx, cz) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz) || 1;
  const ex = dx / length;
  const ez = dz / length;
  let nx = -ez;
  let nz = ex;
  const mx = (a[0] + b[0]) / 2;
  const mz = (a[1] + b[1]) / 2;
  if ((mx - cx) * nx + (mz - cz) * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  const facesOut = nx * -ez + nz * ex >= 0;
  const fx = facesOut ? ex : -ex;
  const fz = facesOut ? ez : -ez;
  return { length, mx, mz, nx, nz, angle: Math.atan2(-fz, fx) };
}
export function buildingEdges(points) {
  const ring = openRing(points);
  if (ring.length < 2) return [];
  const [cx, cz] = centroid(ring);
  const edges = [];
  for (let i = 0; i < ring.length; i++) {
    const edge = edgeRecord(ring[i], ring[(i + 1) % ring.length], cx, cz);
    if (edge.length >= 0.4) edges.push(edge);
  }
  return edges;
}
function footprintSpan(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[1]);
    maxZ = Math.max(maxZ, p[1]);
  }
  return { width: maxX - minX, depth: maxZ - minZ };
}
function edgePiece(edge, width, height, depth, y, kind, tint, outset = 0) {
  const span = Math.max(0.4, Math.min(width, edge.length * 0.92));
  const push = depth / 2 + 0.05 + outset;
  return {
    kind,
    width: span,
    height,
    depth,
    tint,
    x: edge.mx + edge.nx * push,
    y,
    z: edge.mz + edge.nz * push,
    angle: edge.angle,
  };
}
function balconyLevel(id, height) {
  const stories = Math.max(1, Math.round(height / 3));
  if (stories < 2) return Math.max(1.7, height * 0.55);
  const level = 1 + (hashBuildingId(id) % (stories - 1));
  return Math.min(height - 0.7, level * 3);
}
export function massPieces(building) {
  const points = openRing(building.points);
  const height = building.height;
  const id = building.id ?? 0;
  const mass = building.mass || buildingMass(id);
  const tint = hashBuildingId(id) % 5;
  const pieces = [{ kind: "footprint", points, height, y: 0, tint }];
  if (points.length < 3 || !(height > 0)) return pieces;
  if (mass === "setback") {
    const ground = Math.min(3.2, Math.max(1.15, height * 0.36));
    const span = footprintSpan(points);
    const reach = Math.min(span.width, span.depth);
    const inset =
      Math.min(0.9, Math.max(0.28, reach * 0.14)) +
      (hashBuildingId(id) % 3) * 0.08;
    const upper =
      insetFootprint(points, inset) || insetFootprint(points, inset * 0.5);
    if (upper && height - ground > 0.7) {
      pieces[0] = { kind: "footprint", points, height: ground, y: 0, tint };
      pieces.push({
        kind: "setback",
        points: upper,
        height: height - ground,
        y: ground,
        tint,
      });
    }
    return pieces;
  }
  const edges = buildingEdges(points);
  if (!edges.length) return pieces;
  if (mass === "shop") {
    for (const face of edges
      .filter((edge) => edge.length >= 2)
      .sort((a, b) => b.length - a.length)
      .slice(0, 4))
      pieces.push(
        edgePiece(face, face.length * 0.92, 1.05, 0.16, 1.45, "shop", tint),
      );
    return pieces;
  }
  const long = edges.filter((edge) => edge.length >= 2.5);
  const edge = (long.length ? long : edges)[
    hashBuildingId(id) % (long.length || edges.length)
  ];
  if (mass === "awning") {
    const depth = 0.85 + (hashBuildingId(id) % 4) * 0.12;
    const y = Math.min(3.15, Math.max(2.4, height - 0.35));
    pieces.push(
      edgePiece(edge, edge.length * 0.88, 0.08, depth, y, "awning", tint),
    );
    return pieces;
  }
  const depth = 0.72 + (hashBuildingId(id) % 3) * 0.12;
  const y = balconyLevel(id, height);
  const width = Math.min(edge.length * 0.62, 7.5);
  pieces.push(edgePiece(edge, width, 0.12, depth, y, "balcony", tint));
  pieces.push(
    edgePiece(edge, width, 0.08, 0.08, y + 0.42, "rail", tint, depth - 0.12),
  );
  return pieces;
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
        rnd();
        const id = `ill-${x}-${z}-${j}`;
        buildings.push({
          id,
          points: [
            [bx - w / 2, bz - d / 2],
            [bx + w / 2, bz - d / 2],
            [bx + w / 2, bz + d / 2],
            [bx - w / 2, bz + d / 2],
          ],
          height: buildingHeight(id, { building: "house" }),
          mass: buildingMass(id),
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
    )
      roads.push({
        points,
        width: ["primary", "trunk"].includes(e.tags.highway) ? 20 : 12,
        name: e.tags.name,
      });
    if (e.tags.building && points.length >= 4) {
      const id =
        e.id ?? `${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
      buildings.push({
        id,
        points,
        height: buildingHeight(id, e.tags),
        mass: buildingMass(id),
        color: (hashBuildingId(id) % 1000) / 1000,
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
