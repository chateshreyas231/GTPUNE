import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  constructionWorkerPlans,
  createUrbanProps,
  exhaustInterval,
  MAX_WORKERS,
  MAX_SMOKE_PARTICLES,
  urbanRoadSegments,
} from "../src/urban-props.js";

const roads = [{ a: [-60, 0], b: [100, 0], width: 8, sidewalk: 2 }];

test("normalizes polylines and segment inputs without zero-length worker sites", () => {
  const result = urbanRoadSegments([
    ...roads,
    {
      points: [
        [0, 0],
        [0, 0],
        [0, 40],
      ],
      width: 6,
    },
  ]);
  assert.equal(result.length, 2);
  assert.ok(result.every((road) => road.length >= 8));
});

test("workers stay on the sidewalk and honor building collision checks", () => {
  const plans = constructionWorkerPlans(roads, [0, 0], (x) => x > 30);
  assert.ok(plans.length > 0 && plans.length <= MAX_WORKERS);
  assert.ok(plans.every((plan) => Math.abs(plan.z) > 4 && plan.x <= 30));
  assert.deepEqual(
    constructionWorkerPlans(roads, [0, 0], () => true),
    [],
  );
});

test("construction sites own bounded adult worker meshes and dispose cleanly", () => {
  const scene = new THREE.Scene();
  const props = createUrbanProps(scene, { roads });
  assert.ok(props.diagnostics.workers > 0);
  const worker = props.group.getObjectByName("adult-construction-worker");
  const height = new THREE.Box3()
    .setFromObject(worker)
    .getSize(new THREE.Vector3()).y;
  assert.ok(height > 1.5 && height < 2);
  props.dispose();
  props.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(props.diagnostics.disposed, true);
});

test("player smoking can be toggled or transferred but is not attached to a child", () => {
  const scene = new THREE.Scene();
  const adult = new THREE.Group();
  const child = new THREE.Group();
  child.userData.child = true;
  scene.add(adult, child);
  const props = createUrbanProps(scene, { roads, player: adult });
  assert.equal(props.setSmoking(true), true);
  assert.ok(adult.getObjectByName("player-cigarette"));
  props.update(0.1, 1, [0, 0]);
  assert.ok(props.diagnostics.activeParticles > 0);
  assert.equal(props.setSmoking(true, child), false);
  assert.equal(adult.getObjectByName("player-cigarette"), undefined);
  assert.equal(child.getObjectByName("player-cigarette"), undefined);
  assert.equal(props.diagnostics.smoking, false);
  props.dispose();
});

test("exhaust is opt-in and stationary cars emit nothing", () => {
  assert.equal(exhaustInterval(0), Infinity);
  const scene = new THREE.Scene();
  const car = new THREE.Group();
  scene.add(car);
  const props = createUrbanProps(scene, { roads, exhaust: true });
  props.update(0.1, 0, [0, 0], [{ mesh: car }]);
  props.update(0.1, 0.1, [0, 0], [{ mesh: car }]);
  assert.equal(props.diagnostics.activeParticles, 0);
  car.position.x = 0.2;
  props.update(0.1, 0.2, [0, 0], [{ mesh: car }]);
  assert.ok(props.diagnostics.activeParticles > 0);
  for (let i = 0; i < 200; i++) {
    car.position.x += 0.2;
    props.update(0.1, i * 0.1 + 0.3, [0, 0], [{ mesh: car }]);
  }
  assert.ok(props.diagnostics.activeParticles <= MAX_SMOKE_PARTICLES);
  props.dispose();
});
