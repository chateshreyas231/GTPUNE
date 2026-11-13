import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Two-wheelers outnumber cars by 4 to 1. Bodies are original meshes.
export const STREET_FLEET = { cars: 12, motorcycles: 48 };

export const CAR_BODIES = ["compact-suv", "boxy-offroader", "tall-suv"];
export const BIKE_BODIES = ["scooter", "scooter-apron", "moped", "geared-bike"];

export const BODY_LABELS = {
  "compact-suv": "Compact SUV",
  "boxy-offroader": "Boxy Off-roader",
  "tall-suv": "Tall SUV",
  scooter: "Scooter",
  "scooter-apron": "Scooter",
  moped: "Moped",
  "geared-bike": "Geared Bike",
};

// One short synthesized horn and one engine tone per body. Not a recording.
export const VEHICLE_TONES = {
  "compact-suv": { hornFreq: 349, hornType: "square", hornSeconds: 0.28, engineType: "sawtooth", engineBase: 52, engineSlide: 2.4, filter: 220 },
  "boxy-offroader": { hornFreq: 196, hornType: "sawtooth", hornSeconds: 0.42, engineType: "square", engineBase: 38, engineSlide: 1.6, filter: 140 },
  "tall-suv": { hornFreq: 262, hornType: "triangle", hornSeconds: 0.34, engineType: "triangle", engineBase: 46, engineSlide: 1.9, filter: 180 },
  scooter: { hornFreq: 523, hornType: "square", hornSeconds: 0.18, engineType: "square", engineBase: 118, engineSlide: 6.5, filter: 900 },
  "scooter-apron": { hornFreq: 587, hornType: "triangle", hornSeconds: 0.22, engineType: "sawtooth", engineBase: 96, engineSlide: 5.4, filter: 720 },
  moped: { hornFreq: 698, hornType: "sine", hornSeconds: 0.16, engineType: "square", engineBase: 146, engineSlide: 8.2, filter: 1100 },
  "geared-bike": { hornFreq: 440, hornType: "sawtooth", hornSeconds: 0.2, engineType: "sawtooth", engineBase: 74, engineSlide: 7.1, filter: 480 },
  kavach: { hornFreq: 155, hornType: "sawtooth", hornSeconds: 0.48, engineType: "square", engineBase: 32, engineSlide: 1.1, filter: 110 },
};

export function fleetBody(index) {
  if (index < STREET_FLEET.motorcycles)
    return BIKE_BODIES[index % BIKE_BODIES.length];
  return CAR_BODIES[(index - STREET_FLEET.motorcycles) % CAR_BODIES.length];
}

export function distanceGain(distance, reach = 46) {
  if (!(distance >= 0) || distance >= reach) return 0;
  const t = 1 - distance / reach;
  return t * t;
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
  const add = (geo, material, x, y, z, parent = g) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w, h, d, material, x, y, z) =>
    add(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const round = (w, h, d, material, x, y, z, radius = 0.14, name) => {
    const mesh = add(new RoundedBoxGeometry(w, h, d, 3, radius), material, x, y, z);
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
  return { g, add, box, round, blob, wheel, paint, dark, metal, glass };
}

function finish(g, body, exhaust) {
  g.userData.body = body;
  g.userData.label = BODY_LABELS[body];
  g.userData.kind = CAR_BODIES.includes(body) ? "car" : "motorcycle";
  g.userData.exhaust = exhaust;
  g.userData.tone = VEHICLE_TONES[body];
  return g;
}

function compactSuv(color) {
  const { g, box, round, blob, wheel, paint, glass, dark } = builder(color);
  const wheels = [
    wheel(-0.78, -1.35, 0.38),
    wheel(0.78, -1.35, 0.38),
    wheel(-0.78, 1.4, 0.38),
    wheel(0.78, 1.4, 0.38),
  ];
  round(1.72, 0.46, 3.55, paint, 0, 0.62, 0, 0.2);
  blob(1.32, 0.26, 1.15, paint, 0, 0.78, -1.28, "hood");
  round(1.46, 0.5, 1.65, paint, 0, 1.02, 0.28, 0.18, "roof");
  round(1.12, 0.3, 1.2, glass, 0, 1.05, 0.22, 0.08);
  for (const [x, z] of [
    [-0.78, -1.3],
    [0.78, -1.3],
    [-0.78, 1.25],
    [0.78, 1.25],
  ])
    blob(0.52, 0.2, 0.68, paint, x, 0.58, z, "fender");
  box(0.34, 0.08, 0.03, glass, -0.42, 0.68, -1.76);
  box(0.34, 0.08, 0.03, glass, 0.42, 0.68, -1.76);
  box(0.32, 0.08, 0.02, dark, 0, 0.46, -1.8);
  g.userData.wheels = wheels;
  return finish(g, "compact-suv", [0.55, 0.42, 2.05]);
}

function boxyOffroader(color) {
  const { g, add, box, round, blob, wheel, paint, glass, dark, metal } = builder(color);
  const wheels = [
    wheel(-0.82, -1.15, 0.44),
    wheel(0.82, -1.15, 0.44),
    wheel(-0.82, 1.2, 0.44),
    wheel(0.82, 1.2, 0.44),
  ];
  round(1.68, 0.58, 2.15, paint, 0, 0.95, 0.15, 0.08);
  blob(1.4, 0.42, 1.15, paint, 0, 1.05, -1.05, "hood");
  round(1.58, 0.72, 1.7, paint, 0, 1.52, 0.15, 0.1, "roof");
  round(1.28, 0.42, 1.25, glass, 0, 1.58, 0.1, 0.06);
  for (const x of [-0.86, 0.86]) blob(0.48, 0.26, 0.78, paint, x, 0.62, -1.05, "fender");
  box(0.46, 0.12, 0.04, glass, 0, 0.82, -1.58);
  const spare = add(
    new THREE.CylinderGeometry(0.34, 0.34, 0.16, 12),
    dark,
    0,
    1.25,
    1.72,
  );
  spare.rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.22, 0.04, 6, 10), metal, 0, 1.25, 1.81);
  g.userData.wheels = wheels;
  g.userData.spare = true;
  return finish(g, "boxy-offroader", [-0.55, 0.55, 1.7]);
}

