import * as THREE from "three";

function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
    );
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}

export function roadTitle(road) {
  if (!road) return "";
  const alt = road.altName || "";
  const name = road.name || "";
  if (alt === "FC Road") return "Fergusson College Road";
  if (alt === "JM Road" || name === "Jangli Maharaj Path")
    return "Jangli Maharaj Road";
  if (alt && /road/i.test(alt)) return alt;
  return name;
}

export function roadUnder(x, z, segments) {
  let best = null,
    bestD = Infinity;
  for (const segment of segments) {
    const dist = segmentDistance(x, z, segment.a, segment.b);
    if (dist < bestD) {
      bestD = dist;
      best = segment;
    }
  }
  if (!best) return "";
  const limit = Math.max(16, (best.width || 12) / 2 + 8);
  if (bestD > limit) return "";
  return roadTitle(best);
}

export const PLASTER = {
  cream: 0xf4ead3,
  offWhite: 0xf7f5f0,
  paleYellow: 0xf3e3a4,
  salmon: 0xe8b59a,
  terracotta: 0xc46548,
  concrete: 0xb9b9b4,
  dustyRose: 0xd9aaa3,
  fadedGreen: 0xc5d2b4,
};
export const GLASS_PLASTER = 0xd5e4ee;
const PLASTER_LIST = Object.values(PLASTER);
const SHOP_BANDS = [0x7c2f3b, 0x1f6b4a, 0x1d4f88, 0xc4892b];

function buildingSeed(building = {}) {
  if (building.id != null && Number.isFinite(Number(building.id)))
    return Math.abs(Number(building.id));
  return Math.round(Math.abs(building.color || 0) * 100000);
}

export function buildingLook(building = {}) {
  const seed = buildingSeed(building);
  const kind = building.kind || "yes";
  const glass =
    ["commercial", "retail", "office", "hotel"].includes(kind) ||
    building.shop === "mall" ||
    /mall/i.test(building.name || "");
  return {
    plaster: glass ? GLASS_PLASTER : PLASTER_LIST[seed % PLASTER_LIST.length],
    band: SHOP_BANDS[seed % SHOP_BANDS.length],
    glass,
    seed,
  };
}

export const SHOP_BOARDS = [
  { kind: "kirana", name: "Apna Kirana" },
  { kind: "medical", name: "Laxmi Medical" },
  { kind: "tea", name: "Tapri Chaha" },
  { kind: "bookstore", name: "FC Books" },
  { kind: "salon", name: "Nutan Salon" },
  { kind: "electronics", name: "Shree Electronics" },
  { kind: "bakery", name: "Annapurna Bakery" },
  { kind: "juice", name: "Nisarg Juice" },
  { kind: "tailor", name: "Suman Tailors" },
  { kind: "kirana", name: "Gharacha Kirana" },
  { kind: "medical", name: "Arogya Medical" },
  { kind: "tea", name: "Kaka Chi Chaha" },
  { kind: "bookstore", name: "Pustak Ghar" },
  { kind: "salon", name: "Keshav Salon" },
  { kind: "electronics", name: "Mobile Galli" },
  { kind: "bakery", name: "Bhavani Bakery" },
  { kind: "juice", name: "Fresh Juice Bar" },
  { kind: "tailor", name: "Stitch Point" },
];

export function frontageName(building = {}) {
  if (building.name) return building.name;
  return SHOP_BOARDS[buildingSeed(building) % SHOP_BOARDS.length].name;
}

export function isShopFront(building = {}) {
  if (building.shop && building.shop !== "no") return true;
  if (["retail", "commercial"].includes(building.kind)) return true;
  if (
    ["cafe", "restaurant", "fast_food", "bank", "pharmacy", "clinic"].includes(
      building.amenity,
    )
  )
    return true;
  if (building.name && /mall|store|market/i.test(building.name)) return true;
  if (!building.name && buildingSeed(building) % 6 === 1) return true;
  return false;
}

