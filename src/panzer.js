import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// An original fictional game prop, not a reproduction of a real vehicle.
// Firing is only a short visual flash/recoil; no projectile or hit logic lives here.
export const PANZER_WIDTH = 3;
export const PANZER_LENGTH = 5.3;
export const PANZER_FLASH_SECONDS = 0.14;
export const PANZER_COOLDOWN_SECONDS = 0.65;

export function makePanzer(color = 0x57684a) {
  const root = new THREE.Group();
  root.name = "panzer";
  const paint = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.74,
    metalness: 0.25,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0x78816b,
    roughness: 0.8,
    metalness: 0.15,
  });
  const trackMaterial = new THREE.MeshStandardMaterial({
    color: 0x222923,
    roughness: 0.95,
  });
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x424b3d,
    roughness: 0.85,
    metalness: 0.25,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x173a43,
    roughness: 0.22,
    metalness: 0.4,
  });
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffda7b,
    transparent: true,
    opacity: 0,
  });
  const add = (parent, name, geometry, material, x, y, z) => {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.position.set(x, y, z);
    object.castShadow = object.receiveShadow = material !== flashMaterial;
    parent.add(object);
    return object;
  };

  add(
    root,
    "panzer-hull",
    new RoundedBoxGeometry(2.22, 0.85, 4.16, 2, 0.15),
    paint,
    0,
    0.98,
    0,
  );
  add(
    root,
    "panzer-deck",
    new RoundedBoxGeometry(2.4, 0.18, 3.7, 2, 0.07),
    trim,
    0,
    1.45,
    0,
  );

  const wheels = [];
  for (const side of [-1, 1]) {
    const tread = add(
      root,
      side < 0 ? "panzer-left-tread" : "panzer-right-tread",
      new THREE.CapsuleGeometry(0.42, 3.75, 4, 8),
      trackMaterial,
      side * 1.22,
      0.56,
      0,
    );
    tread.rotation.x = Math.PI / 2;
    tread.scale.x = 0.55;
    for (let index = 0; index < 7; index++) {
      const wheel = add(
        root,
        "panzer-road-wheel",
        new THREE.CylinderGeometry(0.28, 0.28, 0.13, 10),
        wheelMaterial,
        side * 1.42,
        0.54,
        -1.8 + index * 0.6,
      );
      wheel.rotation.z = Math.PI / 2;
      wheels.push(wheel);
    }
    for (let index = 0; index < 13; index++) {
      const z = -1.8 + index * 0.3;
      add(
        root,
        "panzer-tread-cleat",
        new THREE.BoxGeometry(0.48, 0.035, 0.13),
        wheelMaterial,
        side * 1.22,
        0.99,
        z,
      );
      add(
        root,
        "panzer-tread-cleat",
        new THREE.BoxGeometry(0.48, 0.035, 0.13),
        wheelMaterial,
        side * 1.22,
        0.13,
        z,
      );
    }
  }

  const turret = new THREE.Group();
  turret.name = "panzer-turret";
  turret.position.set(0, 1.49, -0.1);
  root.add(turret);
  add(
    turret,
    "panzer-turret-shell",
    new RoundedBoxGeometry(1.58, 0.7, 1.7, 2, 0.14),
    paint,
    0,
    0.37,
    0,
  );
  const hatch = add(
    turret,
    "panzer-hatch",
    new THREE.CylinderGeometry(0.34, 0.34, 0.1, 12),
    trim,
    0,
    0.78,
    0.12,
  );
  hatch.rotation.y = Math.PI / 8;
  add(
    turret,
    "panzer-view-slot",
    new THREE.BoxGeometry(0.49, 0.11, 0.04),
    glass,
    0,
    0.55,
    -0.87,
  );
  const barrel = new THREE.Group();
  barrel.name = "panzer-barrel";
  turret.add(barrel);
  const tube = add(
    barrel,
    "panzer-barrel-tube",
    new THREE.CylinderGeometry(0.085, 0.11, 1.72, 10),
    paint,
    0,
    0.4,
    -1.55,
  );
  tube.rotation.x = Math.PI / 2;
  const muzzle = add(
    barrel,
    "panzer-muzzle",
    new THREE.CylinderGeometry(0.13, 0.13, 0.16, 10),
    trim,
    0,
    0.4,
    -2.37,
  );
  muzzle.rotation.x = Math.PI / 2;
  const flash = add(
    barrel,
    "panzer-muzzle-flash",
    new THREE.ConeGeometry(0.2, 0.4, 6),
    flashMaterial,
    0,
    0.4,
    -2.62,
  );
  flash.rotation.x = -Math.PI / 2;
  flash.visible = false;

  root.userData = {
    kind: "armor",
    body: "panzer",
    label: "Panzer · tracked prop",
    tank: true,
    wheels,
    turret,
    barrel,
    muzzleFlash: flash,
    exhaust: [0.82, 0.72, 2.02],
    tone: {
      hornFreq: 164,
      hornType: "square",
      hornSeconds: 0.35,
      engineType: "sawtooth",
      engineBase: 32,
      engineSlide: 1.2,
      filter: 150,
    },
    spawnSize: { width: PANZER_WIDTH, length: PANZER_LENGTH },
    collisionRadius: 1.5,
    panzerState: {
      lastShot: -Infinity,
      flashRemaining: 0,
      recoil: 0,
      disposed: false,
    },
  };
  return root;
}

function stateOf(mesh) {
  return mesh?.userData?.body === "panzer" ? mesh.userData.panzerState : null;
}

export function rotateTurret(mesh, delta) {
  const state = stateOf(mesh);
  if (!state || state.disposed || !Number.isFinite(delta)) return false;
  const turret = mesh.userData.turret;
  turret.rotation.y =
    THREE.MathUtils.euclideanModulo(
      turret.rotation.y + delta + Math.PI,
      Math.PI * 2,
    ) - Math.PI;
  return true;
}

export function firePanzer(mesh, time) {
  const state = stateOf(mesh);
  if (
    !state ||
    state.disposed ||
    !Number.isFinite(time) ||
    time < 0 ||
    time - state.lastShot < PANZER_COOLDOWN_SECONDS
  )
    return false;
  state.lastShot = time;
  state.flashRemaining = PANZER_FLASH_SECONDS;
  state.recoil = 0.12;
  mesh.userData.muzzleFlash.visible = true;
  mesh.userData.muzzleFlash.material.opacity = 0.9;
  mesh.userData.barrel.position.z = state.recoil;
  return true;
}

export function updatePanzer(mesh, dt) {
  const state = stateOf(mesh);
  if (!state || state.disposed || !Number.isFinite(dt) || dt < 0) return;
  const step = Math.min(dt, 1);
  state.flashRemaining = Math.max(0, state.flashRemaining - step);
  state.recoil *= Math.exp(-step * 16);
  const flash = mesh.userData.muzzleFlash;
  flash.visible = state.flashRemaining > 0;
  flash.material.opacity = (0.9 * state.flashRemaining) / PANZER_FLASH_SECONDS;
  mesh.userData.barrel.position.z = state.recoil;
}

export function disposePanzer(mesh) {
  const state = stateOf(mesh);
  if (!state || state.disposed) return;
  state.disposed = true;
  const geometries = new Set();
  const materials = new Set();
  mesh.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  mesh.removeFromParent();
}