function tallSuv(color) {
  const { g, box, round, blob, wheel, paint, glass, dark } = builder(color);
  const wheels = [
    wheel(-0.86, -1.55, 0.4),
    wheel(0.86, -1.55, 0.4),
    wheel(-0.86, 1.55, 0.4),
    wheel(0.86, 1.55, 0.4),
  ];
  round(1.84, 0.5, 4.15, paint, 0, 0.68, 0, 0.2);
  blob(1.45, 0.3, 1.3, paint, 0, 0.86, -1.45, "hood");
  round(1.62, 0.78, 2.15, paint, 0, 1.28, 0.3, 0.2, "roof");
  round(1.28, 0.46, 1.6, glass, 0, 1.32, 0.22, 0.1);
  for (const x of [-0.9, 0.9]) blob(0.46, 0.24, 0.8, paint, x, 0.55, -1.45, "fender");
  box(0.38, 0.12, 0.03, dark, 0, 0.52, -2.15);
  g.userData.wheels = wheels;
  return finish(g, "tall-suv", [0.62, 0.48, 2.2]);
}

function scooter(color, apronWidth, lengthScale, body) {
  const { g, add, box, blob, wheel, paint, dark, glass } = builder(color);
  const front = wheel(0, -0.72 * lengthScale, 0.24);
  const rear = wheel(0, 0.62 * lengthScale, 0.24);
  add(new THREE.CylinderGeometry(0.035, 0.04, 1.15 * lengthScale, 8), dark, 0, 0.36, -0.05).rotation.x =
    Math.PI / 2;
  blob(0.32, 0.1, 0.5 * lengthScale, dark, 0, 0.42, 0.12 * lengthScale);
  blob(apronWidth, 0.52, 0.36, paint, 0, 0.72, -0.58 * lengthScale, "apron");
  blob(0.24, 0.16, 0.32, paint, 0, 0.58, 0.28 * lengthScale);
  const lamp = add(
    new THREE.BoxGeometry(apronWidth * 0.4, 0.08, 0.04),
    glass,
    0,
    0.78,
    -0.74 * lengthScale,
  );
  lamp.name = "lamp";
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), dark, 0, 0.98, -0.32);
  add(new THREE.BoxGeometry(0.42, 0.03, 0.05), dark, 0, 1.12, -0.28);
  const rider = new THREE.Group();
  rider.position.set(0, 0.62, 0.12);
  g.add(rider);
  add(new THREE.SphereGeometry(0.16, 10, 8), dark, 0, 0.22, 0, rider).scale.set(1.1, 1.3, 0.8);
  add(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd6b08a, roughness: 0.8 }), 0, 0.48, 0, rider);
  g.userData.wheels = [front, rear];
  g.userData.apron = apronWidth;
  return finish(g, body, [0.12, 0.32, 0.78 * lengthScale]);
}