export function mapPlaces(buildings = []) {
  const places = [];
  for (const building of buildings) {
    const named = Boolean(building.name);
    if (!named && !isShopFront(building)) continue;
    const xs = building.points.map((p) => p[0]);
    const zs = building.points.map((p) => p[1]);
    places.push({
      name: named ? building.name : frontageName(building),
      point: [
        xs.reduce((a, b) => a + b, 0) / xs.length,
        zs.reduce((a, b) => a + b, 0) / zs.length,
      ],
      kind: building.shop || building.amenity || building.kind || "shop",
      named,
    });
  }
  return places;
}

export function nodeKey(point) {
  return `${point[0].toFixed(1)},${point[1].toFixed(1)}`;
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

export function chooseGoal(segments, from, minDistance, rng = Math.random) {
  if (!segments.length) return from;
  const start = Math.floor(rng() * segments.length) % segments.length;
  let fallback = segments[start].b;
  for (let n = 0; n < segments.length; n++) {
    const segment = segments[(start + n) % segments.length];
    for (const point of [segment.a, segment.b]) {
      fallback = point;
      if (Math.hypot(point[0] - from[0], point[1] - from[1]) >= minDistance)
        return point;
    }
  }
  return fallback;
}

export function planTrip({
  adjacency,
  fromSegment,
  atNode,
  goal = null,
  minLength = 70,
  rng = Math.random,
  maxSteps = 14,
}) {
  const steps = [];
  let length = 0;
  let node = atNode;
  let previous = fromSegment;
  let guard = 0;
  while (steps.length < maxSteps && guard++ < maxSteps + 2) {
    const connected = (adjacency.get(node) || []).filter((s) => s.length > 0.4);
    const others = connected.filter((s) => s !== previous);
    if (!others.length && steps.some((step) => step.segment === previous)) break;
    const pool = others.length ? others : connected;
    if (!pool.length) break;
    const recent = steps.slice(-3).map((step) => step.segment);
    const fresh = pool.filter((s) => !recent.includes(s));
    const choices = (fresh.length ? fresh : pool).map((segment) => {
      const direction = nodeKey(segment.a) === node ? 1 : -1;
      const end = direction === 1 ? segment.b : segment.a;
      const dist = goal ? Math.hypot(end[0] - goal[0], end[1] - goal[1]) : 0;
      return { segment, direction, dist };
    });
    choices.sort((a, b) => a.dist - b.dist);
    const best = choices[0].dist;
    const near = choices.filter((choice) => choice.dist <= best + 18);
    const pick = near[Math.floor(rng() * near.length) % near.length];
    steps.push({ segment: pick.segment, direction: pick.direction });
    length += pick.segment.length;
    previous = pick.segment;
    node = nodeKey(pick.direction === 1 ? pick.segment.b : pick.segment.a);
    if (length >= minLength && steps.length >= 2) break;
  }
  return { steps, length, endNode: node };
}

export function rollVehicle(state, dt, adjacency, roads, rng = Math.random) {
  let segment = state.segment;
  let s = state.s;
  let direction = state.direction >= 0 ? 1 : -1;
  let trip = state.trip || null;
  let cursor = state.cursor || 0;
  let goal = state.goal || null;
  let remain = (state.speed || 8) * dt;
  let guard = 0;
  while (remain > 0.02 && guard++ < 6) {
    const room = (direction === 1 ? 1 - s : s) * segment.length;
    if (remain < room - 1e-3) {
      s += (direction * remain) / segment.length;
      remain = 0;
      break;
    }
    remain -= Math.max(0, room);
    const node = nodeKey(direction === 1 ? segment.b : segment.a);
    if (!trip || cursor >= trip.steps.length) {
      const here = direction === 1 ? segment.b : segment.a;
      if (!goal || (trip && cursor >= trip.steps.length))
        goal = chooseGoal(roads, here, state.minGoal || 80, rng);
      trip = planTrip({
        adjacency,
        fromSegment: segment,
        atNode: node,
        goal,
        minLength: state.minLength || 70,
        rng,
      });
      cursor = 0;
      if (!trip.steps.length) break;
    }
    const next = trip.steps[cursor++];
    if (!next) break;
    segment = next.segment;
    direction = next.direction >= 0 ? 1 : -1;
    s = direction === 1 ? 0 : 1;
  }
  const x = segment.a[0] + (segment.b[0] - segment.a[0]) * s;
  const z = segment.a[1] + (segment.b[1] - segment.a[1]) * s;
  return { ...state, segment, s, direction, trip, cursor, goal, x, z };
}

export const VEHICLE_CYCLE = ["bike", "bike", "bike", "car", "auto", "bike", "car", "bus"];
const BUS_ROUTES = [22, 42, 104, 140, 196, 6];

export function vehicleSpec(index) {
  const kind = VEHICLE_CYCLE[Math.abs(index) % VEHICLE_CYCLE.length];
  const route = BUS_ROUTES[Math.abs(index) % BUS_ROUTES.length];
  const label = { bike: "Bike", car: "Car", auto: "Auto", bus: "Bus" }[kind];
  return {
    kind,
    label,
    route: kind === "bus" ? route : null,
    board: kind === "bus" ? `Bus ${route}` : label,
    livery: kind === "bus" && index % 2 ? "purple" : kind,
    tint: Math.abs(index) % 6,
  };
}

export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function paint(color, roughness = 0.5, metalness = 0.2) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function wheel(parent, x, y, z, radius = 0.34, width = 0.18) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 10),
    paint(0x20262a, 0.7, 0.1),
  );
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
}

