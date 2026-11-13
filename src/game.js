import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { interactAt } from "./missions.js";
import { emptySave, parseSave } from "./save.js";

const SAVE_KEY = "gtpune-save";
const FIXED = 1 / 60;

const places = [
  { id: "chai-stall", x: -6, z: 5.6, r: 2.5 },
  { id: "college-strip", x: -16, z: -6.2, r: 3.4 },
  { id: "bookshop", x: 10, z: 6.2, r: 2.6 },
  { id: "signal", x: 18, z: 1.2, r: 2.8 },
];

const canvas = document.querySelector("#game");
const lineEl = document.querySelector("#line");
const promptEl = document.querySelector("#prompt");
const cashEl = document.querySelector("#cash");
const weatherEl = document.querySelector("#weather");
const rideEl = document.querySelector("#ride");
const missionEl = document.querySelector("#missions");
const lookEl = document.querySelector("#look");
const statusEl = document.querySelector("#status");

const keys = new Set();
let save = loadSave();
let yaw = 0;
let pitch = 0.25;
let vy = 0;
let mode = "foot";
let honked = false;
let jumpQueued = false;
let accumulator = 0;
let lastTime = 0;

function loadSave() {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY)) ?? emptySave();
  } catch {
    return emptySave();
  }
}

function persist() {
  if (mode === "foot" && player) {
    const pos = player.body.translation();
    save.x = pos.x;
    save.y = pos.y;
    save.z = pos.z;
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // The browser kept this chapter in memory only.
  }
}

function say(text) {
  lineEl.textContent = text;
}

function progressOf() {
  return { missions: save.missions, carrying: save.carrying };
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec7ea);
scene.fog = new THREE.Fog(0x9ec7ea, 28, 95);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const sun = new THREE.DirectionalLight(0xfff1d6, 1.2);
sun.position.set(18, 28, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);
scene.add(sun.target);
const ambient = new THREE.HemisphereLight(0xc5dff5, 0x8a6a45, 0.55);
scene.add(ambient);
const lampLights = [];

const rainCount = 700;
const rainPositions = new Float32Array(rainCount * 3);
const rain = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({ color: 0xd5e4ef, size: 0.07, transparent: true, opacity: 0.65 }),
);
rain.geometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
rain.visible = false;
scene.add(rain);

let world;
let player;
let rides = [];

function box(parent, hx, hy, hz, color, x, y, z, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.86 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (opts.solid !== false) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(opts.friction ?? 0.9), body);
  }
  return mesh;
}

function sign(text, x, y, z, color, rotY = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#1c1917";
  g.font = "bold 28px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 32);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.8),
    new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(canvas),
      roughness: 0.7,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  scene.add(mesh);
  return mesh;
}

function makeTree(x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4f35 }),
  );
  trunk.position.set(x, 0.8, z);
  trunk.castShadow = true;
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.9 }),
  );
  crown.position.set(x, 2.1, z);
  crown.castShadow = true;
  scene.add(trunk, crown);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.8, z));
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.8, 0.2), body);
}

function makeLamp(x, z) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x292524 }),
  );
  pole.position.set(x, 1.6, z);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.16, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xf5e6b8, emissive: 0x000000 }),
  );
  head.position.set(x, 3.25, z);
  scene.add(pole, head);
  const light = new THREE.PointLight(0xffc56b, 0, 8, 2);
  light.position.set(x, 3.1, z);
  scene.add(light);
  lampLights.push({ head, light });
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 1.6, z));
  world.createCollider(RAPIER.ColliderDesc.cylinder(1.6, 0.08), body);
}

