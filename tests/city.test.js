import test from "node:test";
import assert from "node:assert/strict";
import {
  fallbackCity,
  parseOSM,
  project,
  segmentDistance,
  inside,
} from "../src/city.js";
test("fallback city is deterministic and includes a playable route", () => {
  const a = fallbackCity();
  assert.deepEqual(a, fallbackCity());
  assert.equal(a.stops.length, 3);
  assert.ok(a.buildings.length > 100);
  assert.equal(a.source, "illustrative");
});
test("projection preserves north and east axes", () => {
  assert.deepEqual(project(18.5167, 73.841), [0, -0]);
  assert.ok(project(18.52, 73.85)[0] > 0);
  assert.ok(project(18.52, 73.85)[1] < 0);
});
test("OSM importer uses footprints and height and snaps spawn to roads", () => {
  const map = parseOSM({
    elements: [
      {
        id: 1,
        tags: { highway: "residential" },
        geometry: [
          { lat: 18.516, lon: 73.841 },
          { lat: 18.52, lon: 73.841 },
        ],
      },
      {
        id: 2,
        tags: { building: "yes", "building:levels": "4" },
        geometry: [
          { lat: 18.517, lon: 73.842 },
          { lat: 18.518, lon: 73.842 },
          { lat: 18.518, lon: 73.843 },
          { lat: 18.517, lon: 73.842 },
        ],
      },
    ],
  });
  assert.equal(map.roads.length, 1);
  assert.equal(map.buildings[0].height, 12);
  assert.equal(map.source, "OpenStreetMap");
  assert.equal(map.spawn[0], 0);
  assert.ok(Math.abs(map.spawn[1]) < 0.001);
});
test("empty map cannot silently activate real-map mode", () =>
  assert.throws(() => parseOSM({ elements: [] }), /no driveable roads/));
test("collision geometry handles corners and polygon interiors", () => {
  assert.equal(segmentDistance(2, 2, [0, 0], [0, 4]), 2);
  assert.ok(
    inside(2, 2, [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ]),
  );
  assert.ok(
    !inside(5, 2, [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ]),
  );
});
