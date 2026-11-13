import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  REFERENCE_CARS,
  BLENDER_VEHICLES,
  NORMAL_CARS,
  SUPERCARS,
  TRANSPORT_VEHICLES,
  LEGACY_CAR_REPLACEMENTS,
  attachVehicleAsset,
} from "./vehicle-assets.js";

// Two-wheelers outnumber cars by 4 to 1. Bodies are original meshes.
export const STREET_FLEET = { cars: 12, motorcycles: 48, buses: 3 };

export const CAR_BODIES = Object.keys(REFERENCE_CARS);
export const BIKE_BODIES = ["scooter", "scooter-apron", "moped", "geared-bike"];

export const BODY_LABELS = {
  ...Object.fromEntries(
    Object.entries(BLENDER_VEHICLES).map(([id, spec]) => [id, spec.label]),
  ),
  "compact-suv": "Compact SUV",
  "boxy-offroader": "Boxy Off-roader",
  "tall-suv": "Tall SUV",
  scooter: "Scooter",
  "scooter-apron": "Scooter",
  moped: "Moped",
  "geared-bike": "Geared Bike",
  "police-sedan": "Police Sedan",
  "ambulance-van": "Ambulance",
  "fire-engine": "Fire Engine",
};

export const SERVICE_BODIES = [
  "police-patrol-suv",
  "police-classic-jeep",
  "police-transport",
  "ambulance-van",
  "fire-engine",
];

const SERVICE_KIND = {
  "police-sedan": "police",
  "police-patrol-suv": "police",
  "police-classic-jeep": "police",
  "police-transport": "police",
  "ambulance-van": "ambulance",
  "fire-engine": "fire",
};

// Two-tone oscillators. Original synthesis, not a recorded siren.
export const SIREN_TONES = {
  police: { low: 640, high: 820, rate: 2.1, type: "square" },
  ambulance: { low: 520, high: 900, rate: 1.15, type: "sawtooth" },
  fire: { low: 400, high: 620, rate: 0.65, type: "triangle" },
};

// One short synthesized horn and one engine tone per body. Not a recording.
export const VEHICLE_TONES = {
  "compact-suv": {
    hornFreq: 349,
    hornType: "square",
    hornSeconds: 0.28,
    engineType: "sawtooth",
    engineBase: 52,
    engineSlide: 2.4,
    filter: 220,
  },
  "boxy-offroader": {
    hornFreq: 196,
    hornType: "sawtooth",
    hornSeconds: 0.42,
    engineType: "square",
    engineBase: 38,
    engineSlide: 1.6,
    filter: 140,
  },
  "tall-suv": {
    hornFreq: 262,
    hornType: "triangle",
    hornSeconds: 0.34,
    engineType: "triangle",
    engineBase: 46,
    engineSlide: 1.9,
    filter: 180,
  },
  scooter: {
    hornFreq: 523,
    hornType: "square",
    hornSeconds: 0.18,
    engineType: "square",
    engineBase: 118,
    engineSlide: 6.5,
    filter: 900,
  },
  "scooter-apron": {
    hornFreq: 587,
    hornType: "triangle",
    hornSeconds: 0.22,
    engineType: "sawtooth",
    engineBase: 96,
    engineSlide: 5.4,
    filter: 720,
  },
  moped: {
    hornFreq: 698,
    hornType: "sine",
    hornSeconds: 0.16,
    engineType: "square",
    engineBase: 146,
    engineSlide: 8.2,
    filter: 1100,
  },
  "geared-bike": {
    hornFreq: 440,
    hornType: "sawtooth",
    hornSeconds: 0.2,
    engineType: "sawtooth",
    engineBase: 74,
    engineSlide: 7.1,
    filter: 480,
  },
  kavach: {
    hornFreq: 155,
    hornType: "sawtooth",
    hornSeconds: 0.48,
    engineType: "square",
    engineBase: 32,
    engineSlide: 1.1,
    filter: 110,
  },
  "police-sedan": {
    hornFreq: 311,
    hornType: "square",
    hornSeconds: 0.2,
    engineType: "sawtooth",
    engineBase: 61,
    engineSlide: 1.7,
    filter: 200,
  },
  "ambulance-van": {
    hornFreq: 233,
    hornType: "triangle",
    hornSeconds: 0.24,
    engineType: "triangle",
    engineBase: 57,
    engineSlide: 1.5,
    filter: 170,
  },
  "fire-engine": {
    hornFreq: 174,
    hornType: "sawtooth",
    hornSeconds: 0.3,
    engineType: "square",
    engineBase: 41,
    engineSlide: 1.2,
    filter: 120,
  },
};

