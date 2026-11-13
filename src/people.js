import * as THREE from "three";

export const WALK_SPEED = 1.75;
export const RUN_SPEED = 6.8;
export const JUMP_SPEED = 4.5;

// Light-medium wheatish. Everyday shirts, kurtas, and sarees.
// Students, shop workers, and older neighbours. Ordinary given names.
export const RESIDENTS = [
  { name: "Asha", kind: "student", gender: "woman", garment: "shirt", height: 1.62, skin: 0xe2b890, hair: 0x1c1614, top: 0xf4f6f8, bottom: 0x3d4d68 },
  { name: "Rohan", kind: "student", gender: "man", garment: "shirt", height: 1.76, skin: 0xd6b08a, hair: 0x2b2420, top: 0x3d6b8c, bottom: 0x2c3344 },
  { name: "Meera", kind: "student", gender: "woman", garment: "kurta", height: 1.6, skin: 0xe8c4a2, hair: 0x241c18, top: 0xc4493a, bottom: 0xf3eadc },
  { name: "Suresh", kind: "shop", gender: "man", garment: "shirt", height: 1.7, skin: 0xd4a87c, hair: 0x3a3028, top: 0xf7f3ea, bottom: 0x4a4038 },
  { name: "Priya", kind: "shop", gender: "woman", garment: "saree", height: 1.56, skin: 0xe0bc96, hair: 0x2a201c, top: 0x8d2f3a, bottom: 0xd4a24a },
  { name: "Anil", kind: "shop", gender: "man", garment: "kurta", height: 1.68, skin: 0xd8b08a, hair: 0x2c241e, top: 0xf4efe4, bottom: 0xe8e2d4 },
  { name: "Kavita", kind: "older", gender: "woman", garment: "saree", height: 1.52, skin: 0xe8c4a2, hair: 0x9a9690, top: 0x7a3048, bottom: 0xc9b48a },
  { name: "Vijay", kind: "older", gender: "man", garment: "kurta", height: 1.64, skin: 0xd0a67e, hair: 0x8e8b86, top: 0xe8e2d0, bottom: 0xf0eadc },
  { name: "Nita", kind: "older", gender: "woman", garment: "kurta", height: 1.58, skin: 0xe4c0a0, hair: 0xa39e96, top: 0xf7f4ec, bottom: 0xddd6c8 },
  { name: "Sanjay", kind: "older", gender: "man", garment: "shirt", height: 1.66, skin: 0xc89870, hair: 0xa39e96, top: 0xe7eef3, bottom: 0x3e4650 },
  { name: "Lata", kind: "student", gender: "woman", garment: "saree", height: 1.59, skin: 0xe6c2a4, hair: 0x1a1412, top: 0x2f5e4c, bottom: 0xe6d7a8 },
  { name: "Prakash", kind: "shop", gender: "man", garment: "shirt", height: 1.74, skin: 0xc9a07a, hair: 0x241c18, top: 0x6e8f86, bottom: 0x2a3038 },
];

export function residentProfile(index) {
  return RESIDENTS[Math.abs(index) % RESIDENTS.length];
}

export function footPace(sprint) {
  return sprint ? RUN_SPEED : WALK_SPEED;
}

export function beginJump({ queued, y, vy }) {
  if (queued && y <= 0.05 && vy <= 0.01)
    return { vy: JUMP_SPEED, queued: false, jumped: true };
  return { vy, queued, jumped: false };
}

// On foot, mouse movement looks around without a held button.
// The expanded map and a paused game do not turn the player.
export function footLookActive({ walking, paused, overMap, draggingMap } = {}) {
  return walking === true && paused !== true && overMap !== true && draggingMap !== true;
}

// Mouse movement orbits the third-person camera. The same numbers drive the playable view.
export function orbitLook(yaw, pitch, dx, dy) {
  return {
    yaw: yaw - dx * 0.005,
    pitch: Math.max(-0.25, Math.min(0.85, pitch - dy * 0.003)),
  };
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
  const role = player ? null : { ...residentProfile(index) };
  const g = new THREE.Group(),
    skin = player ? 0xd6b08a : role.skin,
    shirt = player ? 0xe4dccc : role.top,
    pants = player ? 0x343a42 : role.bottom,
    hair = player ? 0x1b1714 : role.hair;
  g.userData.player = player;
  g.userData.skin = skin;
  g.userData.shirt = shirt;
  g.userData.name = player ? "You" : role.name;
  if (role) g.userData.role = role;
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
    role?.kind === "older" ? 0.48 : 0.55,
    0.97,
  );
  add(new THREE.CylinderGeometry(0.085, 0.09, 0.12, 8), skin, 0, 1.43, 0);
  const torso = add(
    new THREE.CylinderGeometry(0.23, 0.19, role?.garment === "kurta" ? 0.78 : 0.58, 12),
    shirt,
    0,
    role?.garment === "kurta" ? 1.02 : 1.1,
    0,
  );
  torso.scale.z = 0.65;
  if (role?.garment === "saree") {
    const skirt = add(
      new THREE.CylinderGeometry(0.2, 0.32, 0.7, 12),
      pants,
      0,
      0.48,
      0,
    );
    skirt.scale.z = 0.78;
    const pallu = add(new THREE.BoxGeometry(0.14, 0.7, 0.03), shirt, -0.12, 1.15, -0.08);
    pallu.rotation.z = -0.35;
  }
  if (role?.kind === "student")
    add(new THREE.BoxGeometry(0.28, 0.32, 0.1), 0x2c3a44, 0, 1.15, 0.16);
  if (role?.kind === "shop")
    add(new THREE.BoxGeometry(0.34, 0.42, 0.04), 0xe7e1d2, 0, 1.05, -0.16);
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
    // Left arm moves with the right leg, and the right arm with the left leg.
    legs[0].rotation.x = swing * hip;
    legs[1].rotation.x = -swing * hip;
    knees[0].rotation.x = -Math.max(0, swing) * knee;
    knees[1].rotation.x = -Math.max(0, -swing) * knee;
    arms[0].rotation.x = -swing * arm;
    arms[1].rotation.x = swing * arm;
  };
  g.userData.pose = () => ({
    leftLeg: legs[0].rotation.x,
    rightLeg: legs[1].rotation.x,
    leftArm: arms[0].rotation.x,
    rightArm: arms[1].rotation.x,
    leftArmZ: arms[0].rotation.z,
    rightArmZ: arms[1].rotation.z,
  });
  if (role) g.scale.setScalar(role.height / 1.72);
  g.userData.walk(0, 0);
  return g;
}