function makeVehicle(spec) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spec.x, spec.y, spec.z)
      .setRotation({ x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 })
      .setLinearDamping(0.25)
      .setAngularDamping(0.6)
      .setCcdEnabled(true),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(spec.hx, spec.hy, spec.hz).setDensity(spec.density).setFriction(0.5),
    body,
  );
  body.setEnabledRotations(false, true, false, true);
  const controller = world.createVehicleController(body);
  controller.indexUpAxis = 1;
  controller.setIndexForwardAxis = 2;
  const direction = { x: 0, y: -1, z: 0 };
  const axle = { x: -1, y: 0, z: 0 };
  const points = [
    { x: spec.track, y: spec.hy * -0.2, z: spec.hz * 0.72 },
    { x: -spec.track, y: spec.hy * -0.2, z: spec.hz * 0.72 },
    { x: spec.track, y: spec.hy * -0.2, z: -spec.hz * 0.72 },
    { x: -spec.track, y: spec.hy * -0.2, z: -spec.hz * 0.72 },
  ];
  for (const point of points) {
    controller.addWheel(point, direction, axle, spec.rest, spec.radius);
  }
  for (let i = 0; i < 4; i += 1) {
    controller.setWheelSuspensionStiffness(i, spec.kind === "auto" ? 48 : 36);
    controller.setWheelSuspensionCompression(i, 3.2);
    controller.setWheelSuspensionRelaxation(i, 3.4);
    controller.setWheelMaxSuspensionTravel(i, 0.22);
    controller.setWheelMaxSuspensionForce(i, spec.kind === "auto" ? 12000 : 5000);
    controller.setWheelFrictionSlip(i, 1.6);
    controller.setWheelSideFrictionStiffness(i, 0.9);
  }

  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(spec.hx * 2, spec.hy * 2, spec.hz * 2),
    new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.55 }),
  );
  shell.castShadow = true;
  group.add(shell);
  if (spec.kind === "auto") {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(spec.hx * 2.02, spec.hy * 0.35, spec.hz * 2.02),
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
    );
    group.add(stripe);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(spec.hx * 1.6, spec.hy * 0.7, spec.hz * 1.1),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }),
    );
    roof.position.y = spec.hy * 0.9;
    group.add(roof);
  }
  const wheels = points.map(() => {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.radius, spec.radius, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x1c1917 }),
    );
    wheel.rotation.z = Math.PI / 2;
    scene.add(wheel);
    return wheel;
  });
  scene.add(group);
  return { ...spec, body, collider, controller, group, wheels };
}

function buildCity() {
  box(scene, 70, 0.5, 70, 0xc4b48a, 0, -0.5, 0, { friction: 1.1 });
  box(scene, 46, 0.01, 4, 0x3e4852, 0, 0.02, 0, { solid: false });
  box(scene, 4, 0.01, 22, 0x3e4852, 20, 0.02, 0, { solid: false });
  box(scene, 50, 0.09, 2.1, 0xd5c4a1, 0, 0.09, -6.2);
  box(scene, 50, 0.09, 2.1, 0xd5c4a1, 0, 0.09, 6.2);

  const blocks = [
    [-30, -14, 6, 4, 4.5, 0x6b5142],
    [-16, -14, 5.5, 4, 5.5, 0x5c4638],
    [-2, -14, 6, 4, 4, 0x6b5142],
    [14, -14, 7, 4, 5, 0x4e4338],
    [-28, 15, 5, 4, 3.5, 0x7a5b46],
    [28, 16, 6, 4, 6, 0x5a4638],
    [10, 13, 4, 3, 2.6, 0x1e3a5f],
  ];
  for (const [x, z, hx, hz, h, color] of blocks) {
    box(scene, hx, h, hz, color, x, h, z);
  }

  box(scene, 1.1, 1.2, 1, 0x9a3412, -6, 1.2, 7.6);
  sign("CHAI", -6, 2.6, 6.5, "#fdba74");
  sign("COLLEGE STRIP", -16, 6.2, -9.7, "#f3e6c8");
  sign("BOOKS", 10, 4.2, 9.6, "#dbeafe");

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x292524 }),
  );
  pole.position.set(16.4, 1.7, -2.2);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d }),
  );
  lamp.position.set(16.4, 3.4, -2.2);
  scene.add(pole, lamp);
  const signalBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(16.4, 1.7, -2.2));
  world.createCollider(RAPIER.ColliderDesc.cylinder(1.7, 0.1), signalBody);

  for (const [x, z] of [[-24, 10], [-18, -3], [2, 10], [26, -8], [32, 8], [-36, 4]]) makeTree(x, z);
  for (const [x, z] of [[-10, -4.2], [8, -4.2], [24, 4.2], [-20, 4.2]]) makeLamp(x, z);

  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.12, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x7c4a32 }),
  );
  bench.position.set(-2, 0.45, 5.4);
  scene.add(bench);
}

function makePlayer(x, y, z) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z),
  );
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.42, 0.28), body);
  const controller = world.createCharacterController(0.03);
  controller.enableSnapToGround(0.28);
  controller.enableAutostep(0.35, 0.18, true);
  controller.setSlideEnabled(true);
  const mesh = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x0f766e }),
  );
  torso.castShadow = true;
  const bag = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.28, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x92400e }),
  );
  bag.position.set(0.22, 0.1, -0.12);
  mesh.add(torso, bag);
  scene.add(mesh);
  return { body, collider, controller, mesh };
}