for (const [index, body] of Object.keys(REFERENCE_CARS).entries()) {
  VEHICLE_TONES[body] = {
    ...VEHICLE_TONES[body === "sahyadri-suv" ? "tall-suv" : "compact-suv"],
    engineBase: 63 + index * 7,
    hornFreq: 370 + index * 29,
  };
}
for (const [index, body] of Object.keys(TRANSPORT_VEHICLES).entries()) {
  VEHICLE_TONES[body] = {
    ...VEHICLE_TONES["police-sedan"],
    hornFreq: 165 + index * 17,
    engineBase: 40 + index * 3,
  };
}

export function fleetBody(index) {
  if (index < STREET_FLEET.motorcycles)
    return BIKE_BODIES[index % BIKE_BODIES.length];
  const car = index - STREET_FLEET.motorcycles;
  if (car >= STREET_FLEET.cars)
    return Object.keys(TRANSPORT_VEHICLES).filter(
      (id) => TRANSPORT_VEHICLES[id].kind === "bus",
    )[(car - STREET_FLEET.cars) % 3];
  // Five everyday cars for each special car. Rotate every design across cycles.
  if (car % 6 === 5) return Object.keys(SUPERCARS)[Math.floor(car / 6) % 5];
  return Object.keys(NORMAL_CARS)[(car - Math.floor(car / 6)) % 5];
}

export function distanceGain(distance, reach = 46) {
  if (!(distance >= 0) || distance >= reach) return 0;
  const t = 1 - distance / reach;
  return t * t;
}

export const CAR_ENTER_RANGE = 7;

// The nearest car within range. Motorcycles and anything farther are ignored.
export function nearestCar(origin, cars, range = CAR_ENTER_RANGE) {
  const ox = Number(origin?.x) || 0;
  const oz = Number(origin?.z) || 0;
  let best = null;
  for (const car of cars || []) {
    if (car?.kind !== "car") continue;
    const x = Number(car.x);
    const z = Number(car.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const distance = Math.hypot(ox - x, oz - z);
    if (distance <= range && (!best || distance < best.distance))
      best = { id: car.id, distance, x, z };
  }
  return best;
}

function builder(color) {
  const g = new THREE.Group();
  const mat = (c, rough = 0.48, metal = 0.28) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: rough,
      metalness: metal,
    });
  const paint = mat(color, 0.42, 0.35);
  const dark = mat(0x1c1c1c, 0.9, 0.05);
  const metal = mat(0x8a8f92, 0.35, 0.6);
  const glass = mat(0x24383c, 0.15, 0.1);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff3cc,
    emissive: 0xffd27a,
    emissiveIntensity: 2.6,
    roughness: 0.28,
  });
  const add = (geo, material, x, y, z, parent = g) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w, h, d, material, x, y, z, name) => {
    const mesh = add(new THREE.BoxGeometry(w, h, d), material, x, y, z);
    if (name) mesh.name = name;
    return mesh;
  };
  const lamp = (w, h, d, x, y, z) => box(w, h, d, lampMat, x, y, z, "lamp");
  const round = (w, h, d, material, x, y, z, radius = 0.14, name) => {
    const mesh = add(
      new RoundedBoxGeometry(w, h, d, 3, radius),
      material,
      x,
      y,
      z,
    );
    if (name) mesh.name = name;
    return mesh;
  };
  const blob = (w, h, d, material, x, y, z, name) => {
    const mesh = add(new THREE.SphereGeometry(0.5, 16, 12), material, x, y, z);
    mesh.scale.set(w, h, d);
    if (name) mesh.name = name;
    return mesh;
  };
  const wheel = (x, z, radius) => {
    const hub = new THREE.Group();
    hub.position.set(x, radius, z);
    g.add(hub);
    const tire = add(
      new THREE.CylinderGeometry(radius, radius, 0.2, 12),
      dark,
      0,
      0,
      0,
      hub,
    );
    tire.rotation.z = Math.PI / 2;
    const rim = add(
      new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, 0.22, 8),
      metal,
      0,
      0,
      0,
      hub,
    );
    rim.rotation.z = Math.PI / 2;
    return hub;
  };
  const beacons = [];
  const glow = (w, h, d, color, x, y, z) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.12,
      roughness: 0.32,
    });
    const mesh = add(new THREE.BoxGeometry(w, h, d), material, x, y, z);
    mesh.name = "beacon";
    beacons.push(mesh);
    return mesh;
  };
  return {
    g,
    add,
    box,
    lamp,
    round,
    blob,
    wheel,
    paint,
    dark,
    metal,
    glass,
    glow,
    beacons,
  };
}