function busBoard(text, livery) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = livery === "purple" ? "#5c3d86" : "#f4e7c4";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = livery === "purple" ? "#f4e7c4" : "#7d2430";
  ctx.font = "bold 72px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeAuto() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.7, 2.15), paint(0x141414, 0.4, 0.15));
  body.position.set(0, 0.72, 0.05);
  g.add(body);
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.72, 1.35),
    paint(0xf0c31a, 0.45, 0.05),
  );
  canopy.position.set(0, 1.35, 0.15);
  g.add(canopy);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.37, 0.12, 2.16),
    paint(0xf0c31a, 0.4, 0.05),
  );
  stripe.position.set(0, 0.95, 0.05);
  g.add(stripe);
  wheel(g, 0, 0.32, -0.95, 0.32, 0.16);
  wheel(g, -0.62, 0.34, 0.7, 0.34, 0.16);
  wheel(g, 0.62, 0.34, 0.7, 0.34, 0.16);
  g.userData.kind = "auto";
  g.userData.label = "Auto";
  return g;
}

export function makeBus(spec) {
  const g = new THREE.Group();
  const purple = spec.livery === "purple";
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 1.55, 7.4),
    paint(purple ? 0x5c3d86 : 0xc4475a, 0.55, 0.08),
  );
  body.position.set(0, 1.45, 0);
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 6.6), paint(0xf3e6c8, 0.6, 0.05));
  roof.position.set(0, 2.45, -0.1);
  g.add(roof);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.7, 6.2), paint(0x9ec4d4, 0.15, 0.4));
  glass.position.set(0, 2.35, -0.1);
  g.add(glass);
  for (const z of [-2.3, -0.7, 0.9, 2.4]) {
    wheel(g, -1.05, 0.42, z, 0.42, 0.24);
    wheel(g, 1.05, 0.42, z, 0.42, 0.24);
  }
  const tex = busBoard(spec.board || "City Bus", spec.livery);
  if (tex) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.8),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
    );
    sign.position.set(0, 2.55, 3.72);
    g.add(sign);
  }
  g.userData.kind = "bus";
  g.userData.label = "Bus";
  g.userData.route = spec.route;
  g.userData.board = spec.board;
  return g;
}

