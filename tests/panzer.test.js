import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  makePanzer,
  rotateTurret,
  firePanzer,
  updatePanzer,
  disposePanzer,
  PANZER_WIDTH,
  PANZER_LENGTH,
} from "../src/panzer.js";

test("panzer has a tracked silhouette and stays inside its spawn envelope", () => {
  const tank = makePanzer();
  assert.equal(tank.userData.kind, "armor");
  assert.equal(tank.userData.body, "panzer");
  assert.ok(tank.getObjectByName("panzer-left-tread"));
  assert.ok(tank.getObjectByName("panzer-right-tread"));
  assert.equal(tank.userData.wheels.length, 14);
  const size = new THREE.Box3()
    .setFromObject(tank)
    .getSize(new THREE.Vector3());
  assert.ok(size.x <= PANZER_WIDTH, `width ${size.x}`);
  assert.ok(size.z <= PANZER_LENGTH, `length ${size.z}`);
  assert.ok(size.y > 1.8 && size.y < 2.5);
  disposePanzer(tank);
});

test("turret turns independently and rejects invalid input", () => {
  const tank = makePanzer();
  const hull = tank.getObjectByName("panzer-hull");
  assert.equal(rotateTurret(tank, Math.PI / 2), true);
  assert.ok(Math.abs(tank.userData.turret.rotation.y - Math.PI / 2) < 1e-6);
  assert.equal(hull.rotation.y, 0);
  assert.equal(rotateTurret(tank, Infinity), false);
  assert.equal(rotateTurret(new THREE.Group(), 1), false);
  disposePanzer(tank);
});

test("a visual shot has cooldown, recoil and an expiring flash", () => {
  const tank = makePanzer();
  assert.equal(firePanzer(tank, 0), true);
  assert.equal(firePanzer(tank, 0.1), false);
  assert.equal(tank.userData.muzzleFlash.visible, true);
  assert.ok(tank.userData.barrel.position.z > 0);
  updatePanzer(tank, 0.2);
  assert.equal(tank.userData.muzzleFlash.visible, false);
  assert.ok(tank.userData.barrel.position.z < 0.01);
  assert.equal(firePanzer(tank, 0.7), true);
  assert.equal(firePanzer(tank, NaN), false);
  disposePanzer(tank);
});

test("disposal is idempotent and removes controls and scene attachment", () => {
  const scene = new THREE.Scene();
  const tank = makePanzer();
  scene.add(tank);
  let disposed = 0;
  tank
    .getObjectByName("panzer-hull")
    .geometry.addEventListener("dispose", () => disposed++);
  disposePanzer(tank);
  disposePanzer(tank);
  assert.equal(scene.children.length, 0);
  assert.equal(disposed, 1);
  assert.equal(firePanzer(tank, 2), false);
  assert.equal(rotateTurret(tank, 1), false);
});
