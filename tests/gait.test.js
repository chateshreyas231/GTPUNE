import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { person, stepGait } from "../src/city.js";

test("a stopped person stands still and a moving one steps opposite limbs", () => {
  const body = person(1, { player: true });
  body.userData.walk(0.2, 0);
  for (const part of [
    "left-leg",
    "right-leg",
    "left-arm",
    "right-arm",
    "left-knee",
    "right-knee",
  ]) {
    assert.ok(
      Math.abs(body.getObjectByName(part).rotation.x) < 1e-6,
      `${part} should hang still`,
    );
  }
  body.userData.gaitPhase = Math.PI / 2;
  body.userData.walk(0, 1.6);
  const left = body.getObjectByName("left-leg").rotation.x;
  const right = body.getObjectByName("right-leg").rotation.x;
  const leftArm = body.getObjectByName("left-arm").rotation.x;
  const rightArm = body.getObjectByName("right-arm").rotation.x;
  assert.ok(left > 0.2, "left leg swings forward");
  assert.ok(right < -0.2, "right leg swings back");
  assert.ok(leftArm < -0.2, "opposite arm swings back");
  assert.ok(rightArm > 0.2, "opposite arm swings forward");
  assert.ok(body.getObjectByName("left-knee").rotation.x < -0.3);
  assert.ok(Math.abs(body.getObjectByName("right-knee").rotation.x) < 1e-6);
});

test("a run uses a longer stride than a walk and a stop has no swing", () => {
  const walk = stepGait({ gaitPhase: Math.PI / 2 }, 0, 1.6);
  const run = stepGait({ gaitPhase: Math.PI / 2 }, 0, 6.8);
  assert.equal(stepGait({}, 0, 0).swing, 0);
  assert.ok(walk.swing > 0.9);
  assert.ok(run.hip > walk.hip + 0.2);
  assert.ok(run.arm > walk.arm);
});

test("the player body is wheatish, light-shirted, and under 2.1 metres", () => {
  const body = person(0, { player: true });
  assert.equal(body.userData.skin, 0xd6b08a);
  assert.equal(body.userData.shirt, 0xe4dccc);
  body.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
  assert.ok(size.y > 1.4 && size.y < 2.1);
});