export function makeBike(color = 0xb4332a) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 1.35), paint(color, 0.45, 0.3));
  frame.position.set(0, 0.62, 0);
  g.add(frame);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.5), paint(color, 0.4, 0.25));
  tank.position.set(0, 0.82, -0.15);
  g.add(tank);
  wheel(g, 0, 0.32, -0.72, 0.32, 0.12);
  wheel(g, 0, 0.32, 0.72, 0.32, 0.12);
  const rider = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.55, 0.28), paint(0x2f4f86, 0.8, 0));
  rider.position.set(0, 1.15, 0.05);
  g.add(rider);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), paint(0xd7a574, 0.8, 0));
  head.position.set(0, 1.55, 0.02);
  g.add(head);
  g.userData.kind = "bike";
  g.userData.label = "Bike";
  return g;
}

export function makeVehicle(spec) {
  const colors = [0xd7c4a2, 0xa7b7b3, 0x678e92, 0xa4523f, 0x6e8b74, 0xe3dac4];
  const mesh =
    spec.kind === "bus"
      ? makeBus(spec)
      : spec.kind === "auto"
        ? makeAuto()
        : spec.kind === "bike"
          ? makeBike(colors[spec.tint || 0])
          : makeCar(colors[spec.tint || 0]);
  mesh.userData.kind = spec.kind;
  mesh.userData.label = spec.label;
  mesh.userData.route = spec.route || null;
  mesh.userData.board = spec.board || spec.label;
  mesh.userData.livery = spec.livery || spec.kind;
  return mesh;
}

function makeCar(color) {
  const g = new THREE.Group();
  const box = (w, h, d, c, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint(c, 0.45, 0.25));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  box(1.85, 0.6, 3.8, color, 0, 0.7, 0);
  box(1.6, 0.65, 1.9, color, 0, 1.3, 0.1);
  box(1.47, 0.45, 0.03, 0x244449, 0, 1.35, -0.87);
  box(1.47, 0.45, 0.03, 0x244449, 0, 1.35, 1.07);
  for (const x of [-0.92, 0.92])
    for (const z of [-1.15, 1.15]) wheel(g, x, 0.4, z, 0.38, 0.22);
  return g;
}

export const RESIDENTS = [
  { name: "Asha", role: "shopkeeper", garment: "saree", skin: 0xc48a62, cloth: 0xb23a4a, hair: 0x2a211c, bag: false, height: 1.58 },
  { name: "Rohan", role: "student", garment: "college", skin: 0xd7a574, cloth: 0x2f4f86, hair: 0x1a1412, bag: true, height: 1.76 },
  { name: "Meera", role: "student", garment: "college", skin: 0xe4c09a, cloth: 0xf2efe4, hair: 0x3a2418, bag: true, height: 1.62 },
  { name: "Suresh", role: "older", garment: "kurta", skin: 0xc9956e, cloth: 0xe8e2cf, hair: 0x8d8d8d, bag: false, height: 1.68 },
  { name: "Kavita", role: "shopkeeper", garment: "saree", skin: 0xf0d2b4, cloth: 0x2f6b4f, hair: 0x241812, bag: false, height: 1.6 },
  { name: "Nikhil", role: "commuter", garment: "shirt", skin: 0xc07050, cloth: 0xe7e4dc, hair: 0x1c140f, bag: false, height: 1.78 },
  { name: "Lata", role: "older", garment: "saree", skin: 0xd8ae86, cloth: 0xc46a3a, hair: 0x9a9a9a, bag: false, height: 1.55 },
  { name: "Omkar", role: "student", garment: "shirt", skin: 0xe8c8a4, cloth: 0x6b3a4a, hair: 0x2a1c14, bag: true, height: 1.74 },
  { name: "Priya", role: "commuter", garment: "kurta", skin: 0xf3d7bc, cloth: 0xd7a03a, hair: 0x3a241c, bag: true, height: 1.64 },
  { name: "Ganesh", role: "shopkeeper", garment: "shirt", skin: 0xc48a62, cloth: 0x3d6b8a, hair: 0x1a120e, bag: false, height: 1.72 },
  { name: "Sneha", role: "student", garment: "college", skin: 0xe0b48a, cloth: 0x8a3e62, hair: 0x2c1a12, bag: true, height: 1.61 },
  { name: "Amit", role: "commuter", garment: "kurta", skin: 0xd9b08a, cloth: 0x4a6748, hair: 0x221814, bag: false, height: 1.8 },
];

