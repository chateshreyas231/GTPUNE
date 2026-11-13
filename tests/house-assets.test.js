import test from "node:test";
import assert from "node:assert/strict";
import { housePlacement } from "../src/house-assets.js";
import { residentVariant } from "../src/resident-cast.js";
import {
  fleetBody,
  STREET_FLEET,
  CAR_BODIES,
  makeVehicle,
} from "../src/vehicles.js";
import {
  NORMAL_CARS,
  SUPERCARS,
  LEGACY_CAR_REPLACEMENTS,
} from "../src/vehicle-assets.js";
import { vehicleSamples } from "../src/vehicle-footprint.js";

const house = {
  id: 12,
  kind: "house",
  height: 9,
  heightSource: "levels-tag",
  points: [
    [-4, -5],
    [4, -5],
    [4, 5],
    [-4, 5],
    [-4, -5],
  ],
};
const roads = [{ a: [-50, 12], b: [50, 12], width: 6 }];
test("houses fit residential footprints and retain tagged height without replacing named/nonresidential sites", () => {
  const p = housePlacement(house, roads);
  assert.ok(p);
  assert.equal(p.height, 9);
  assert.ok(p.width <= 10 && p.depth <= 10);
  for (const extra of [
    { amenity: "school" },
    { name: "Known building" },
    { kind: "commercial" },
    { infill: true },
    { height: 30 },
  ])
    assert.equal(housePlacement({ ...house, ...extra }, roads), null);
  // A concave L shape must not become a rectangular house spanning its empty corner.
  const concave = {
    ...house,
    points: [
      [-5, -5],
      [5, -5],
      [5, -1],
      [-1, -1],
      [-1, 5],
      [-5, 5],
      [-5, -5],
    ],
  };
  assert.equal(housePlacement(concave, roads), null);
});
test("everyday cars dominate, previous designs stay supercars and legacy requests use Blender replacements", () => {
  const cars = Array.from({ length: 30 }, (_, i) =>
    fleetBody(STREET_FLEET.motorcycles + (i % STREET_FLEET.cars)),
  );
  assert.ok(
    cars.filter((id) => NORMAL_CARS[id]).length >
      cars.filter((id) => SUPERCARS[id]).length * 3,
  );
  const initial = Array.from({ length: STREET_FLEET.cars }, (_, i) =>
    fleetBody(STREET_FLEET.motorcycles + i),
  );
  assert.equal(initial.filter((id) => NORMAL_CARS[id]).length, 10);
  assert.equal(initial.filter((id) => SUPERCARS[id]).length, 2);
  for (const [old, replacement] of Object.entries(LEGACY_CAR_REPLACEMENTS)) {
    assert.ok(!CAR_BODIES.includes(old));
    assert.equal(makeVehicle(old).userData.body, replacement);
  }
});
test("wardrobes match police, workers, traditional and contemporary residents", () => {
  assert.equal(
    residentVariant({ service: "police", gender: "woman" }),
    "policewoman",
  );
  assert.equal(residentVariant({ service: "police" }), "police-officer");
  assert.equal(residentVariant("construction"), "construction-worker");
  assert.equal(
    residentVariant({ gender: "woman", garment: "saree" }),
    "nauvari-woman",
  );
  assert.equal(residentVariant({ garment: "kurta" }), "traditional-man");
  assert.equal(
    residentVariant({ gender: "woman", kind: "student" }, 1),
    "printed-dress",
  );
});
test("bus collision samples include nose and tail and rotate with the vehicle", () => {
  const m = { userData: { length: 11 } };
  const samples = vehicleSamples(m, 10, 20, 0, 1.5);
  assert.deepEqual(
    samples.map((s) => s.z),
    [20, 16, 24],
  );
  assert.deepEqual(
    vehicleSamples(m, 10, 20, Math.PI / 2, 1.5).map((s) => s.x),
    [10, 6, 14],
  );
  assert.equal(vehicleSamples({ userData: { length: 4 } }, 0, 0).length, 1);
});
