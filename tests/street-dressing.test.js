import test from "node:test";
import assert from "node:assert/strict";
import { streetHeight } from "../src/city.js";
import { leafSway, streetDetails } from "../src/street-details.js";

test("street heights vary and stay in a walkable band", () => {
  const low = streetHeight(12, 0);
  const high = streetHeight(12, 0.9);
  assert.notEqual(low, high);
  assert.ok(low >= 7.2 && low <= 42);
  assert.ok(high >= 7.2 && high <= 42);
  assert.equal(streetHeight(18, 0.4), streetHeight(18, 0.4));
  assert.ok(streetHeight(3, 0.2) >= 7.2);
});

test("higher leaf clumps sway farther than shrubs", () => {
  const low = leafSway(2, 0.5, 4, 0.4);
  const high = leafSway(2, 5, 4, 0.4);
  const later = leafSway(2, 5, 4, 2.2);
  assert.ok(Math.hypot(high.x, high.z) > Math.hypot(low.x, low.z));
  assert.ok(Math.hypot(later.x - high.x, later.z - high.z) > 0.02);
});

test("a nearby street gets trees, a bicycle, plants and a shopfront", () => {
  const roads = [
    {
      a: [0, 0],
      b: [80, 0],
      width: 12,
      length: 80,
      angle: Math.PI / 2,
    },
  ];
  const buildings = [
    {
      points: [
        [10, 10],
        [22, 10],
        [22, 20],
        [10, 20],
      ],
      height: 12,
      color: 0.3,
      minX: 10,
      maxX: 22,
      minZ: 10,
      maxZ: 20,
    },
  ];
  const root = streetDetails(16, 8, roads, () => false, buildings);
  const names = new Set();
  root.traverse((object) => {
    if (object.name) names.add(object.name);
  });
  for (const part of ["leaf", "trunk", "bicycle", "pot", "shrub", "shop", "awning", "window", "balcony", "cornice"])
    assert.ok(names.has(part), part);
  const leaves = [];
  root.traverse((object) => {
    if (object.name === "leaf") leaves.push(object);
  });
  assert.ok(leaves.length >= 5);
});