function nearestPlace(position) {
  return places.find((place) => Math.hypot(place.x - position.x, place.z - position.z) <= place.r) ?? null;
}

function nearestRide(position) {
  let best = null;
  for (const ride of rides) {
    const pos = ride.body.translation();
    const distance = Math.hypot(pos.x - position.x, pos.z - position.z);
    if (distance < 3.2 && (!best || distance < best.distance)) best = { ride, distance };
  }
  return best;
}

function applyWeather() {
  const night = save.night;
  sun.intensity = night ? 0.08 : save.rain ? 0.55 : 1.25;
  ambient.intensity = night ? 0.18 : 0.55;
  const sky = night ? 0x101722 : save.rain ? 0x6e7d8a : 0x9ec7ea;
  scene.background.set(sky);
  scene.fog.color.set(sky);
  scene.fog.near = save.rain ? 16 : 28;
  scene.fog.far = save.rain ? 55 : 95;
  rain.visible = save.rain;
  for (const lamp of lampLights) {
    lamp.light.intensity = night ? 2.2 : 0;
    lamp.head.material.emissive.set(night ? 0xf5c56b : 0x000000);
  }
  weatherEl.textContent = `${night ? "Night" : "Day"}${save.rain ? " · Rain" : ""}`;
}

function refreshHud() {
  cashEl.textContent = `₹${save.cash}`;
  rideEl.textContent = mode === "foot" ? "On foot" : mode === "scooter" ? "Old scooter" : "Auto";
  missionEl.replaceChildren();
  for (const mission of save.missions) {
    const item = document.createElement("li");
    item.textContent = `${mission.title} — ${mission.status}`;
    missionEl.appendChild(item);
  }
  const here = mode === "foot" ? player.body.translation() : rides.find((ride) => ride.id === mode).body.translation();
  const place = nearestPlace(here);
  const ride = mode === "foot" ? nearestRide(here) : null;
  if (place && mode === "foot") promptEl.textContent = "E interact";
  else if (ride) promptEl.textContent = `F enter ${ride.ride.name}`;
  else if (mode !== "foot") promptEl.textContent = "F step off · H horn";
  else promptEl.textContent = "";
}

function onInteract() {
  if (mode !== "foot") return;
  const position = player.body.translation();
  const place = nearestPlace(position);
  if (!place) {
    say("Nothing here but the road.");
    return;
  }
  const outcome = interactAt(progressOf(), place.id);
  save.missions = outcome.progress.missions;
  save.carrying = outcome.progress.carrying;
  if (outcome.pay) save.cash += outcome.pay;
  if (outcome.line) say(outcome.line);
  persist();
}

function enterOrExit() {
  if (mode !== "foot") {
    const ride = rides.find((item) => item.id === mode);
    const pos = ride.body.translation();
    player.collider.setEnabled(true);
    player.body.setNextKinematicTranslation({ x: pos.x + 1.8, y: pos.y + 0.4, z: pos.z });
    mode = "foot";
    player.mesh.visible = true;
    vy = 0;
    say("You step off.");
    persist();
    return;
  }
  const position = player.body.translation();
  const near = nearestRide(position);
  if (!near) {
    say("No scooter or auto within reach.");
    return;
  }
  mode = near.ride.id;
  player.collider.setEnabled(false);
  player.mesh.visible = false;
  say(near.ride.id === "scooter"
    ? "The old scooter coughs, then agrees."
    : "The auto smells like vinyl and dust.");
  persist();
}

function horn() {
  if (mode === "foot") {
    say("The horn is on the scooter and the auto.");
    return;
  }
  honked = true;
  say(mode === "scooter" ? "The scooter horn is a short, rude sentence." : "The auto horn clears a little of the lane.");
  const context = new AudioContext();
  const now = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "square";
  osc.frequency.value = mode === "scooter" ? 220 : 160;
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain).connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