function moped(color) {
  const { g, add, box, blob, wheel, paint, dark } = builder(color);
  const front = wheel(0, -0.55, 0.18);
  const rear = wheel(0, 0.48, 0.18);
  add(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 8), dark, 0, 0.28, -0.02).rotation.x =
    Math.PI / 2;
  blob(0.18, 0.12, 0.28, paint, 0, 0.4, -0.12, "hood");
  blob(0.16, 0.08, 0.22, dark, 0, 0.36, 0.22);
  add(new THREE.BoxGeometry(0.28, 0.025, 0.05), dark, 0, 0.72, -0.22);
  const rider = new THREE.Group();
  rider.position.set(0, 0.48, 0.08);
  g.add(rider);
  add(new THREE.SphereGeometry(0.12, 8, 6), dark, 0, 0.18, 0, rider).scale.set(1, 1.4, 0.75);
  add(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe2b890, roughness: 0.8 }), 0, 0.4, 0, rider);
  g.userData.wheels = [front, rear];
  return finish(g, "moped", [0.08, 0.24, 0.62]);
}

function gearedBike(color) {
  const { g, add, box, wheel, paint, dark, metal } = builder(color);
  const front = wheel(0, -0.78, 0.32);
  const rear = wheel(0, 0.72, 0.32);
  add(new THREE.CylinderGeometry(0.04, 0.045, 1.45, 8), dark, 0, 0.42, -0.02).rotation.x =
    Math.PI / 2;
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
  const engine = add(new THREE.SphereGeometry(0.14, 10, 8), metal, 0.02, 0.4, 0.08);
  engine.scale.set(1.1, 0.85, 1.3);
  engine.name = "engine-block";
  add(new THREE.SphereGeometry(0.1, 8, 6), dark, 0, 0.68, 0.38).scale.set(1.1, 0.4, 1.3);
  add(new THREE.CylinderGeometry(0.04, 0.045, 0.55, 8), metal, 0.16, 0.32, 0.35).rotation.x =
    Math.PI / 2;
  add(new THREE.BoxGeometry(0.5, 0.03, 0.04), dark, 0, 0.98, -0.48);
  const rider = new THREE.Group();
  rider.position.set(0, 0.72, 0.18);
  g.add(rider);
  add(new THREE.SphereGeometry(0.16, 10, 8), dark, 0, 0.22, 0, rider).scale.set(1.15, 1.35, 0.75);
  add(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd4a87c, roughness: 0.8 }), 0, 0.5, 0, rider);
  g.userData.wheels = [front, rear];
  g.userData.tank = true;
  return finish(g, "geared-bike", [0.16, 0.32, 0.95]);
}

// Original tracked carrier. A squat hull and stub barrel, not a copy of a service vehicle.
export function makeArmoredCarrier(color = 0x4e5a38) {
  const { g, add, box, round, wheel, paint, dark, metal } = builder(color);
  const wheels = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i += 1) wheels.push(wheel(side * 1.05, -1.35 + i * 0.67, 0.28));
    box(0.32, 0.5, 3.55, dark, side * 1.08, 0.4, 0);
  }
  round(1.9, 0.62, 3.7, paint, 0, 0.78, 0.05, 0.08, "hull");
  const nose = box(1.65, 0.38, 0.95, paint, 0, 0.92, -1.85);
  nose.rotation.x = -0.42;
  nose.name = "nose";
  const turret = add(new THREE.CylinderGeometry(0.58, 0.68, 0.46, 12), paint, 0, 1.26, 0.2);
  turret.name = "turret";
  const barrel = add(new THREE.CylinderGeometry(0.08, 0.1, 1.15, 8), metal, 0, 1.3, -0.95);
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

export function makeVehicle(body, color = 0xe5d6ae) {
  if (body === "compact-suv") return compactSuv(color);
  if (body === "boxy-offroader") return boxyOffroader(color);
  if (body === "tall-suv") return tallSuv(color);
  if (body === "scooter") return scooter(color, 0.34, 1, "scooter");
  if (body === "scooter-apron") return scooter(color, 0.62, 1.12, "scooter-apron");
  if (body === "moped") return moped(color);
  if (body === "geared-bike") return gearedBike(color);
  return compactSuv(color);
}

export function makeMotorcycle(color = 0xb4332a, riderSkin = 0xd6b08a) {
  const bike = makeVehicle("geared-bike", color);
  bike.userData.riderSkin = riderSkin;
  return bike;
}