function finish(g, body, exhaust) {
  g.userData.body = body;
  g.userData.label = BODY_LABELS[body];
  g.userData.kind =
    SERVICE_KIND[body] || (CAR_BODIES.includes(body) ? "car" : "motorcycle");
  g.userData.exhaust = exhaust;
  g.userData.tone = VEHICLE_TONES[body];
  if (SERVICE_KIND[body]) g.userData.siren = SIREN_TONES[SERVICE_KIND[body]];
  return g;
}

function scooter(color, apronWidth, lengthScale, body) {
  const { g, add, lamp, blob, wheel, paint, dark } = builder(color);
  const front = wheel(0, -0.72 * lengthScale, 0.24);
  const rear = wheel(0, 0.62 * lengthScale, 0.24);
  add(
    new THREE.CylinderGeometry(0.035, 0.04, 1.15 * lengthScale, 8),
    dark,
    0,
    0.36,
    -0.05,
  ).rotation.x = Math.PI / 2;
  blob(0.32, 0.1, 0.5 * lengthScale, dark, 0, 0.42, 0.12 * lengthScale);
  blob(apronWidth, 0.52, 0.36, paint, 0, 0.72, -0.58 * lengthScale, "apron");
  blob(0.24, 0.16, 0.32, paint, 0, 0.58, 0.28 * lengthScale);
  lamp(apronWidth * 0.4, 0.08, 0.04, 0, 0.78, -0.74 * lengthScale);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), dark, 0, 0.98, -0.32);
  add(new THREE.BoxGeometry(0.42, 0.03, 0.05), dark, 0, 1.12, -0.28);
  const rider = new THREE.Group();
  rider.position.set(0, 0.62, 0.12);
  g.add(rider);
  add(new THREE.SphereGeometry(0.16, 10, 8), dark, 0, 0.22, 0, rider).scale.set(
    1.1,
    1.3,
    0.8,
  );
  add(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd6b08a, roughness: 0.8 }),
    0,
    0.48,
    0,
    rider,
  );
  g.userData.wheels = [front, rear];
  g.userData.apron = apronWidth;
  return finish(g, body, [0.12, 0.32, 0.78 * lengthScale]);
}

function moped(color) {
  const { g, add, box, blob, wheel, paint, dark } = builder(color);
  const front = wheel(0, -0.55, 0.18);
  const rear = wheel(0, 0.48, 0.18);
  add(
    new THREE.CylinderGeometry(0.025, 0.03, 0.95, 8),
    dark,
    0,
    0.28,
    -0.02,
  ).rotation.x = Math.PI / 2;
  blob(0.18, 0.12, 0.28, paint, 0, 0.4, -0.12, "hood");
  blob(0.16, 0.08, 0.22, dark, 0, 0.36, 0.22);
  add(new THREE.BoxGeometry(0.28, 0.025, 0.05), dark, 0, 0.72, -0.22);
  const rider = new THREE.Group();
  rider.position.set(0, 0.48, 0.08);
  g.add(rider);
  add(new THREE.SphereGeometry(0.12, 8, 6), dark, 0, 0.18, 0, rider).scale.set(
    1,
    1.4,
    0.75,
  );
  add(
    new THREE.SphereGeometry(0.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xe2b890, roughness: 0.8 }),
    0,
    0.4,
    0,
    rider,
  );
  g.userData.wheels = [front, rear];
  return finish(g, "moped", [0.08, 0.24, 0.62]);
}

