import * as THREE from "three";
import { makeCar } from "./city.js";

export const VEHICLE_TYPES = [
  { id: "city-car", label: "City Car", class: "car" },
  { id: "rickshaw", label: "Rickshaw", class: "car" },
  { id: "compact-suv", label: "Compact SUV", class: "car" },
  { id: "boxy-offroader", label: "Boxy Off-roader", class: "car" },
  { id: "tall-suv", label: "Tall SUV", class: "car" },
  { id: "scooter", label: "Scooter", class: "bike" },
  { id: "city-scooter", label: "City Scooter", class: "bike" },
  { id: "moped", label: "Moped", class: "bike" },
  { id: "geared-bike", label: "Geared Bike", class: "bike" },
];

const BIKE_CYCLE = ["scooter", "moped", "city-scooter", "geared-bike"];
const CAR_CYCLE = [
  "city-car",
  "compact-suv",
  "boxy-offroader",
  "tall-suv",
  "rickshaw",
];

const HORNS = {
  "city-car": { wave: "triangle", tones: [370], note: 0.34, gap: 0 },
  rickshaw: { wave: "square", tones: [540, 690], note: 0.11, gap: 0.04 },
  "compact-suv": { wave: "sawtooth", tones: [410, 488], note: 0.16, gap: 0.03 },
  "boxy-offroader": { wave: "square", tones: [248, 312], note: 0.2, gap: 0.05 },
  "tall-suv": { wave: "triangle", tones: [286, 352], note: 0.18, gap: 0.04 },
  scooter: { wave: "square", tones: [740], note: 0.1, gap: 0 },
  "city-scooter": {
    wave: "triangle",
    tones: [640, 820],
    note: 0.08,
    gap: 0.03,
  },
  moped: { wave: "square", tones: [470, 510], note: 0.13, gap: 0.05 },
  "geared-bike": { wave: "sawtooth", tones: [430, 575], note: 0.09, gap: 0.02 },
};

const ENGINES = {
  "city-car": { wave: "sawtooth", base: 42, rev: 4, filter: 170, noise: 0.08 },
  rickshaw: { wave: "square", base: 86, rev: 6.5, filter: 480, noise: 0.35 },
  "compact-suv": {
    wave: "sawtooth",
    base: 58,
    rev: 3.4,
    filter: 250,
    noise: 0.12,
  },
  "boxy-offroader": {
    wave: "triangle",
    base: 34,
    rev: 2.6,
    filter: 130,
    noise: 0.28,
  },
  "tall-suv": {
    wave: "sawtooth",
    base: 48,
    rev: 3.1,
    filter: 200,
    noise: 0.16,
  },
  scooter: { wave: "sine", base: 168, rev: 9, filter: 980, noise: 0.05 },
  "city-scooter": {
    wave: "sine",
    base: 198,
    rev: 8,
    filter: 1200,
    noise: 0.07,
  },
  moped: { wave: "square", base: 96, rev: 5.5, filter: 540, noise: 0.42 },
  "geared-bike": {
    wave: "sawtooth",
    base: 124,
    rev: 11,
    filter: 760,
    noise: 0.22,
  },
};

const mats = new Map();
function mat(color, roughness = 0.45, metalness = 0.25) {
  const key = `${color}:${roughness}:${metalness}`;
  if (!mats.has(key))
    mats.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    );
  return mats.get(key);
}
const GLASS = mat(0x244449, 0.15, 0.45);
const RUBBER = mat(0x202b2b, 0.92, 0.05);
const STEEL = mat(0x8e948e, 0.35, 0.7);
const PLASTIC = mat(0x2c3130, 0.7, 0.1);
const LAMP = mat(0xffecc3, 0.4, 0.1);
const TAIL = mat(0xb03828, 0.45, 0.1);
const PUFF = new THREE.SphereGeometry(0.16, 6, 5);

