import * as THREE from "three";

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
  return { g, add, box, wheel, paint, dark, metal, glass };
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
  const { g, box, wheel, paint, glass, dark } = builder(color);
  const wheels = [
    wheel(-0.78, -1.35, 0.38),
    wheel(0.78, -1.35, 0.38),
    wheel(-0.78, 1.4, 0.38),
    wheel(0.78, 1.4, 0.38),
  ];
  box(1.78, 0.48, 4.15, paint, 0, 0.78, 0);
  box(1.55, 0.22, 1.35, paint, 0, 0.95, -1.25);
  box(1.62, 0.58, 1.9, paint, 0, 1.22, -0.05);
  box(1.4, 0.36, 1.55, glass, 0, 1.28, -0.02);
  box(1.7, 0.08, 0.12, dark, 0, 0.55, -2.05);
  g.userData.wheels = wheels;
  return finish(g, "compact-suv", [0.55, 0.42, 2.12]);
}

function boxyOffroader(color) {
  const { g, add, box, wheel, paint, glass, dark, metal } = builder(color);
  const wheels = [
    wheel(-0.82, -1.15, 0.44),
    wheel(0.82, -1.15, 0.44),
    wheel(-0.82, 1.2, 0.44),
    wheel(0.82, 1.2, 0.44),
  ];
  box(1.72, 0.62, 3.55, paint, 0, 1.02, 0);
  box(1.62, 0.78, 1.85, paint, 0, 1.62, -0.05);
  box(1.4, 0.48, 1.4, glass, 0, 1.68, -0.05);
  box(1.74, 0.08, 3.5, dark, 0, 0.68, 0);
  const spare = add(
    new THREE.CylinderGeometry(0.34, 0.34, 0.16, 12),
    dark,
    0,
    1.25,
    1.9,
  );
  spare.rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.22, 0.04, 6, 10), metal, 0, 1.25, 1.99);
  g.userData.wheels = wheels;
  g.userData.spare = true;
  return finish(g, "boxy-offroader", [-0.55, 0.55, 1.85]);
}

function tallSuv(color) {
  const { g, box, wheel, paint, glass, dark } = builder(color);
  const wheels = [
    wheel(-0.86, -1.55, 0.4),
    wheel(0.86, -1.55, 0.4),
    wheel(-0.86, 1.55, 0.4),
    wheel(0.86, 1.55, 0.4),
  ];
  box(1.9, 0.55, 4.7, paint, 0, 0.86, 0);
  box(1.78, 0.95, 2.55, paint, 0, 1.55, 0.15);
  box(1.55, 0.62, 2.15, glass, 0, 1.62, 0.1);
  box(1.84, 0.1, 0.16, dark, 0, 0.58, -2.35);
  g.userData.wheels = wheels;
  return finish(g, "tall-suv", [0.62, 0.48, 2.42]);
}

function scooter(color, apronWidth, lengthScale, body) {
  const { g, add, box, wheel, paint, dark, glass } = builder(color);
  const front = wheel(0, -0.72 * lengthScale, 0.24);
  const rear = wheel(0, 0.62 * lengthScale, 0.24);
  box(0.12, 0.08, 1.15 * lengthScale, dark, 0, 0.36, -0.05);
  box(0.28, 0.08, 0.55 * lengthScale, dark, 0, 0.42, 0.15 * lengthScale);
  box(apronWidth, 0.55, 0.28, paint, 0, 0.72, -0.62 * lengthScale);
  box(0.22, 0.16, 0.34, paint, 0, 0.58, 0.28 * lengthScale);
  const lamp = add(
    new THREE.BoxGeometry(apronWidth * 0.45, 0.1, 0.06),
    glass,
    0,
    0.78,
    -0.76 * lengthScale,
  );
  lamp.name = "apron";
  add(new THREE.BoxGeometry(0.08, 0.28, 0.06), dark, 0, 0.95, -0.35);
  add(new THREE.BoxGeometry(0.42, 0.04, 0.08), dark, 0, 1.08, -0.28);
  const rider = new THREE.Group();
  rider.position.set(0, 0.62, 0.12);
  g.add(rider);
  add(new THREE.BoxGeometry(0.28, 0.32, 0.18), dark, 0, 0.28, 0, rider);
  add(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd6b08a, roughness: 0.8 }), 0, 0.52, 0, rider);
  g.userData.wheels = [front, rear];
  g.userData.apron = apronWidth;
  return finish(g, body, [0.12, 0.32, 0.78 * lengthScale]);
}

function moped(color) {
  const { g, add, box, wheel, paint, dark } = builder(color);
  const front = wheel(0, -0.55, 0.18);
  const rear = wheel(0, 0.48, 0.18);
  box(0.08, 0.06, 0.95, dark, 0, 0.28, -0.02);
  box(0.16, 0.1, 0.22, paint, 0, 0.4, -0.15);
  box(0.14, 0.08, 0.2, dark, 0, 0.36, 0.22);
  add(new THREE.BoxGeometry(0.28, 0.03, 0.06), dark, 0, 0.72, -0.22);
  const rider = new THREE.Group();
  rider.position.set(0, 0.48, 0.08);
  g.add(rider);
  add(new THREE.BoxGeometry(0.22, 0.26, 0.14), dark, 0, 0.22, 0, rider);
  add(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe2b890, roughness: 0.8 }), 0, 0.42, 0, rider);
  g.userData.wheels = [front, rear];
  return finish(g, "moped", [0.08, 0.24, 0.62]);
}

function gearedBike(color) {
  const { g, add, box, wheel, paint, dark, metal } = builder(color);
  const front = wheel(0, -0.78, 0.32);
  const rear = wheel(0, 0.72, 0.32);
  box(0.1, 0.08, 1.45, dark, 0, 0.42, -0.02);
  const tank = box(0.28, 0.22, 0.48, paint, 0, 0.72, -0.22);
  tank.name = "tank";
  const engine = box(0.26, 0.22, 0.32, metal, 0.02, 0.4, 0.05);
  engine.name = "engine-block";
  box(0.22, 0.06, 0.28, dark, 0, 0.7, 0.38);
  add(new THREE.CylinderGeometry(0.04, 0.045, 0.55, 8), metal, 0.16, 0.32, 0.35).rotation.x =
    Math.PI / 2;
  add(new THREE.BoxGeometry(0.5, 0.04, 0.05), dark, 0, 0.95, -0.45);
  const rider = new THREE.Group();
  rider.position.set(0, 0.72, 0.18);
  g.add(rider);
  add(new THREE.BoxGeometry(0.3, 0.34, 0.18), dark, 0, 0.28, 0, rider);
  add(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd4a87c, roughness: 0.8 }), 0, 0.54, 0, rider);
  g.userData.wheels = [front, rear];
  g.userData.tank = true;
  return finish(g, "geared-bike", [0.16, 0.32, 0.95]);
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
