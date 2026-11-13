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
// swing > 0 means the left leg is forward. Speed is metres per second.
// A stopped body returns a zero swing so the pose can stand still.
export function stepGait(state, dt = 0, speed = 0) {
  const meters = Math.abs(Number(speed) || 0);
  const moving = meters > 0.12 ? Math.min(1, (meters - 0.12) / 0.4) : 0;
  const run = Math.min(1, Math.max(0, (meters - 1.8) / 3));
  const stride = 1.35 + run * 0.9;
  const cycles = Math.min(1.85, meters / stride);
  state.gaitPhase =
    (state.gaitPhase || 0) + cycles * Math.PI * 2 * Math.max(0, dt);
  return {
    swing: Math.sin(state.gaitPhase) * moving,
    hip: 0.48 + run * 0.34,
    arm: 0.5 + run * 0.28,
    knee: 0.95 + run * 0.4,
    moving,
    run,
  };
}
export function person(index, options = {}) {
  const player = options.player === true;
  const g = new THREE.Group(),
    skin = player
      ? 0xd6b08a
      : [0x8a553b, 0xb67b50, 0x754b38, 0xcc996b][index % 4],
    shirt = player
      ? 0xe4dccc
      : [0xe9ac52, 0x8aaea6, 0xb66c65, 0xeff0d7, 0x816c9a][index % 5],
    pants = player ? 0x343a42 : 0x344848,
    hair = player ? 0x1b1714 : 0x242322;
  g.userData.player = player;
  g.userData.skin = skin;
  g.userData.shirt = shirt;
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
  add(new THREE.SphereGeometry(0.195, 12, 8), hair, 0, 1.76, 0.015).scale.set(
    0.92,
    0.55,
    0.97,
  );
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
    knees = [],
    arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.name = side < 0 ? "left-leg" : "right-leg";
    leg.position.set(side * 0.11, 0.84, 0);
    g.add(leg);
    legs.push(leg);
    add(new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), pants, 0, -0.2, 0, leg);
    const shin = new THREE.Group();
    shin.name = side < 0 ? "left-knee" : "right-knee";
    shin.position.set(0, -0.42, 0);
    leg.add(shin);
    knees.push(shin);
    add(new THREE.CapsuleGeometry(0.075, 0.26, 4, 8), pants, 0, -0.17, 0, shin);
    add(
      new THREE.BoxGeometry(0.16, 0.1, 0.28),
      0x2a2622,
      0,
      -0.36,
      -0.03,
      shin,
    );
    const arm = new THREE.Group();
    arm.name = side < 0 ? "left-arm" : "right-arm";
    arm.position.set(side * 0.25, 1.34, 0);
    g.add(arm);
    arms.push(arm);
    add(new THREE.CapsuleGeometry(0.065, 0.4, 4, 8), skin, 0, -0.25, 0, arm);
    add(new THREE.SphereGeometry(0.075, 8, 6), skin, 0, -0.53, 0, arm);
  }
  g.userData.walk = (dt = 0, speed = 0) => {
    const { swing, hip, arm, knee } = stepGait(g.userData, dt, speed);
    // Positive X swings a hanging limb toward the face (-Z).
    legs[0].rotation.x = swing * hip;
    legs[1].rotation.x = -swing * hip;
    knees[0].rotation.x = -Math.max(0, swing) * knee;
    knees[1].rotation.x = -Math.max(0, -swing) * knee;
    arms[0].rotation.x = -swing * arm;
    arms[1].rotation.x = swing * arm;
  };
  return g;
}