function stepFoot(dt) {
  const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7.4 : 4.2;
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  let x = 0;
  let z = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) { x += forwardX; z += forwardZ; }
  if (keys.has("KeyS") || keys.has("ArrowDown")) { x -= forwardX; z -= forwardZ; }
  if (keys.has("KeyD") || keys.has("ArrowRight")) { x += rightX; z += rightZ; }
  if (keys.has("KeyA") || keys.has("ArrowLeft")) { x -= rightX; z -= rightZ; }
  const length = Math.hypot(x, z) || 1;
  const grounded = player.controller.computedGrounded();
  if (jumpQueued && grounded && vy <= 0) {
    vy = 6.4;
    jumpQueued = false;
  }
  vy += -22 * dt;
  if (vy < -25) vy = -25;
  if (vy > 0) player.controller.disableSnapToGround();
  else player.controller.enableSnapToGround(0.28);
  player.controller.computeColliderMovement(player.collider, {
    x: (x / length) * (x === 0 && z === 0 ? 0 : speed) * dt,
    y: vy * dt,
    z: (z / length) * (x === 0 && z === 0 ? 0 : speed) * dt,
  });
  const movement = player.controller.computedMovement();
  const pos = player.body.translation();
  player.body.setNextKinematicTranslation({
    x: pos.x + movement.x,
    y: pos.y + movement.y,
    z: pos.z + movement.z,
  });
  if (player.controller.computedGrounded() && vy < 0) vy = 0;
}

function stepDrive(ride) {
  let force = 0;
  const engine = ride.id === "scooter" ? 700 : 1400;
  const reverse = ride.id === "scooter" ? 400 : 800;
  if (keys.has("KeyW") || keys.has("ArrowUp")) force = engine;
  if (keys.has("KeyS") || keys.has("ArrowDown")) force = -reverse;
  const steer = (keys.has("KeyA") || keys.has("ArrowLeft") ? 0.42 : 0)
    + (keys.has("KeyD") || keys.has("ArrowRight") ? -0.42 : 0);
  for (let i = 0; i < 4; i += 1) {
    ride.controller.setWheelBrake(i, force === 0 ? 6 : 0);
    ride.controller.setWheelEngineForce(i, i >= 2 ? force : 0);
    ride.controller.setWheelSteering(i, i < 2 ? steer : 0);
  }
}

function park(ride) {
  for (let i = 0; i < 4; i += 1) {
    ride.controller.setWheelEngineForce(i, 0);
    ride.controller.setWheelBrake(i, 18);
    ride.controller.setWheelSteering(i, 0);
  }
}

function syncRide(ride) {
  const pos = ride.body.translation();
  const rot = ride.body.rotation();
  ride.group.position.set(pos.x, pos.y, pos.z);
  ride.group.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  for (let i = 0; i < ride.wheels.length; i += 1) {
    const hard = ride.controller.wheelHardPoint(i);
    const length = ride.controller.wheelSuspensionLength(i) ?? ride.rest;
    if (!hard) continue;
    ride.wheels[i].position.set(hard.x, hard.y - length, hard.z);
    ride.wheels[i].quaternion.copy(ride.group.quaternion);
    ride.wheels[i].rotateY(ride.controller.wheelSteering(i) ?? 0);
    ride.wheels[i].rotateX(ride.controller.wheelRotation(i) ?? 0);
  }
}

function frameCamera() {
  const target = mode === "foot" ? player.body.translation() : rides.find((ride) => ride.id === mode).body.translation();
  const distance = mode === "foot" ? 7.4 : 10;
  const lookHeight = mode === "foot" ? 1.5 : 1.8;
  const cosPitch = Math.cos(pitch);
  camera.position.set(
    target.x + Math.sin(yaw) * distance * cosPitch,
    target.y + lookHeight + Math.sin(pitch) * distance,
    target.z + Math.cos(yaw) * distance * cosPitch,
  );
  camera.lookAt(target.x, target.y + lookHeight * 0.6, target.z);
}

function stepRain() {
  if (!save.rain) return;
  const focus = mode === "foot" ? player.body.translation() : rides.find((ride) => ride.id === mode).body.translation();
  const positions = rain.geometry.attributes.position;
  for (let i = 0; i < rainCount; i += 1) {
    let y = positions.getY(i) - 0.45;
    if (y < focus.y - 2 || positions.getY(i) === 0) {
      positions.setXYZ(
        i,
        focus.x + (Math.random() - 0.5) * 24,
        focus.y + 8 + Math.random() * 8,
        focus.z + (Math.random() - 0.5) * 24,
      );
    } else {
      positions.setY(i, y);
    }
  }
  positions.needsUpdate = true;
}

