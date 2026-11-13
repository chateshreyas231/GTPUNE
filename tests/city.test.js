import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fallbackCity,
  parseOSM,
  project,
  segmentDistance,
  inside,
  buildingHeight,
  buildingMass,
  offsetPolygon,
  massPieces,
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
function road() {
  return {
    id: 1,
    tags: { highway: "residential" },
    geometry: [
      { lat: 18.516, lon: 73.841 },
      { lat: 18.52, lon: 73.841 },
    ],
  };
}
function footprint(id, lat, lon, scale = 1) {
  const s = 0.00009 * scale;
  return {
    id,
    tags: { building: "yes" },
    geometry: [
      { lat, lon },
      { lat: lat + s * 1.15, lon: lon + s * 0.18 },
      { lat: lat + s * 0.72, lon: lon + s * 1.55 },
      { lat: lat - s * 0.22, lon: lon + s * 1.05 },
      { lat: lat + s * 0.08, lon: lon + s * 0.4 },
    ],
  };
}
test("untagged buildings keep their own polygons and take height and mass from the id", () => {
  const elements = [road()];
  for (let n = 0; n < 80; n++) {
    const id = 5000 + n;
    elements.push(
      footprint(
        id,
        18.517 + (n % 10) * 0.0004,
        73.842 + Math.floor(n / 10) * 0.0004,
        1 + (n % 5) * 0.35,
      ),
    );
  }
  elements.push({
    id: 42,
    tags: { building: "retail", height: "6.5" },
    geometry: footprint(42, 18.519, 73.845).geometry,
  });
  elements.push({
    id: 43,
    tags: { building: "apartments", "building:levels": "14" },
    geometry: footprint(43, 18.5192, 73.845).geometry,
  });
  const same = footprint(77, 18.518, 73.844, 1.2);
  elements.push(same, { ...same, id: 78001 });
  const map = parseOSM({ elements });
  const tagged = map.buildings.find((b) => b.id === 42);
  const tower = map.buildings.find((b) => b.id === 43);
  assert.equal(tagged.height, 6.5);
  assert.equal(tower.height, 42);
  const varied = map.buildings.filter((b) => b.id >= 5000);
  for (const building of varied) {
    const source = elements.find((e) => e.id === building.id);
    assert.deepEqual(
      building.points,
      source.geometry.map((p) => project(p.lat, p.lon)),
    );
    assert.ok(building.points.length === 5);
  }
  const heights = varied.map((b) => b.height);
  assert.ok(new Set(heights).size >= 4);
  assert.ok(heights.some((h) => h !== 12));
  assert.ok(
    heights.filter((h) => h >= 3 && h <= 18).length > varied.length * 0.7,
  );
  assert.ok(heights.some((h) => h > 18));
  assert.ok(heights.some((h) => h <= 6));
  const masses = new Set(varied.map((b) => b.mass));
  for (const kind of ["setback", "shop", "awning", "balcony"])
    assert.ok(masses.has(kind));
  const again = parseOSM({ elements });
  assert.deepEqual(
    again.buildings.map((b) => [b.id, b.height, b.mass]),
    map.buildings.map((b) => [b.id, b.height, b.mass]),
  );
  const twins = map.buildings.filter((b) => b.id === 77 || b.id === 78001);
  assert.deepEqual(twins[0].points, twins[1].points);
  assert.ok(
    twins[0].height !== twins[1].height || twins[0].mass !== twins[1].mass,
  );
  assert.deepEqual(
    buildingHeight(77, {}),
    map.buildings.find((b) => b.id === 77).height,
  );
  assert.equal(buildingMass(77), map.buildings.find((b) => b.id === 77).mass);
});
test("a setback keeps the footprint outline and steps the upper mass inward", () => {
  const rect = [
    [0, 0],
    [12, 0],
    [12, 8],
    [0, 8],
  ];
  const inset = offsetPolygon(rect, 1);
  assert.equal(inset.length, 4);
  assert.ok(
    Math.abs(inset[0][0] - 1) < 0.05 && Math.abs(inset[0][1] - 1) < 0.05,
  );
  assert.ok(
    Math.abs(inset[2][0] - 11) < 0.05 && Math.abs(inset[2][1] - 7) < 0.05,
  );
  const pieces = massPieces({
    id: 77,
    points: rect,
    height: 15,
    mass: "setback",
  });
  const body = pieces.find((p) => p.kind === "footprint");
  const upper = pieces.find((p) => p.kind === "setback");
  assert.deepEqual(body.points, rect);
  assert.ok(body.height < 15);
  assert.equal(upper.points.length, 4);
  assert.ok(upper.y === body.height);
  assert.ok(upper.height > 0);
  assert.ok(
    upper.points.every((p, i) => p[0] !== rect[i][0] || p[1] !== rect[i][1]),
  );
  const shop = massPieces({ id: 3, points: rect, height: 9, mass: "shop" });
  assert.ok(
    shop.some((p) => p.kind === "shop" && p.width < 12.01 && p.width > 8),
  );
  const awning = massPieces({ id: 3, points: rect, height: 9, mass: "awning" });
  assert.ok(
    awning.some((p) => p.kind === "awning" && p.depth > 0.5 && p.y > 2),
  );
  const balcony = massPieces({
    id: 3,
    points: rect,
    height: 12,
    mass: "balcony",
  });
  assert.ok(balcony.some((p) => p.kind === "balcony"));
});
test("bundled Pune buildings are not one shared box or one shared height", () => {
  const data = JSON.parse(
    readFileSync(
      new URL("../public/data/pune-osm.json", import.meta.url),
      "utf8",
    ),
  );
  const map = parseOSM(data);
  assert.ok(map.buildings.length > 1000);
  const twelve = map.buildings.filter((b) => b.height === 12).length;
  assert.ok(twelve < map.buildings.length * 0.35);
  assert.ok(new Set(map.buildings.map((b) => b.height)).size > 8);
  const sample = map.buildings
    .filter((b) => b.points.length >= 4)
    .slice(0, 400);
  const signatures = new Set(
    sample.map((b) => {
      const xs = b.points.map((p) => p[0]);
      const zs = b.points.map((p) => p[1]);
      return `${b.points.length}:${(Math.max(...xs) - Math.min(...xs)).toFixed(1)}x${(Math.max(...zs) - Math.min(...zs)).toFixed(1)}`;
    }),
  );
  assert.ok(signatures.size > 40);
  assert.ok(map.buildings.some((b) => b.points.length > 8));
  const kinds = new Set(map.buildings.map((b) => b.mass));
  assert.equal(kinds.size, 4);
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
