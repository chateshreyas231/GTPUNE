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
    if (e.tags.building && points.length >= 4)
      buildings.push({
        points,
        height: Math.min(
          120,
          Math.max(
            3,
            parseFloat(e.tags.height) ||
              Number(e.tags["building:levels"]) * 3 ||
              12,
          ),
        ),
        color: (e.id % 100) / 100,
      });
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
export const STREET_FLEET = { cars: 8, motorcycles: 36 };
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function nodeKey(point) {
  return `${point[0].toFixed(1)},${point[1].toFixed(1)}`;
}
function snap(n) {
  return Math.round(n * 10) / 10;
}
function withLength(segment) {
  const a = [snap(segment.a[0]), snap(segment.a[1])];
  const b = [snap(segment.b[0]), snap(segment.b[1])];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    ...segment,
    a,
    b,
    length,
    angle: Math.atan2(b[0] - a[0], b[1] - a[1]),
  };
}
function lerpPoint(a, b, t) {
  return [snap(a[0] + (b[0] - a[0]) * t), snap(a[1] + (b[1] - a[1]) * t)];
}
function paramOn(point, segment) {
  const dx = segment.b[0] - segment.a[0],
    dz = segment.b[1] - segment.a[1],
    len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return null;
  const t = ((point[0] - segment.a[0]) * dx + (point[1] - segment.a[1]) * dz) / len2;
  if (t < -0.002 || t > 1.002) return null;
  const x = segment.a[0] + dx * t,
    z = segment.a[1] + dz * t;
  if (Math.hypot(x - point[0], z - point[1]) > 1.25) return null;
  return Math.min(1, Math.max(0, t));
}
function segmentCrossing(p, q) {
  const rx = p.b[0] - p.a[0],
    rz = p.b[1] - p.a[1],
    sx = q.b[0] - q.a[0],
    sz = q.b[1] - q.a[1],
    denom = rx * sz - rz * sx,
    qpx = q.a[0] - p.a[0],
    qpz = q.a[1] - p.a[1];
  if (Math.abs(denom) > 1e-6) {
    const t = (qpx * sz - qpz * sx) / denom,
      u = (qpx * rz - qpz * rx) / denom;
    if (t >= -1e-4 && t <= 1 + 1e-4 && u >= -1e-4 && u <= 1 + 1e-4)
      return {
        t: Math.min(1, Math.max(0, t)),
        u: Math.min(1, Math.max(0, u)),
      };
    return null;
  }
  const hits = [
    [paramOn(q.a, p), 0],
    [paramOn(q.b, p), 1],
    [0, paramOn(p.a, q)],
    [1, paramOn(p.b, q)],
  ];
  for (const [t, u] of hits) if (t != null && u != null) return { t, u };
  return null;
}
// Break every crossing and T-junction so traffic can leave on another road.
export function splitRoadsAtJunctions(segments) {
  const prepared = segments.map(withLength).filter((s) => s.length >= 0.5);
  const cuts = prepared.map(() => [0, 1]);
  const cell = 90;
  const buckets = new Map();
  prepared.forEach((seg, index) => {
    const minX = Math.min(seg.a[0], seg.b[0]),
      maxX = Math.max(seg.a[0], seg.b[0]),
      minZ = Math.min(seg.a[1], seg.b[1]),
      maxZ = Math.max(seg.a[1], seg.b[1]);
    for (let x = Math.floor(minX / cell); x <= Math.floor(maxX / cell); x++)
      for (let z = Math.floor(minZ / cell); z <= Math.floor(maxZ / cell); z++) {
        const key = `${x},${z}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(index);
      }
  });
  const seen = new Set();
  for (const ids of buckets.values())
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i],
          b = ids[j],
          key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const hit = segmentCrossing(prepared[a], prepared[b]);
        if (!hit) continue;
        if (hit.t > 0.004 && hit.t < 0.996) cuts[a].push(hit.t);
        if (hit.u > 0.004 && hit.u < 0.996) cuts[b].push(hit.u);
      }
  const out = [];
  prepared.forEach((seg, index) => {
    const ts = [...new Set(cuts[index].map((t) => Math.round(t * 1000) / 1000))].sort(
      (a, b) => a - b,
    );
    for (let k = 1; k < ts.length; k++) {
      const pa = lerpPoint(seg.a, seg.b, ts[k - 1]),
        pb = lerpPoint(seg.a, seg.b, ts[k]),
        length = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (length < 0.8) continue;
      out.push({
        ...seg,
        a: pa,
        b: pb,
        length,
        angle: Math.atan2(pb[0] - pa[0], pb[1] - pa[1]),
      });
    }
  });
  return out;
}
export function roadAdjacency(segments) {
  const map = new Map();
  for (const segment of segments)
    for (const end of [segment.a, segment.b]) {
      const key = nodeKey(end);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(segment);
    }
  return map;
}
function exitsAt(adjacency, node, previous, recent) {
  const mapped = (adjacency.get(node) || [])
    .map((segment) => {
      const direction = nodeKey(segment.a) === node ? 1 : -1;
      return {
        segment,
        direction,
        fromT: direction === 1 ? 0 : 1,
        nextNode: nodeKey(direction === 1 ? segment.b : segment.a),
        len: segment.length,
      };
    })
    .filter((choice) => choice.len > 0.4);
  const forward = mapped.filter((choice) => choice.segment !== previous);
  const pool = forward.length ? forward : mapped;
  const fresh = pool.filter((choice) => !recent.includes(choice.segment));
  return fresh.length ? fresh : pool;
}
function chooseExit(exits, goal, rng) {
  if (!goal) return exits[Math.floor(rng() * exits.length) % exits.length];
  const scored = exits
    .map((exit) => {
      const end = exit.direction === 1 ? exit.segment.b : exit.segment.a;
      return {
        ...exit,
        dist: Math.hypot(end[0] - goal[0], end[1] - goal[1]),
      };
    })
    .sort((a, b) => a.dist - b.dist || a.len - b.len);
  const best = scored[0].dist;
  const near = scored.filter((exit) => exit.dist <= best + 8);
  return near[Math.floor(rng() * near.length) % near.length];
}
// A directed trip along the road graph. The first exit at a junction is never
// the segment just used while another exit exists, so traffic does not shuttle.
export function planTrip({
  adjacency,
  fromSegment,
  fromT = 0,
  direction = 1,
  atNode = null,
  goal = null,
  minLength = 36,
  rng = Math.random,
  maxSteps = 12,
}) {
  const steps = [];
  let length = 0;
  const recent = [];
  let node = atNode;
  if (!atNode) {
    const dir = direction >= 0 ? 1 : -1;
    const t = Math.min(1, Math.max(0, fromT));
    const endT = dir === 1 ? 1 : 0;
    const stepLen = Math.abs(endT - t) * fromSegment.length;
    if (stepLen >= 0.4) {
      steps.push({ segment: fromSegment, direction: dir, fromT: t });
      length += stepLen;
      recent.push(fromSegment);
    }
    node = nodeKey(dir === 1 ? fromSegment.b : fromSegment.a);
  }
  let previous = steps.length ? steps[steps.length - 1].segment : fromSegment;
  while (length < minLength && steps.length < maxSteps) {
    const exits = exitsAt(adjacency, node, previous, recent);
    if (!exits.length) break;
    const pick = chooseExit(exits, goal, rng);
    steps.push({
      segment: pick.segment,
      direction: pick.direction,
      fromT: pick.fromT,
    });
    length += pick.len;
    recent.push(pick.segment);
    if (recent.length > 8) recent.shift();
    previous = pick.segment;
    node = pick.nextNode;
  }
  return { steps, length, endNode: node, endSegment: previous, goal };
}
export function segmentPoint(segment, t, lateral = 0) {
  const len = segment.length || Math.hypot(segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]);
  const dx = (segment.b[0] - segment.a[0]) / len,
    dz = (segment.b[1] - segment.a[1]) / len,
    x = segment.a[0] + (segment.b[0] - segment.a[0]) * t,
    z = segment.a[1] + (segment.b[1] - segment.a[1]) * t;
  return [x - dz * lateral, z + dx * lateral];
}
export function tripPolyline(trip, lateralForStep = () => 0) {
  const points = [];
  const push = (point) => {
    const last = points[points.length - 1];
    if (!last || Math.hypot(last[0] - point[0], last[1] - point[1]) > 0.3)
      points.push(point);
  };
  for (const step of trip.steps || []) {
    const lateral = lateralForStep(step) || 0;
    const endT = step.direction === 1 ? 1 : 0;
    push(segmentPoint(step.segment, step.fromT, lateral));
    push(segmentPoint(step.segment, endT, lateral));
  }
  return points;
}
export function advanceAlong(state, dt) {
  const points = state.points;
  if (!points || points.length < 2)
    return { ...state, arrived: true };
  let left = Math.max(0, state.speed || 0) * dt;
  let x = state.x,
    z = state.z,
    index = state.index || 0,
    yaw = state.yaw || 0;
  while (left > 0 && index < points.length - 1) {
    const next = points[index + 1];
    const dx = next[0] - x,
      dz = next[1] - z,
      dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      index += 1;
      x = next[0];
      z = next[1];
      continue;
    }
    yaw = Math.atan2(-dx, -dz);
    const step = Math.min(left, dist);
    x += (dx / dist) * step;
    z += (dz / dist) * step;
    left -= step;
    if (step >= dist - 1e-4) index += 1;
  }
  return {
    ...state,
    x,
    z,
    index,
    yaw,
    arrived: index >= points.length - 1,
  };
}
export function chooseGoal(segments, from, minDistance, rng = Math.random) {
  let farthest = null;
  const consider = (point) => {
    const dist = Math.hypot(point[0] - from[0], point[1] - from[1]);
    if (!farthest || dist > farthest.dist) farthest = { point, dist };
    return dist >= minDistance ? point : null;
  };
  const tries = Math.min(segments.length, 16);
  for (let i = 0; i < tries; i++) {
    const segment = segments[Math.floor(rng() * segments.length) % segments.length];
    const hit = consider(segmentPoint(segment, Math.min(0.85, 0.2 + (i % 5) * 0.15), 0));
    if (hit) return hit;
  }
  for (const segment of segments) {
    const hit = consider(segmentPoint(segment, 0.5, 0));
    if (hit) return hit;
  }
  return farthest ? farthest.point : [from[0], from[1]];
}
export function laneLateral(segment, kind, direction) {
  const width = segment.width || 8;
  const meters =
    kind === "motorcycle"
      ? Math.min(width * 0.34, 3.6)
      : Math.min(width * 0.18, 2.2);
  return (direction >= 0 ? 1 : -1) * meters;
}
export function sidewalkLateral(segment, side) {
  return (side >= 0 ? 1 : -1) * ((segment.width || 8) / 2 + 1.65);
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
// A commuter motorcycle: tank, engine, two wheels. Not a bicycle.
export function makeMotorcycle(color = 0xb4332a, riderSkin = 0xc4926a) {
  const g = new THREE.Group();
  g.userData.kind = "motorcycle";
  const mat = (c, rough = 0.45, metal = 0.35) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
  const add = (geo, material, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const wheel = (z) => {
    const hub = new THREE.Group();
    hub.position.set(0, 0.32, z);
    g.add(hub);
    const tire = add(
      new THREE.CylinderGeometry(0.32, 0.32, 0.13, 14),
      mat(0x1a1a1a, 0.92, 0.04),
      0,
      0,
      0,
      hub,
    );
    tire.rotation.z = Math.PI / 2;
    const rim = add(
      new THREE.CylinderGeometry(0.14, 0.14, 0.15, 10),
      mat(0x8d8d8d, 0.35, 0.65),
      0,
      0,
      0,
      hub,
    );
    rim.rotation.z = Math.PI / 2;
    return hub;
  };
  const front = wheel(-0.78);
  const rear = wheel(0.58);
  add(new THREE.BoxGeometry(0.1, 0.08, 1.2), mat(0x2a2a2a, 0.4, 0.55), 0, 0.46, -0.08);
  add(new THREE.BoxGeometry(0.26, 0.24, 0.32), mat(0x3c3c3c, 0.5, 0.45), 0, 0.4, 0.02);
  add(new THREE.BoxGeometry(0.28, 0.16, 0.42), mat(color, 0.32, 0.45), 0, 0.66, -0.18);
  add(new THREE.BoxGeometry(0.26, 0.08, 0.42), mat(0x2b2420, 0.9, 0), 0, 0.68, 0.28);
  add(new THREE.BoxGeometry(0.08, 0.36, 0.06), mat(0x5a5a5a, 0.4, 0.5), 0, 0.58, -0.7);
  add(new THREE.BoxGeometry(0.58, 0.04, 0.04), mat(0x222222, 0.4, 0.55), 0, 0.9, -0.52);
  const lamp = add(
    new THREE.CylinderGeometry(0.07, 0.08, 0.08, 10),
    mat(0xfff1c9, 0.25, 0.2),
    0,
    0.64,
    -0.86,
  );
  lamp.rotation.x = Math.PI / 2;
  const exhaust = add(
    new THREE.CylinderGeometry(0.035, 0.04, 0.5, 8),
    mat(0x9a9a9a, 0.3, 0.7),
    0.16,
    0.28,
    0.22,
  );
  exhaust.rotation.x = Math.PI / 2;
  const rider = new THREE.Group();
  rider.position.set(0, 0.74, 0.22);
  g.add(rider);
  add(new THREE.BoxGeometry(0.28, 0.22, 0.22), mat(0x243044, 0.8, 0), 0, 0.1, 0.02, rider);
  add(new THREE.BoxGeometry(0.32, 0.36, 0.2), mat(0x243044, 0.8, 0), 0, 0.38, -0.02, rider);
  add(new THREE.SphereGeometry(0.13, 12, 10), mat(riderSkin, 0.8, 0), 0, 0.66, -0.02, rider);
  add(new THREE.SphereGeometry(0.14, 10, 8), mat(0x241c18, 0.9, 0), 0, 0.74, 0.01, rider).scale.set(
    0.95,
    0.6,
    1,
  );
  add(new THREE.CapsuleGeometry(0.045, 0.22, 3, 6), mat(0x243044, 0.8, 0), -0.16, 0.34, -0.16, rider).rotation.x = 0.9;
  add(new THREE.CapsuleGeometry(0.045, 0.22, 3, 6), mat(0x243044, 0.8, 0), 0.16, 0.34, -0.16, rider).rotation.x = 0.9;
  add(new THREE.CapsuleGeometry(0.05, 0.28, 3, 6), mat(0x1e2430, 0.85, 0), -0.1, -0.08, 0.12, rider).rotation.x = 1.15;
  add(new THREE.CapsuleGeometry(0.05, 0.28, 3, 6), mat(0x1e2430, 0.85, 0), 0.1, -0.08, 0.12, rider).rotation.x = 1.15;
  g.userData.wheels = [front, rear];
  return g;
}
// A full stride cycle. A walk is about 1 Hz, near 110 steps a minute.
// A run lengthens the stride and lifts the knees. Nearly stopped is idle.
export function gaitCycle(time, speed) {
  const v = Math.abs(Number(speed) || 0);
  const run = THREE.MathUtils.clamp((v - 2.3) / 2.4, 0, 1);
  const amount = v <= 0.18 ? 0 : THREE.MathUtils.clamp((v - 0.18) / 0.65, 0, 1);
  const freq = 0.98 + run * 0.62;
  const phase = time * freq * Math.PI * 2;
  return {
    phase,
    amount,
    run,
    idle: amount === 0,
    stride: amount * (0.45 + run * 0.4),
    knee: amount * (0.55 + run * 0.7),
    arm: amount * (0.42 + run * 0.28),
    bob: amount * (0.045 + run * 0.04),
    lean: run * 0.28 * (amount > 0 ? 1 : 0),
    breath: Math.sin(time * 1.8) * (amount > 0.2 ? 0.012 : 0.04),
  };
}
// Short chamber, then the arm extends, then it returns. No contact gore.
export function punchEnvelope(strike) {
  if (!strike) return 0;
  const t = 1 - Math.min(1, Math.max(0, strike));
  if (t < 0.18) return -0.4 * (t / 0.18);
  return Math.sin(((t - 0.18) / 0.82) * Math.PI);
}
const RESIDENTS = [
  { kind: "student", gender: "man", garment: "shirt", height: 1.76, skin: 0xc4926a, hair: 0x2b2420, top: 0xf4f6f8, bottom: 0x3d4d68 },
  { kind: "student", gender: "woman", garment: "kurta", height: 1.6, skin: 0xd4a87c, hair: 0x241c18, top: 0xc4493a, bottom: 0xf3eadc },
  { kind: "student", gender: "woman", garment: "shirt", height: 1.64, skin: 0xe2b890, hair: 0x1c1614, top: 0x3d6b8c, bottom: 0x2c3344 },
  { kind: "shop", gender: "man", garment: "shirt", height: 1.7, skin: 0xb88962, hair: 0x3a3028, top: 0xf7f3ea, bottom: 0x4a4038 },
  { kind: "shop", gender: "woman", garment: "saree", height: 1.56, skin: 0xc9a07a, hair: 0x2a201c, top: 0x8d2f3a, bottom: 0xd4a24a },
  { kind: "shop", gender: "man", garment: "kurta", height: 1.68, skin: 0xd8b08a, hair: 0x2c241e, top: 0xf4efe4, bottom: 0xe8e2d4 },
  { kind: "older", gender: "man", garment: "kurta", height: 1.64, skin: 0xc49a72, hair: 0x8e8b86, top: 0xe8e2d0, bottom: 0xf0eadc },
  { kind: "older", gender: "woman", garment: "saree", height: 1.52, skin: 0xe8c4a2, hair: 0x9a9690, top: 0x7a3048, bottom: 0xc9b48a },
  { kind: "older", gender: "man", garment: "shirt", height: 1.66, skin: 0xd0a67e, hair: 0xa39e96, top: 0xe7eef3, bottom: 0x3e4650 },
  { kind: "resident", gender: "man", garment: "shirt", height: 1.82, skin: 0xb68458, hair: 0x241c18, top: 0x6e8f86, bottom: 0x2a3038 },
  { kind: "resident", gender: "woman", garment: "saree", height: 1.58, skin: 0xe0bc96, hair: 0x1a1412, top: 0x2f5e4c, bottom: 0xe6d7a8 },
  { kind: "resident", gender: "woman", garment: "kurta", height: 1.61, skin: 0xc89870, hair: 0x322820, top: 0xf7f4ec, bottom: 0xddd6c8 },
];
export function residentProfile(index) {
  return RESIDENTS[Math.abs(index) % RESIDENTS.length];
}
// Procedural adults. Clothing, height and wheatish-to-fair skin vary by role.
export function person(index) {
  const role = { ...residentProfile(index) };
  const g = new THREE.Group();
  const woman = role.gender === "woman";
  const shoulder = woman ? 0.25 : 0.28;
  const restLean = role.kind === "older" ? -0.12 : 0;
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const add = (geo, c, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const rig = new THREE.Group();
  g.add(rig);
  const chest = new THREE.Group();
  const chestBase = 0.98;
  chest.position.y = chestBase;
  chest.rotation.x = restLean;
  rig.add(chest);
  add(new THREE.SphereGeometry(0.19, 16, 12), role.skin, 0, 0.67, 0, chest).scale.set(
    0.86,
    1.12,
    0.9,
  );
  add(new THREE.SphereGeometry(0.195, 12, 8), role.hair, 0, 0.78, 0.02, chest).scale.set(
    woman ? 0.98 : 0.92,
    role.kind === "older" ? 0.5 : 0.55,
    0.98,
  );
  if (woman && role.kind === "older")
    add(new THREE.SphereGeometry(0.09, 10, 8), role.hair, 0, 0.7, 0.12, chest);
  else if (woman)
    add(new THREE.CapsuleGeometry(0.07, 0.28, 3, 6), role.hair, 0, 0.42, 0.12, chest);
  add(new THREE.CylinderGeometry(0.085, 0.09, 0.12, 8), role.skin, 0, 0.45, 0, chest);
  if (role.garment === "saree") {
    const blouse = add(
      new THREE.CylinderGeometry(0.2, 0.18, 0.3, 12),
      role.top,
      0,
      0.28,
      0,
      chest,
    );
    blouse.scale.set(woman ? 0.9 : 1, 1, 0.68);
    const skirt = add(
      new THREE.CylinderGeometry(0.2, 0.34, 0.74, 14),
      role.bottom,
      0,
      0.5,
      0,
      rig,
    );
    skirt.scale.z = 0.78;
    const pallu = add(
      new THREE.BoxGeometry(0.16, 0.72, 0.035),
      role.top,
      -shoulder * 0.35,
      0.92,
      -0.06,
      rig,
    );
    pallu.rotation.z = -0.42;
    pallu.rotation.x = 0.2;
  } else if (role.garment === "kurta") {
    const tunic = add(
      new THREE.CylinderGeometry(0.24, 0.26, 0.78, 12),
      role.top,
      0,
      0.7,
      0,
      rig,
    );
    tunic.scale.set(woman ? 0.9 : 1, 1, 0.62);
  } else {
    const torso = add(
      new THREE.CylinderGeometry(0.23, 0.19, 0.52, 12),
      role.top,
      0,
      0.16,
      0,
      chest,
    );
    torso.scale.set(woman ? 0.9 : 1, 1, 0.65);
  }
  for (const x of [-0.065, 0.065]) {
    add(new THREE.SphereGeometry(0.025, 8, 6), 0xe6dac8, x, 0.7, -0.16, chest);
    add(new THREE.SphereGeometry(0.012, 6, 6), 0x242424, x, 0.7, -0.181, chest);
  }
  add(new THREE.SphereGeometry(0.035, 8, 6), role.skin, 0, 0.63, -0.18, chest);
  if (role.kind === "student")
    add(new THREE.BoxGeometry(0.28, 0.32, 0.1), 0x2c3a44, 0, 0.12, 0.16, chest);
  if (role.kind === "shop")
    add(new THREE.BoxGeometry(0.32, 0.34, 0.035), 0xe4dece, 0, 0.02, -0.15, chest);
  const sleeve = role.garment === "saree" ? role.skin : role.top;
  const thighs = [],
    shins = [],
    feet = [],
    uppers = [],
    forearms = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(side * (woman ? 0.1 : 0.11), 0.86, 0);
    rig.add(thigh);
    thighs.push(thigh);
    add(
      new THREE.CapsuleGeometry(0.09, 0.28, 4, 8),
      role.bottom,
      0,
      -0.2,
      0,
      thigh,
    );
    const shin = new THREE.Group();
    shin.position.y = -0.4;
    thigh.add(shin);
    shins.push(shin);
    add(
      new THREE.CapsuleGeometry(0.07, 0.26, 4, 8),
      role.garment === "saree" ? role.bottom : role.bottom,
      0,
      -0.18,
      0,
      shin,
    );
    const foot = new THREE.Group();
    foot.position.y = -0.36;
    shin.add(foot);
    feet.push(foot);
    add(new THREE.BoxGeometry(0.14, 0.08, 0.28), 0x262823, 0, -0.02, -0.06, foot);
    const upper = new THREE.Group();
    upper.position.set(side * shoulder, 0.36, 0);
    chest.add(upper);
    uppers.push(upper);
    add(new THREE.CapsuleGeometry(0.055, 0.22, 4, 8), sleeve, 0, -0.14, 0, upper);
    const fore = new THREE.Group();
    fore.position.y = -0.28;
    upper.add(fore);
    forearms.push(fore);
    add(new THREE.CapsuleGeometry(0.045, 0.2, 4, 8), role.skin, 0, -0.12, 0, fore);
    add(new THREE.SphereGeometry(0.06, 8, 6), role.skin, 0, -0.26, 0, fore);
  }
  g.userData.walk = (time, speed = 0) => {
    const cycle = gaitCycle(time, speed);
    const swing = Math.sin(cycle.phase);
    const lifts = [
      Math.max(0, Math.cos(cycle.phase)),
      Math.max(0, -Math.cos(cycle.phase)),
    ];
    const punch = punchEnvelope(g.userData.strike);
    rig.position.y = Math.abs(Math.sin(cycle.phase)) * cycle.bob;
    chest.rotation.x = restLean - cycle.lean;
    chest.position.y = chestBase + cycle.breath * 0.2;
    thighs.forEach((limb, i) => {
      const sign = i === 0 ? 1 : -1;
      limb.rotation.x = sign * swing * cycle.stride;
      shins[i].rotation.x = -lifts[i] * cycle.knee;
      feet[i].rotation.x = lifts[i] * 0.55 * cycle.amount;
    });
    uppers.forEach((limb, i) => {
      const sign = i === 0 ? -1 : 1;
      if (i === 1 && punch) {
        limb.rotation.x = 1.2 * punch;
        forearms[i].rotation.x = punch > 0.2 ? 0.08 : 0.55;
      } else {
        limb.rotation.x = sign * swing * cycle.arm + (cycle.idle ? cycle.breath : 0);
        forearms[i].rotation.x =
          0.22 + Math.max(0, -sign * swing) * 0.45 * cycle.amount;
      }
    });
  };
  g.userData.pose = () => ({
    leftLeg: thighs[0].rotation.x,
    rightLeg: thighs[1].rotation.x,
    leftArm: uppers[0].rotation.x,
    rightArm: uppers[1].rotation.x,
    leftArmZ: uppers[0].rotation.z,
    rightArmZ: uppers[1].rotation.z,
  });
  g.scale.setScalar(role.height / 1.78);
  g.userData.role = role;
  g.userData.height = role.height;
  g.userData.walk(0, 0);
  return g;
}
