import test from "node:test";
import assert from "node:assert/strict";
import {
  CINEMATIC,
  gradeSceneColor,
  thirdPersonRig,
} from "../src/cinematic.js";

test("chase camera is slightly wider on foot and in a car", () => {
  const foot = thirdPersonRig({ walking: true, view: 0 });
  const car = thirdPersonRig({ walking: false, view: 0 });
  assert.ok(CINEMATIC.fov > 57 && CINEMATIC.fov <= 64);
  assert.ok(foot.back > 4.4 && foot.back < 5.3);
  assert.ok(car.back > 13 && car.back < 16);
  assert.ok(car.height > 7 && car.height < 8.2);
  assert.equal(thirdPersonRig({ walking: true, view: 1 }).back, 2.6);
  assert.equal(thirdPersonRig({ walking: true, view: 2 }).back, 16);
  assert.equal(thirdPersonRig({ walking: false, view: 1 }).back, 5);
  assert.equal(thirdPersonRig({ walking: false, view: 2 }).height, 42);
});

test("film grade is softer, lightly vignetted, and has no letterbox", () => {
  assert.equal(CINEMATIC.letterbox, 0);
  assert.ok(CINEMATIC.bloomStrength > 0 && CINEMATIC.bloomStrength < 0.45);
  assert.ok(CINEMATIC.vignette > 0 && CINEMATIC.vignette < 0.35);
  assert.ok(CINEMATIC.contrast < 1 && CINEMATIC.contrast > 0.7);

  const black = gradeSceneColor([0, 0, 0]);
  const hot = gradeSceneColor([8, 8, 8]);
  assert.ok(black[0] > 0.02, "lifted blacks");
  assert.ok(hot[0] < 0.99, "rolled highlights");
  assert.ok(hot[0] - black[0] < 0.97, "softer than a full black-to-white swing");

  const shadow = gradeSceneColor([0.12, 0.12, 0.12]);
  const highlight = gradeSceneColor([1.8, 1.8, 1.8]);
  assert.ok(shadow[2] / shadow[0] > highlight[2] / highlight[0], "shadows are cooler than highlights");
  assert.ok(highlight[0] > highlight[2], "warm highlights");

  const center = gradeSceneColor([0.45, 0.45, 0.45], 0.5, 0.5);
  const corner = gradeSceneColor([0.45, 0.45, 0.45], 0, 0);
  const top = gradeSceneColor([0.45, 0.45, 0.45], 0.5, 0.02);
  assert.ok(corner[1] < center[1]);
  assert.ok(corner[1] > center[1] * 0.72, "light vignette");
  assert.ok(top[1] > corner[1], "edges are not letterboxed");
  assert.ok(top[1] > center[1] * 0.9, "top center stays open");
});