function gearedBike(color) {
  const { g, add, box, wheel, paint, dark, metal } = builder(color);
  const front = wheel(0, -0.78, 0.32);
  const rear = wheel(0, 0.72, 0.32);
  add(
    new THREE.CylinderGeometry(0.04, 0.045, 1.45, 8),
    dark,
    0,
    0.42,
    -0.02,
  ).rotation.x = Math.PI / 2;
  const tank = add(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.02, -0.22),
        new THREE.Vector2(0.09, -0.14),
        new THREE.Vector2(0.15, 0.02),
        new THREE.Vector2(0.12, 0.14),
        new THREE.Vector2(0.04, 0.22),
      ],
      14,
    ),
    paint,
    0,
    0.74,
    -0.18,
  );
  tank.rotation.x = Math.PI / 2;
  tank.name = "tank";
  const engine = add(
    new THREE.SphereGeometry(0.14, 10, 8),
    metal,
    0.02,
    0.4,
    0.08,
  );
  engine.scale.set(1.1, 0.85, 1.3);
  engine.name = "engine-block";
  add(new THREE.SphereGeometry(0.1, 8, 6), dark, 0, 0.68, 0.38).scale.set(
    1.1,
    0.4,
    1.3,
  );
  add(
    new THREE.CylinderGeometry(0.04, 0.045, 0.55, 8),
    metal,
    0.16,
    0.32,
    0.35,
  ).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.5, 0.03, 0.04), dark, 0, 0.98, -0.48);
  const rider = new THREE.Group();
  rider.position.set(0, 0.72, 0.18);
  g.add(rider);
  add(new THREE.SphereGeometry(0.16, 10, 8), dark, 0, 0.22, 0, rider).scale.set(
    1.15,
    1.35,
    0.75,
  );
  add(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd4a87c, roughness: 0.8 }),
    0,
    0.5,
    0,
    rider,
  );
  g.userData.wheels = [front, rear];
  g.userData.tank = true;
  return finish(g, "geared-bike", [0.16, 0.32, 0.95]);
}

// Original tracked carrier. A squat hull and stub barrel, not a copy of a service vehicle.
export function makeArmoredCarrier(color = 0x4e5a38) {
  const { g, add, box, round, wheel, paint, dark, metal } = builder(color);
  const wheels = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i += 1)
      wheels.push(wheel(side * 1.05, -1.35 + i * 0.67, 0.28));
    box(0.32, 0.5, 3.55, dark, side * 1.08, 0.4, 0);
  }
  round(1.9, 0.62, 3.7, paint, 0, 0.78, 0.05, 0.08, "hull");
  const nose = box(1.65, 0.38, 0.95, paint, 0, 0.92, -1.85);
  nose.rotation.x = -0.42;
  nose.name = "nose";
  const turret = add(
    new THREE.CylinderGeometry(0.58, 0.68, 0.46, 12),
    paint,
    0,
    1.26,
    0.2,
  );
  turret.name = "turret";
  const barrel = add(
    new THREE.CylinderGeometry(0.08, 0.1, 1.15, 8),
    metal,
    0,
    1.3,
    -0.95,
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.name = "barrel";
  box(0.55, 0.1, 0.14, dark, 0, 0.52, 1.95);
  g.userData.wheels = wheels;
  g.userData.body = "kavach";
  g.userData.label = "Kavach Carrier";
  g.userData.kind = "armor";
  g.userData.exhaust = [0.72, 0.82, 1.85];
  g.userData.tone = VEHICLE_TONES.kavach;
  return g;
}

function paintOf(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.2,
  });
}

function ambulanceVan() {
  const { g, box, round, blob, wheel, paint, glass, dark, glow, beacons } =
    builder(0xf7f4ee);
  const red = paintOf(0xc0392b);
  const wheels = [
    wheel(-0.9, -1.55, 0.4),
    wheel(0.9, -1.55, 0.4),
    wheel(-0.9, 1.35, 0.4),
    wheel(0.9, 1.35, 0.4),
  ];
  round(1.92, 0.5, 4.7, paint, 0, 0.68, 0.05, 0.12);
  blob(1.5, 0.32, 1.15, paint, 0, 0.95, -1.55, "hood");
  round(1.7, 0.7, 1.35, paint, 0, 1.28, -1.15, 0.12, "cab");
  round(1.2, 0.4, 0.9, glass, 0, 1.32, -1.2, 0.06);
  round(1.86, 1.15, 2.45, paint, 0, 1.48, 0.72, 0.1, "patient-box");
  for (const x of [-0.96, 0.96]) {
    const upright = box(0.08, 0.46, 0.04, red, x, 1.45, 0.55);
    upright.name = "cross";
    const arm = box(0.32, 0.08, 0.04, red, x, 1.45, 0.55);
    arm.name = "cross";
  }
  const rearPost = box(0.08, 0.42, 0.04, red, 0, 1.5, 1.96);
  rearPost.name = "cross";
  const rearArm = box(0.32, 0.08, 0.04, red, 0, 1.5, 1.96);
  rearArm.name = "cross";
  box(0.86, 0.1, 0.36, dark, 0, 2.16, 0.55);
  glow(0.2, 0.1, 0.16, 0xe0a040, -0.22, 2.26, 0.55);
  glow(0.2, 0.1, 0.16, 0xc4473a, 0.22, 2.26, 0.55);
  box(0.4, 0.1, 0.03, glass, 0, 0.78, -2.35);
  g.userData.wheels = wheels;
  g.userData.beacons = beacons;
  return finish(g, "ambulance-van", [0.7, 0.48, 2.4]);
}

