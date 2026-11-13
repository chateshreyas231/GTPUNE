import test from "node:test";
import assert from "node:assert/strict";
import {
  fallbackCity,
  parseOSM,
  project,
  segmentDistance,
  inside,
  roadWidthFromTags,
  buildingSizeFromTags,
  sidewalkMeters,
  laneLateral,
  sidewalkLateral,
  DRIVE_LANE_METERS,
  BIKE_PARK_METERS,
  PUNE_CARRIAGE_METERS,
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
test("drivable width is one lane each way plus parked bikes", () => {
  assert.equal(
    PUNE_CARRIAGE_METERS,
    DRIVE_LANE_METERS * 2 + BIKE_PARK_METERS * 2,
  );
  assert.ok(PUNE_CARRIAGE_METERS < 7);
  assert.deepEqual(roadWidthFromTags({ highway: "secondary", width: "10" }), {
    width: PUNE_CARRIAGE_METERS,
    widthSource: "width-tag",
  });
  assert.deepEqual(roadWidthFromTags({ highway: "primary", lanes: "3" }), {
    width: PUNE_CARRIAGE_METERS,
    widthSource: "lanes",
  });
  assert.deepEqual(roadWidthFromTags({ highway: "primary" }), {
    width: PUNE_CARRIAGE_METERS,
    widthSource: "class-default",
  });
  assert.deepEqual(roadWidthFromTags({ highway: "living_street" }), {
    width: 5,
    widthSource: "class-default",
  });
  assert.deepEqual(roadWidthFromTags({ highway: "residential", lanes: "1" }), {
    width: 3.5,
    widthSource: "lanes",
  });
  assert.equal(sidewalkMeters("Gopal Krushna Gokhale Path"), 2.4);
  assert.equal(sidewalkMeters("Paud Road"), 2.2);
  assert.equal(sidewalkMeters("Bhandarkar Path"), 1.6);
  const segment = { width: PUNE_CARRIAGE_METERS, sidewalk: 1.6 };
  const right = laneLateral(segment, "car", 1);
  const left = laneLateral(segment, "car", -1);
  assert.ok(right > 0 && left < 0);
  assert.ok(Math.abs(right - left) > 2.5);
  const bike = laneLateral(segment, "motorcycle", 1);
  assert.ok(bike > right);
  assert.ok(bike < PUNE_CARRIAGE_METERS / 2);
  const walk = sidewalkLateral(segment, 1);
  assert.ok(walk > PUNE_CARRIAGE_METERS / 2);
  assert.ok(walk < PUNE_CARRIAGE_METERS / 2 + segment.sidewalk);
});
test("building height prefers a height tag, then levels, then the type median", () => {
  const tagged = buildingSizeFromTags({
    building: "yes",
    height: "18.5",
    "building:levels": "4",
  });
  assert.equal(tagged.height, 18.5);
  assert.equal(tagged.heightSource, "height-tag");
  const levels = buildingSizeFromTags({
    building: "yes",
    "building:levels": "4",
  });
  assert.equal(levels.height, 12);
  assert.equal(levels.floors, 4);
  assert.equal(levels.heightSource, "levels-tag");
  assert.equal(buildingSizeFromTags({ building: "house" }).height, 6);
  assert.equal(
    buildingSizeFromTags({ building: "house" }).heightSource,
    "type-default",
  );
  assert.equal(buildingSizeFromTags({ building: "apartments" }).height, 15);
  assert.equal(
    buildingSizeFromTags({ building: "yes", "building:levels": "Ground+3" })
      .heightSource,
    "type-default",
  );
});
test("OSM footprints stay on the surveyed outline", () => {
  const map = parseOSM({
    elements: [
      {
        id: 7,
        tags: { highway: "residential", name: "Deccan Gymkhana Road", lanes: "2" },
        geometry: [
          { lat: 18.516, lon: 73.841 },
          { lat: 18.517, lon: 73.841 },
        ],
      },
      {
        id: 8,
        tags: { building: "commercial", height: "9" },
        geometry: [
          { lat: 18.5162, lon: 73.8412 },
          { lat: 18.5163, lon: 73.8412 },
          { lat: 18.5163, lon: 73.8413 },
          { lat: 18.5162, lon: 73.8413 },
          { lat: 18.5162, lon: 73.8412 },
        ],
      },
    ],
  });
  assert.equal(map.roads[0].width, PUNE_CARRIAGE_METERS);
  assert.equal(map.roads[0].widthSource, "lanes");
  assert.equal(map.roads[0].sidewalk, 1.6);
  assert.equal(map.buildings[0].points.length, 5);
  assert.equal(map.buildings[0].height, 9);
  assert.equal(map.buildings[0].heightSource, "height-tag");
  assert.equal(map.buildings[0].points[0][0], project(18.5162, 73.8412)[0]);
});
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