function physics(dt) {
  if (mode === "foot") stepFoot(dt);
  for (const ride of rides) {
    if (ride.id === mode) stepDrive(ride);
    else park(ride);
    ride.controller.updateVehicle(dt, undefined, undefined, (collider) => collider.handle !== ride.collider.handle);
  }
  world.step();
  const pos = player.body.translation();
  player.mesh.position.set(pos.x, pos.y, pos.z);
  player.mesh.rotation.y = yaw;
  for (const ride of rides) syncRide(ride);
}

function publish() {
  const pos = mode === "foot" ? player.body.translation() : rides.find((ride) => ride.id === mode).body.translation();
  globalThis.__gtpune = () => ({
    ready: true,
    x: pos.x,
    y: pos.y,
    z: pos.z,
    mode,
    night: save.night,
    rain: save.rain,
    cash: save.cash,
    carrying: save.carrying,
    line: lineEl.textContent,
    honked,
    contacts: rides.map((ride) => {
      let count = 0;
      for (let i = 0; i < 4; i += 1) if (ride.controller.wheelIsInContact(i)) count += 1;
      const pos = ride.body.translation();
      return { id: ride.id, count, x: pos.x, y: pos.y, z: pos.z };
    }),
    missions: save.missions.map((mission) => ({ id: mission.id, status: mission.status })),
  });
}

function loop(now) {
  const dt = Math.min(0.25, (now - lastTime) / 1000 || FIXED);
  lastTime = now;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED && steps < 15) {
    physics(FIXED);
    accumulator -= FIXED;
    steps += 1;
  }
  accumulator = Math.min(accumulator, FIXED);
  stepRain();
  frameCamera();
  refreshHud();
  publish();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function resize() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}

function boot() {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED;
  buildCity();
  player = makePlayer(save.x, save.y, save.z);
  rides = [
    makeVehicle({
      id: "scooter",
      name: "scooter",
      kind: "scooter",
      x: -11,
      y: 0.55,
      z: 1.2,
      hx: 0.32,
      hy: 0.32,
      hz: 0.85,
      track: 0.22,
      rest: 0.16,
      radius: 0.26,
      density: 180,
      color: 0xf8fafc,
    }),
    makeVehicle({
      id: "auto",
      name: "auto",
      kind: "auto",
      x: 6,
      y: 0.72,
      z: 1.2,
      hx: 0.7,
      hy: 0.55,
      hz: 1.15,
      track: 0.62,
      rest: 0.18,
      radius: 0.32,
      density: 90,
      color: 0xf5c518,
    }),
  ];
  player.controller.computeColliderMovement(player.collider, { x: 0, y: -0.05, z: 0 });
  for (let i = 0; i < 20; i += 1) {
    for (const ride of rides) {
      park(ride);
      ride.controller.updateVehicle(FIXED, undefined, undefined, (collider) => collider.handle !== ride.collider.handle);
    }
    world.step();
  }
  applyWeather();
  say("You are new on FC Road. One bag. The old scooter is nearby.");
  statusEl.textContent = "";
  statusEl.hidden = true;
  resize();
  requestAnimationFrame((time) => {
    lastTime = time;
    loop(time);
  });
}

window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (event.repeat || !player) return;
  if (event.code === "Space") jumpQueued = true;
  if (event.code === "KeyE") onInteract();
  if (event.code === "KeyF") enterOrExit();
  if (event.code === "KeyH") horn();
  if (event.code === "KeyN") {
    save.night = !save.night;
    applyWeather();
    persist();
  }
  if (event.code === "KeyR") {
    save.rain = !save.rain;
    applyWeather();
    persist();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.002;
  pitch = Math.max(-0.35, Math.min(0.9, pitch));
});

canvas.addEventListener("click", () => {
  canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  lookEl.hidden = document.pointerLockElement === canvas;
});

document.querySelectorAll("[data-area]").forEach((button) => {
  button.addEventListener("click", () => {
    const id = button.dataset.area;
    const area = save.areas.find((item) => item.id === id);
    say(area?.locked ? `${area.name} is locked. This chapter is FC Road.` : "You are on FC Road.");
  });
});

window.addEventListener("resize", resize);
setInterval(persist, 2000);

const wasm = new URL("/vendor/rapier/rapier_wasm3d_bg.wasm", window.location.href);
await RAPIER.init(wasm);
boot();