function fireEngine() {
  const {
    g,
    add,
    box,
    round,
    blob,
    wheel,
    paint,
    glass,
    dark,
    metal,
    glow,
    beacons,
  } = builder(0x9e2d24);
  const stripe = paintOf(0xe6c15a);
  const wheels = [
    wheel(-0.98, -1.7, 0.46),
    wheel(0.98, -1.7, 0.46),
    wheel(-0.98, 1.15, 0.46),
    wheel(0.98, 1.15, 0.46),
  ];
  round(2.05, 0.58, 5.15, paint, 0, 0.78, 0.1, 0.1);
  blob(1.6, 0.36, 1.25, paint, 0, 1.05, -1.7, "hood");
  round(1.82, 0.85, 1.45, paint, 0, 1.48, -1.25, 0.1, "cab");
  round(1.28, 0.46, 0.95, glass, 0, 1.52, -1.28, 0.06);
  round(1.96, 1.05, 2.7, paint, 0, 1.45, 0.85, 0.08, "body");
  box(1.9, 0.08, 4.4, stripe, 0, 0.95, 0.15);
  for (const x of [-0.32, 0.32]) {
    const rail = add(
      new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8),
      metal,
      x,
      2.15,
      0.7,
    );
    rail.rotation.x = Math.PI / 2;
    rail.name = "ladder";
  }
  for (let z = -0.35; z <= 1.75; z += 0.42) {
    const rung = box(0.64, 0.03, 0.04, metal, 0, 2.12, z);
    rung.name = "ladder";
  }
  const hose = add(
    new THREE.CylinderGeometry(0.22, 0.22, 0.16, 12),
    dark,
    1.08,
    1.25,
    0.4,
  );
  hose.rotation.z = Math.PI / 2;
  hose.name = "hose";
  box(0.9, 0.1, 0.4, dark, 0, 2.05, -1.15);
  glow(0.22, 0.12, 0.18, 0xe0a040, -0.24, 2.18, -1.15);
  glow(0.22, 0.12, 0.18, 0xf4f1ea, 0.24, 2.18, -1.15);
  box(0.5, 0.1, 0.04, glass, 0, 0.85, -2.55);
  g.userData.wheels = wheels;
  g.userData.beacons = beacons;
  return finish(g, "fire-engine", [0.72, 0.55, 2.65]);
}

export function makeVehicle(body, color = 0xe5d6ae) {
  body = LEGACY_CAR_REPLACEMENTS[body] || body;
  if (BLENDER_VEHICLES[body]) {
    const root = new THREE.Group();
    finish(root, body, [0.6, 0.36, 2.45]);
    root.userData.kind = BLENDER_VEHICLES[body].kind || "car";
    root.userData.tier = BLENDER_VEHICLES[body].tier || "transport";
    root.userData.length = BLENDER_VEHICLES[body].length || 4.7;
    root.userData.beacons = [];
    root.userData.assetFile = `/assets/pune-originals/${body}.glb`;
    return attachVehicleAsset(root, body);
  }
  if (body === "scooter") return scooter(color, 0.34, 1, "scooter");
  if (body === "scooter-apron")
    return scooter(color, 0.62, 1.12, "scooter-apron");
  if (body === "moped") return moped(color);
  if (body === "geared-bike") return gearedBike(color);
  if (body === "ambulance-van") return ambulanceVan();
  if (body === "fire-engine") return fireEngine();
  return makeVehicle("city-hatch", color);
}

export function makeMotorcycle(color = 0xb4332a, riderSkin = 0xd6b08a) {
  const bike = makeVehicle("geared-bike", color);
  bike.userData.riderSkin = riderSkin;
  return bike;
}