export function residentProfile(index) {
  return RESIDENTS[Math.abs(index) % RESIDENTS.length];
}

export function person(index) {
  const profile = residentProfile(index);
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const add = (geo, c, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const kurta = profile.garment === "kurta";
  const saree = profile.garment === "saree";
  const pants = profile.garment === "college" ? 0x2c3a55 : kurta ? profile.cloth : 0x344848;
  add(new THREE.SphereGeometry(0.19, 12, 10), profile.skin, 0, 1.65, 0).scale.set(0.86, 1.12, 0.9);
  add(new THREE.SphereGeometry(0.195, 10, 8), profile.hair, 0, 1.78, 0.02).scale.set(0.92, 0.5, 0.97);
  add(new THREE.CylinderGeometry(0.085, 0.09, 0.12, 8), profile.skin, 0, 1.43, 0);
  const torso = add(
    new THREE.CylinderGeometry(0.23, 0.2, kurta ? 0.78 : 0.52, 10),
    profile.cloth,
    0,
    kurta ? 1.02 : 1.12,
    0,
  );
  torso.scale.z = 0.65;
  if (saree) {
    const skirt = add(new THREE.CylinderGeometry(0.28, 0.42, 0.86, 10), profile.cloth, 0, 0.48, 0);
    skirt.scale.z = 0.72;
  }
  for (const x of [-0.065, 0.065]) {
    add(new THREE.SphereGeometry(0.025, 8, 6), 0xe6dac8, x, 1.68, -0.16);
    add(new THREE.SphereGeometry(0.012, 6, 6), 0x242424, x, 1.68, -0.181);
  }
  add(new THREE.SphereGeometry(0.035, 8, 6), profile.skin, 0, 1.61, -0.18);
  const legs = [],
    arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.1, 0.82, 0);
    g.add(leg);
    legs.push(leg);
    if (!saree) {
      add(new THREE.CapsuleGeometry(0.09, 0.46, 3, 6), pants, 0, -0.28, 0, leg);
      add(new THREE.BoxGeometry(0.16, 0.1, 0.28), 0x262823, 0, -0.66, -0.04, leg);
    } else add(new THREE.CapsuleGeometry(0.07, 0.16, 2, 5), profile.skin, 0, -0.58, 0.04, leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.25, 1.32, 0);
    g.add(arm);
    arms.push(arm);
    add(new THREE.CapsuleGeometry(0.06, 0.36, 3, 5), saree ? profile.cloth : profile.skin, 0, -0.24, 0, arm);
    add(new THREE.SphereGeometry(0.07, 8, 6), profile.skin, 0, -0.5, 0, arm);
  }
  if (profile.bag) add(new THREE.BoxGeometry(0.28, 0.34, 0.12), 0x3e342c, 0, 1.15, 0.16);
  g.scale.setScalar(profile.height / 1.72);
  g.userData.name = profile.name;
  g.userData.role = profile.role;
  g.userData.garment = profile.garment;
  g.userData.label = profile.role === "shopkeeper" ? `${profile.name} · shopkeeper` : profile.name;
  g.userData.walk = (time, amount = 1) => {
    legs.forEach((p, i) => (p.rotation.x = Math.sin(time * 6 + i * Math.PI) * 0.45 * amount));
    arms.forEach((p, i) => (p.rotation.x = -Math.sin(time * 6 + i * Math.PI) * 0.35 * amount));
  };
  return g;
}