function add(group, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}
function box(group, w, h, d, material, x, y, z) {
  return add(group, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}
function wheel(group, radius, x, y, z, width = 0.18) {
  const mesh = add(
    group,
    new THREE.CylinderGeometry(radius, radius, width, 12),
    RUBBER,
    x,
    y,
    z,
  );
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}
function finish(group, id, extra) {
  const type = VEHICLE_TYPES.find((item) => item.id === id);
  group.userData = {
    type: id,
    label: type.label,
    class: type.class,
    parts: [...extra.parts].sort(),
    tail: extra.tail,
    length: extra.length,
    wheelRadius: extra.wheelRadius ?? null,
    apron: extra.apron ?? null,
    tailBox: extra.tailBox ?? null,
  };
  return group;
}
function lamps(group, y, front, rear) {
  for (const x of [-0.55, 0.55]) {
    box(group, 0.3, 0.12, 0.05, LAMP, x, y, front);
    box(group, 0.26, 0.1, 0.05, TAIL, x, y, rear);
  }
}

function compactSuv(color) {
  const group = new THREE.Group();
  const parts = new Set(["body", "cabin", "hatch", "roof-rail"]);
  const paint = mat(color);
  box(group, 1.92, 0.78, 4.25, paint, 0, 1.08, 0);
  box(group, 1.72, 0.5, 1.65, paint, 0, 1.62, -0.2);
  const hatch = box(group, 1.66, 0.46, 1.2, paint, 0, 1.48, 1.05);
  hatch.rotation.x = 0.62;
  box(group, 0.08, 0.07, 1.75, STEEL, -0.62, 1.98, -0.05);
  box(group, 0.08, 0.07, 1.75, STEEL, 0.62, 1.98, -0.05);
  box(group, 1.5, 0.36, 0.04, GLASS, 0, 1.58, -1.05);
  box(group, 0.04, 0.34, 1.4, GLASS, -0.88, 1.55, -0.15);
  box(group, 0.04, 0.34, 1.4, GLASS, 0.88, 1.55, -0.15);
  for (const x of [-1, 1])
    for (const z of [-1.4, 1.45]) wheel(group, 0.42, x * 0.98, 0.46, z, 0.24);
  box(group, 1.7, 0.1, 0.08, STEEL, 0, 0.78, -2.16);
  lamps(group, 0.98, -2.16, 2.18);
  return finish(group, "compact-suv", {
    parts,
    tail: 2.25,
    length: 4.45,
    wheelRadius: 0.42,
  });
}

function boxyOffroader(color) {
  const group = new THREE.Group();
  const parts = new Set(["upright-body", "wheel-arch", "spare-wheel"]);
  const paint = mat(color);
  box(group, 1.62, 1.18, 3.15, paint, 0, 1.28, 0);
  box(group, 1.45, 0.08, 1.5, STEEL, 0, 1.9, -0.05);
  box(group, 1.35, 0.32, 0.04, GLASS, 0, 1.48, -1.58);
  box(group, 0.04, 0.4, 1.35, GLASS, -0.82, 1.45, -0.1);
  box(group, 0.04, 0.4, 1.35, GLASS, 0.82, 1.45, -0.1);
  for (const x of [-1, 1])
    for (const z of [-1.15, 1.15]) {
      box(group, 0.24, 0.58, 0.82, PLASTIC, x * 0.94, 0.78, z);
      wheel(group, 0.46, x * 1.1, 0.48, z, 0.26);
    }
  const spare = add(
    group,
    new THREE.CylinderGeometry(0.34, 0.34, 0.14, 14),
    RUBBER,
    0,
    1.18,
    1.74,
  );
  spare.rotation.x = Math.PI / 2;
  box(group, 0.42, 0.42, 0.06, STEEL, 0, 1.18, 1.84);
  lamps(group, 1.05, -1.62, 1.55);
  return finish(group, "boxy-offroader", {
    parts,
    tail: 1.98,
    length: 3.55,
    wheelRadius: 0.46,
  });
}

function tallSuv(color) {
  const group = new THREE.Group();
  const parts = new Set(["body", "bonnet", "cabin", "quarter-glass"]);
  const paint = mat(color);
  box(group, 1.9, 0.68, 4.95, paint, 0, 1.02, 0.15);
  box(group, 1.76, 0.46, 1.5, paint, 0, 1.28, -1.55);
  box(group, 1.78, 0.82, 2.4, paint, 0, 1.68, 0.9);
  box(group, 0.04, 0.5, 2.1, GLASS, -0.92, 1.66, 0.8);
  box(group, 0.04, 0.5, 2.1, GLASS, 0.92, 1.66, 0.8);
  box(group, 1.5, 0.42, 0.04, GLASS, 0, 1.62, -0.32);
  for (const x of [-1, 1])
    for (const z of [-1.6, 1.75]) wheel(group, 0.44, x * 0.98, 0.46, z, 0.26);
  lamps(group, 1.08, -2.5, 2.62);
  return finish(group, "tall-suv", {
    parts,
    tail: 2.7,
    length: 5.2,
    wheelRadius: 0.44,
  });
}

function scooterBody(id, color, spec) {
  const group = new THREE.Group();
  const parts = new Set(["floorboard", "apron", "wheel", "tail"]);
  const paint = mat(color);
  const radius = spec.wheelRadius;
  wheel(group, radius, 0, radius, spec.front, spec.wheelWidth);
  wheel(group, radius, 0, radius, spec.rear, spec.wheelWidth);
  box(
    group,
    spec.apron.w,
    spec.apron.h,
    spec.apron.d,
    paint,
    0,
    spec.apron.y,
    spec.apron.z,
  );
  box(
    group,
    spec.floor.w,
    spec.floor.h,
    spec.floor.d,
    PLASTIC,
    0,
    spec.floor.y,
    spec.floor.z,
  );
  box(
    group,
    spec.tailBox.w,
    spec.tailBox.h,
    spec.tailBox.d,
    paint,
    0,
    spec.tailBox.y,
    spec.tailBox.z,
  );
  box(group, 0.28, 0.1, 0.42, PLASTIC, 0, spec.seatY, spec.seatZ);
  box(group, 0.46, 0.04, 0.04, STEEL, 0, spec.barY, spec.front - 0.02);
  box(group, 0.04, 0.28, 0.04, STEEL, 0, spec.barY - 0.14, spec.front + 0.1);
  box(group, 0.16, 0.08, 0.04, LAMP, 0, spec.apron.y, spec.front - 0.08);
  box(group, 0.18, 0.08, 0.04, TAIL, 0, spec.tailBox.y, spec.rear + 0.16);
  return finish(group, id, {
    parts,
    tail: spec.tail,
    length: spec.length,
    wheelRadius: radius,
    apron: { w: spec.apron.w, h: spec.apron.h, d: spec.apron.d },
    tailBox: { w: spec.tailBox.w, h: spec.tailBox.h, d: spec.tailBox.d },
  });
}

function scooter(color) {
  return scooterBody("scooter", color, {
    wheelRadius: 0.28,
    wheelWidth: 0.12,
    front: -0.64,
    rear: 0.62,
    apron: { w: 0.42, h: 0.55, d: 0.12, y: 0.64, z: -0.5 },
    floor: { w: 0.34, h: 0.05, d: 0.5, y: 0.34, z: -0.05 },
    tailBox: { w: 0.36, h: 0.28, d: 0.4, y: 0.54, z: 0.42 },
    seatY: 0.8,
    seatZ: 0.16,
    barY: 0.98,
    tail: 0.78,
    length: 1.7,
  });
}

function cityScooter(color) {
  return scooterBody("city-scooter", color, {
    wheelRadius: 0.27,
    wheelWidth: 0.14,
    front: -0.68,
    rear: 0.7,
    apron: { w: 0.56, h: 0.74, d: 0.18, y: 0.72, z: -0.54 },
    floor: { w: 0.38, h: 0.06, d: 0.46, y: 0.36, z: 0.02 },
    tailBox: { w: 0.4, h: 0.42, d: 0.62, y: 0.6, z: 0.5 },
    seatY: 0.88,
    seatZ: 0.12,
    barY: 1.05,
    tail: 0.95,
    length: 1.9,
  });
}

function moped(color) {
  const group = new THREE.Group();
  const parts = new Set(["step", "spine", "wheel"]);
  const paint = mat(color);
  const radius = 0.2;
  wheel(group, radius, 0, radius, -0.72, 0.1);
  wheel(group, radius, 0, radius, 0.72, 0.12);
  box(group, 0.08, 0.08, 1.4, STEEL, 0, 0.5, 0);
  box(group, 0.22, 0.04, 0.36, PLASTIC, 0, 0.3, -0.04);
  box(group, 0.2, 0.16, 0.34, paint, 0, 0.52, 0.5);
  box(group, 0.24, 0.08, 0.38, PLASTIC, 0, 0.74, 0.22);
  box(group, 0.42, 0.04, 0.04, STEEL, 0, 0.94, -0.62);
  box(group, 0.04, 0.34, 0.04, STEEL, 0, 0.78, -0.5);
  box(group, 0.12, 0.08, 0.04, TAIL, 0, 0.58, 0.78);
  return finish(group, "moped", {
    parts,
    tail: 0.88,
    length: 1.75,
    wheelRadius: radius,
  });
}

function gearedBike(color) {
  const group = new THREE.Group();
  const parts = new Set([
    "tank",
    "engine-block",
    "chain",
    "grab-rail",
    "wheel",
  ]);
  const paint = mat(color);
  const radius = 0.24;
  wheel(group, radius, 0, radius, -0.74, 0.12);
  wheel(group, radius, 0, radius, 0.74, 0.14);
  box(group, 0.06, 0.06, 1.45, STEEL, 0, 0.42, 0);
  box(group, 0.28, 0.22, 0.5, paint, 0, 0.8, -0.16);
  box(group, 0.22, 0.2, 0.28, PLASTIC, 0, 0.4, -0.02);
  box(group, 0.04, 0.05, 0.58, STEEL, 0.14, 0.32, 0.28);
  box(group, 0.22, 0.08, 0.36, PLASTIC, 0, 0.78, 0.28);
  box(group, 0.2, 0.04, 0.05, STEEL, 0, 0.9, 0.52);
  box(group, 0.04, 0.14, 0.16, STEEL, -0.08, 0.84, 0.5);
  box(group, 0.04, 0.14, 0.16, STEEL, 0.08, 0.84, 0.5);
  box(group, 0.52, 0.04, 0.04, STEEL, 0, 0.98, -0.64);
  box(group, 0.04, 0.28, 0.04, STEEL, 0, 0.84, -0.52);
  box(group, 0.12, 0.08, 0.04, TAIL, 0, 0.62, 0.86);
  return finish(group, "geared-bike", {
    parts,
    tail: 0.96,
    length: 1.95,
    wheelRadius: radius,
  });
}

const BUILDERS = {
  "compact-suv": compactSuv,
  "boxy-offroader": boxyOffroader,
  "tall-suv": tallSuv,
  scooter,
  "city-scooter": cityScooter,
  moped,
  "geared-bike": gearedBike,
};

export function planTraffic(count) {
  const ids = [];
  let bikes = 0;
  let cars = 0;
  for (let i = 0; i < count; i++) {
    if (i % 4 === 3) ids.push(CAR_CYCLE[cars++ % CAR_CYCLE.length]);
    else ids.push(BIKE_CYCLE[bikes++ % BIKE_CYCLE.length]);
  }
  return ids;
}

export function hornSpec(id) {
  return HORNS[id];
}
export function engineSpec(id) {
  return ENGINES[id];
}
export function distanceGain(distance, radius = 72) {
  if (!(distance < radius)) return 0;
  const fade = 1 - distance / radius;
  return fade * fade;
}

export function makeVehicle(id, color = 0xd7c4a2) {
  const type = VEHICLE_TYPES.find((item) => item.id === id);
  if (!type) throw new Error(`Unknown vehicle ${id}`);
  if (id === "city-car" || id === "rickshaw") {
    const mesh = makeCar(color, id === "rickshaw");
    mesh.userData = {
      type: id,
      label: type.label,
      class: "car",
      parts: ["body", "cabin"],
      tail: 2.05,
      length: 3.9,
      wheelRadius: 0.38,
      apron: null,
      tailBox: null,
    };
    return mesh;
  }
  return BUILDERS[id](color);
}

export function createSmoke(parent, tail = 1.6) {
  const puffs = [];
  for (let i = 0; i < 3; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xc5c8c2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(PUFF, material);
    mesh.visible = false;
    mesh.userData.life = 0;
    mesh.position.set(0, 0.35, tail);
    parent.add(mesh);
    puffs.push(mesh);
  }
  return { puffs, tail, cool: 0, cursor: 0, maxLife: 0.6 };
}

export function stepSmoke(smoke, dt, moving) {
  if (moving) {
    smoke.cool -= dt;
    if (smoke.cool <= 0) {
      const puff = smoke.puffs[smoke.cursor % smoke.puffs.length];
      smoke.cursor += 1;
      puff.userData.life = smoke.maxLife;
      puff.userData.drift = (smoke.cursor % 5) * 0.05 - 0.1;
      puff.position.set(puff.userData.drift, 0.32, smoke.tail);
      puff.scale.setScalar(0.7);
      puff.visible = true;
      smoke.cool = 0.16;
    }
  }
  let alive = 0;
  for (const puff of smoke.puffs) {
    if (puff.userData.life <= 0) {
      puff.visible = false;
      puff.material.opacity = 0;
      continue;
    }
    puff.userData.life -= dt;
    const fade = Math.max(0, puff.userData.life / smoke.maxLife);
    puff.material.opacity = fade * 0.5;
    puff.position.y += dt * 0.85;
    puff.position.z += dt * 0.55;
    puff.position.x += (puff.userData.drift || 0) * dt;
    puff.scale.setScalar(0.7 + (1 - fade) * 1.4);
    if (fade <= 0) {
      puff.visible = false;
      puff.material.opacity = 0;
    } else alive += 1;
  }
  return alive;
}

export function playHorn(ctx, id, distance = 0) {
  if (!ctx) return false;
  const spec = hornSpec(id);
  const amount = 0.08 * distanceGain(distance, 64);
  if (amount < 0.001) return false;
  let time = ctx.currentTime;
  for (const freq of spec.tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.wave;
    osc.frequency.setValueAtTime(freq, time);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(amount, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + spec.note);
    osc.start(time);
    osc.stop(time + spec.note + 0.02);
    time += spec.note + spec.gap;
  }
  return true;
}

function noiseBuffer(ctx) {
  const length = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.82 + white * 0.18;
    data[i] = last * 0.8;
  }
  return buffer;
}

