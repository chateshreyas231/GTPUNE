import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  placeKind,
  placesFromElements,
  supplementPlaces,
  makePlace,
  PLACE_MARKS,
} from "../src/places.js";

test("place kinds follow fuel, gym, and ground tags", () => {
  assert.equal(placeKind({ amenity: "fuel" }), "fuel");
  assert.equal(placeKind({ amenity: "gym" }), "gym");
  assert.equal(placeKind({ leisure: "fitness_centre" }), "gym");
  assert.equal(
    placeKind({ leisure: "fitness_centre", sport: "fitness" }),
    "gym",
  );
  assert.equal(placeKind({ leisure: "pitch" }), "ground");
  assert.equal(placeKind({ leisure: "playground" }), "ground");
  assert.equal(placeKind({ leisure: "track" }), "ground");
  assert.equal(placeKind({ sport: "cricket" }), "ground");
  assert.equal(placeKind({ highway: "primary" }), null);
});

test("OSM names are kept and missing kinds are filled on FC, Deccan, and Kothrud", () => {
  const found = placesFromElements([
    {
      tags: { amenity: "fuel", name: "Autolines Petrol Pump" },
      geometry: [
        { lat: 18.5316, lon: 73.8436 },
        { lat: 18.5317, lon: 73.8437 },
      ],
    },
    {
      tags: { amenity: "fuel", name: "Kothrud Petrol Circle" },
      geometry: [{ lat: 18.5024, lon: 73.8151 }],
    },
    {
      tags: { leisure: "fitness_centre" },
      lat: 18.5085,
      lon: 73.8162,
    },
  ]);
  const places = supplementPlaces(found);
  assert.equal(
    places.filter((p) => p.kind === "fuel" && p.source === "neighbourhood")
      .length,
    0,
  );
  assert.ok(places.some((p) => p.name === "Autolines Petrol Pump"));
  assert.ok(places.some((p) => p.name === "Kothrud Gym" && p.kind === "gym"));
  for (const name of ["FC Ground", "Deccan Ground", "Kothrud Ground"])
    assert.ok(places.some((p) => p.name === name));
  for (const place of places.filter((p) => p.source === "neighbourhood")) {
    assert.ok(place.lat >= 18.49 && place.lat <= 18.54);
    assert.ok(place.lon >= 73.78 && place.lon <= 73.86);
  }
  const marks = ["fuel", "gym", "ground"].map(
    (kind) => PLACE_MARKS[kind].color,
  );
  assert.equal(new Set(marks).size, 3);
});

test("the bundled extract shows pumps, gyms, and grounds", () => {
  const data = JSON.parse(
    readFileSync(
      new URL("../public/data/pune-osm.json", import.meta.url),
      "utf8",
    ),
  );
  const places = supplementPlaces(placesFromElements(data.elements));
  for (const name of [
    "Kothrud Petrol Circle",
    "Autolines Petrol Pump",
    "Body Fuel Fitness Club",
    "FC Ground",
    "Deccan Ground",
    "Kothrud Ground",
  ])
    assert.ok(
      places.some((p) => p.name === name),
      name,
    );
  assert.ok(places.some((p) => p.kind === "fuel"));
  assert.ok(places.some((p) => p.kind === "gym"));
  assert.ok(places.some((p) => p.kind === "ground"));
});

test("place markers are original meshes with a canopy, a front, or markings", () => {
  const fuel = makePlace({
    kind: "fuel",
    name: "FC Fuel",
    point: [0, 0],
  });
  const gym = makePlace({
    kind: "gym",
    name: "Deccan Gym",
    point: [12, 4],
  });
  const ground = makePlace({
    kind: "ground",
    name: "Kothrud Ground",
    point: [-8, 6],
  });
  assert.ok(fuel.userData.parts.includes("canopy"));
  assert.ok(fuel.userData.parts.includes("pump"));
  assert.ok(gym.userData.parts.includes("front"));
  assert.ok(ground.userData.parts.includes("marking"));
  assert.equal(fuel.userData.kind, "fuel");
  assert.equal(gym.position.x, 12);
  assert.equal(ground.position.z, 6);
});
