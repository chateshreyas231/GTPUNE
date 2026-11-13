import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fallbackCity,
  parseOSM,
  project,
  segmentDistance,
  inside,
  roadWidthFromTags,
  buildingSizeFromTags,
  sidewalkMeters,
  staggerMatchedHeights,
  PERSON_METERS,
  PERSON_STOREY,
  STOREY_METERS,
  fillBuildingGaps,
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
  const street = buildingSizeFromTags({ building: "yes" });
  assert.equal(street.height, 9 * PERSON_STOREY);
  assert.equal(street.floors, 9);
  assert.equal(street.storey, PERSON_STOREY);
  assert.equal(
    buildingSizeFromTags({ building: "commercial" }).height,
    street.height,
  );
  assert.ok(Math.abs(PERSON_STOREY - PERSON_METERS) < 0.4);
  assert.ok((street.height - PERSON_METERS) / PERSON_STOREY >= 4);
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
        tags: {
          highway: "residential",
          name: "Deccan Gymkhana Road",
          lanes: "2",
        },
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
function block(x, z, w, d, height, source = "type-default") {
  const street = source === "type-default" && height >= 12;
  return {
    points: [
      [x, z],
      [x + w, z],
      [x + w, z + d],
      [x, z + d],
    ],
    height,
    floors: Math.round(height / (street ? PERSON_STOREY : STOREY_METERS)),
    heightSource: source,
    storey: street ? PERSON_STOREY : STOREY_METERS,
    street,
  };
}

test("surveyed heights stay put while a matching neighbour is offset", () => {
  const surveyed = block(0, 0, 10, 12, 18, "height-tag");
  const neighbour = block(12, 0, 10, 12, 18);
  staggerMatchedHeights([surveyed, neighbour]);
  assert.equal(surveyed.height, 18);
  assert.notEqual(neighbour.height, 18);
  assert.ok(Math.abs(neighbour.height - 18) >= PERSON_STOREY - 0.01);
  assert.ok(neighbour.height >= 6 * PERSON_STOREY);
  assert.ok(neighbour.height <= 14 * PERSON_STOREY);
});

test("a row of equal street roofs does not stay level", () => {
  const row = [0, 1, 2, 3, 4].map((i) => block(i * 14, 0, 12, 10, 18));
  staggerMatchedHeights(row);
  const heights = row.map((building) => building.height);
  assert.ok(new Set(heights).size >= 3);
  for (let i = 1; i < row.length; i++)
    assert.ok(Math.abs(heights[i] - heights[i - 1]) >= PERSON_STOREY - 0.01);
  assert.ok(heights.every((height) => height >= 6 * PERSON_STOREY));
});

test("infill between equal roofs is not one height", () => {
  const roads = [
    {
      points: [
        [-20, -10],
        [-20, 140],
      ],
      width: 8,
    },
  ];
  const blocks = [0, 1, 2, 3, 4].map((i) =>
    block(0, i * 22, 10, 14, 18, "height-tag"),
  );
  const infill = fillBuildingGaps(blocks, roads);
  assert.ok(infill.length >= 2);
  const heights = infill.map((building) => building.height);
  assert.ok(
    new Set(heights.map((height) => Math.round(height * 10))).size >= 2,
  );
  assert.ok(heights.every((height) => height >= 3 && height <= 36));
  assert.equal(
    heights.every((height) => height === heights[0]),
    false,
  );
});

test("FC Road roofs sit several person-storeys up and do not share one height", () => {
  const map = parseOSM(
    JSON.parse(
      readFileSync(
        new URL("../public/data/pune-osm.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const fc = project(18.5235, 73.8412);
  const wall = map.buildings.filter((building) => {
    if (building.infill || building.heightSource !== "type-default")
      return false;
    if (!["yes", "commercial", "retail", "residential"].includes(building.kind))
      return false;
    let x = 0;
    let z = 0;
    for (const p of building.points) {
      x += p[0];
      z += p[1];
    }
    x /= building.points.length;
    z /= building.points.length;
    return Math.hypot(x - fc[0], z - fc[1]) < 220;
  });
  assert.ok(wall.length >= 8);
  const heights = wall.map((building) => building.height);
  assert.ok(new Set(heights).size >= 3);
  assert.ok(heights.every((height) => height >= 6 * PERSON_STOREY - 0.01));
  assert.ok(
    heights.every((height) => (height - PERSON_METERS) / PERSON_STOREY >= 4),
  );
  const tagged = map.buildings.filter(
    (building) => building.heightSource === "height-tag",
  );
  const leveled = map.buildings.filter(
    (building) => building.heightSource === "levels-tag",
  );
  assert.equal(tagged.length, 57);
  assert.equal(leveled.length, 270);
  assert.ok(
    leveled.every(
      (building) =>
        building.height >= 3 &&
        building.height <= 120 &&
        Math.abs(
          building.height / STOREY_METERS -
            Math.round(building.height / STOREY_METERS),
        ) < 0.02,
    ),
  );
  const infillHeights = map.buildings
    .filter((building) => building.infill)
    .map((building) => Math.round(building.height * 10));
  assert.ok(new Set(infillHeights).size >= 4);
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