export function createEnginePool(ctx, size = 6) {
  const buffer = noiseBuffer(ctx);
  const voices = [];
  for (let i = 0; i < size; i++) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noise.loop = true;
    filter.type = "lowpass";
    osc.connect(filter);
    filter.connect(gain);
    noise.connect(noiseGain);
    noiseGain.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0;
    noiseGain.gain.value = 0;
    osc.start();
    noise.start();
    voices.push({ osc, filter, gain, noiseGain, id: null });
  }
  return { ctx, voices };
}

export function updateEnginePool(pool, heard) {
  if (!pool) return;
  const now = pool.ctx.currentTime;
  for (let i = 0; i < pool.voices.length; i++) {
    const voice = pool.voices[i];
    const item = heard[i];
    if (!item) {
      voice.gain.gain.setTargetAtTime(0, now, 0.05);
      voice.noiseGain.gain.setTargetAtTime(0, now, 0.05);
      voice.id = null;
      continue;
    }
    const spec = engineSpec(item.id);
    if (voice.id !== item.id) {
      voice.osc.type = spec.wave;
      voice.id = item.id;
    }
    const rate = Math.max(0, Math.abs(item.speed) || 0);
    voice.osc.frequency.setTargetAtTime(spec.base + rate * spec.rev, now, 0.12);
    voice.filter.frequency.setTargetAtTime(spec.filter + rate * 6, now, 0.15);
    const loud =
      distanceGain(item.distance, 70) * Math.min(0.03, 0.008 + rate * 0.0008);
    voice.gain.gain.setTargetAtTime(loud, now, 0.08);
    voice.noiseGain.gain.setTargetAtTime(loud * spec.noise, now, 0.08);
  }
}
