import test from "node:test";
import assert from "node:assert/strict";
import {
  parseOSM,
  roadTitle,
  buildingLook,
  PLASTER,
  frontageName,
  SHOP_BOARDS,
  isShopFront,
  mapPlaces,
  vehicleSpec,
  makeVehicle,
  residentProfile,
  person,
  roadAdjacency,
  planTrip,
  rollVehicle,
  nodeKey,
  chooseGoal,
} from "../src/city.js";

test("OSM road and place names stay on the features that carried them", () => {
  const map = parseOSM({
    elements: [
      {
        id: 10,
        tags: {
          highway: "primary",
          name: "Gopal Krushna Gokhale Path",
          alt_name: "FC Road",
        },
        geometry: [
          { lat: 18.52, lon: 73.841 },
          { lat: 18.523, lon: 73.841 },
        ],
      },
      {
        id: 11,
        tags: { highway: "primary", name: "Karve Road" },
        geometry: [
          { lat: 18.51, lon: 73.84 },
          { lat: 18.51, lon: 73.845 },
        ],
      },
      {
        id: 12,
        tags: { highway: "residential" },
        geometry: [
          { lat: 18.515, lon: 73.842 },
          { lat: 18.515, lon: 73.843 },
        ],
      },
      {
        id: 20,
        tags: { building: "college", name: "Fergusson College" },
        geometry: [
          { lat: 18.521, lon: 73.842 },
          { lat: 18.522, lon: 73.842 },
          { lat: 18.522, lon: 73.843 },
          { lat: 18.521, lon: 73.842 },
        ],
      },
      {
        id: 21,
        tags: { building: "retail", shop: "mall", name: "Centro Mall" },
        geometry: [
          { lat: 18.518, lon: 73.844 },
          { lat: 18.519, lon: 73.844 },
          { lat: 18.519, lon: 73.845 },
          { lat: 18.518, lon: 73.844 },
        ],
      },
    ],
  });
  assert.equal(roadTitle(map.roads[0]), "Fergusson College Road");
  assert.equal(roadTitle(map.roads[1]), "Karve Road");
  assert.equal(roadTitle(map.roads[2]), "");
  assert.equal(
    roadTitle({ name: "Jangli Maharaj Path", altName: "JM Road" }),
    "Jangli Maharaj Road",
  );
  assert.equal(
    roadTitle({ name: "Vishnushastri Chiplunkar Path", altName: "Law College Road" }),
    "Law College Road",
  );
  assert.equal(roadTitle({ name: "Paud Road" }), "Paud Road");
  assert.equal(map.buildings[0].name, "Fergusson College");
  assert.equal(map.buildings[1].name, "Centro Mall");
  assert.equal(map.buildings[1].shop, "mall");
  const places = mapPlaces(map.buildings);
  assert.ok(places.some((p) => p.name === "Fergusson College"));
  assert.ok(places.some((p) => p.name === "Centro Mall" && p.named));
});

test("building plaster varies and shop bands are not one brown", () => {
  const looks = Array.from({ length: 24 }, (_, i) =>
    buildingLook({ id: i * 3 + 1, kind: "yes" }),
  );
  const plasters = new Set(looks.map((look) => look.plaster));
  assert.ok(plasters.size >= 6);
  for (const look of looks) {
    assert.ok(Object.values(PLASTER).includes(look.plaster));
    assert.ok([0x7c2f3b, 0x1f6b4a, 0x1d4f88, 0xc4892b].includes(look.band));
    assert.equal(look.glass, false);
  }
  const again = buildingLook({ id: 4, kind: "yes" });
  assert.equal(again.plaster, buildingLook({ id: 4, kind: "yes" }).plaster);
  const mall = buildingLook({ id: 8, kind: "retail", shop: "mall", name: "Centro Mall" });
  assert.equal(mall.glass, true);
  assert.equal(mall.plaster, 0xd5e4ee);
});

test("shop boards keep OSM names and otherwise stay stable and unbranded", () => {
  assert.equal(frontageName({ id: 4, name: "Deccan Gymkhana" }), "Deccan Gymkhana");
  assert.equal(frontageName({ id: 9 }), frontageName({ id: 9 }));
  assert.notEqual(frontageName({ id: 9 }), frontageName({ id: 10 }));
  const banned = /starbucks|mcdonald|ccd|dmart|reliance|chitale|kayani/i;
  for (const board of SHOP_BOARDS) assert.equal(banned.test(board.name), false);
  assert.ok(SHOP_BOARDS.some((board) => board.kind === "kirana" && board.name === "Apna Kirana"));
  assert.ok(SHOP_BOARDS.some((board) => board.name === "Laxmi Medical"));
  assert.ok(SHOP_BOARDS.some((board) => board.name === "FC Books"));
  assert.equal(isShopFront({ id: 21, shop: "mall", name: "Centro Mall" }), true);
  assert.equal(frontageName({ id: 3 }), SHOP_BOARDS[3 % SHOP_BOARDS.length].name);
});

test("traffic includes cars, buses, autos, and bikes with stable labels", () => {
  const specs = Array.from({ length: 16 }, (_, i) => vehicleSpec(i));
  for (const kind of ["car", "bus", "auto", "bike"])
    assert.ok(specs.some((spec) => spec.kind === kind));
  assert.ok(
    specs.filter((spec) => spec.kind === "bike").length >
      specs.filter((spec) => spec.kind === "bus").length,
  );
  const bus = specs.find((spec) => spec.kind === "bus");
  assert.equal(bus.label, "Bus");
  assert.ok(bus.route > 0);
  assert.match(bus.board, /^Bus \d+$/);
  const auto = makeVehicle(vehicleSpec(4));
  assert.equal(auto.userData.kind, "auto");
  assert.equal(auto.userData.label, "Auto");
  const paints = [];
  auto.traverse((o) => {
    if (o.isMesh && o.material?.color) paints.push(o.material.color.getHex());
  });
  assert.ok(paints.includes(0x141414));
  assert.ok(paints.includes(0xf0c31a));
  const cityBus = makeVehicle(vehicleSpec(7));
  assert.equal(cityBus.userData.kind, "bus");
  assert.equal(cityBus.userData.route, vehicleSpec(7).route);
  const bike = makeVehicle(vehicleSpec(0));
  assert.equal(bike.userData.kind, "bike");
  assert.equal(bike.userData.label, "Bike");
});

test("people keep ordinary stable names and mixed clothes", () => {
  const profiles = Array.from({ length: 12 }, (_, i) => residentProfile(i));
  assert.equal(residentProfile(2).name, residentProfile(2).name);
  assert.ok(new Set(profiles.map((p) => p.name)).size >= 8);
  for (const garment of ["shirt", "kurta", "saree", "college"])
    assert.ok(profiles.some((p) => p.garment === garment));
  assert.ok(profiles.some((p) => p.bag));
  for (const profile of profiles) {
    assert.ok(profile.skin >= 0xc07050 && profile.skin <= 0xf3d7bc);
    assert.equal(/shahrukh|tendulkar|modi/i.test(profile.name), false);
  }
  const a = person(1);
  const b = person(1);
  assert.equal(a.userData.name, b.userData.name);
  assert.equal(a.userData.role, "student");
  assert.equal(a.userData.garment, "college");
  a.userData.walk(0.4, 1);
});

function crossRoads() {
  const parts = [
    { a: [-80, 0], b: [0, 0], length: 80, width: 12, name: "Karve Road" },
    { a: [0, 0], b: [80, 0], length: 80, width: 12, name: "Karve Road" },
    { a: [0, 0], b: [0, 80], length: 80, width: 12, name: "Paud Road" },
    { a: [0, -80], b: [0, 0], length: 80, width: 12, name: "Bhandarkar Path" },
  ];
  return { parts, adj: roadAdjacency(parts) };
}

test("a vehicle leaves a junction toward its goal instead of reversing", () => {
  const { parts, adj } = crossRoads();
  const west = parts[0];
  const trip = planTrip({
    adjacency: adj,
    fromSegment: west,
    atNode: nodeKey([0, 0]),
    goal: [-70, 0],
    minLength: 30,
    rng: () => 0,
  });
  assert.notEqual(trip.steps[0].segment, west);
  assert.ok(trip.length >= 30);
  const north = planTrip({
    adjacency: adj,
    fromSegment: west,
    atNode: nodeKey([0, 0]),
    goal: [0, 70],
    minLength: 20,
    rng: () => 0,
  });
  assert.equal(north.steps[0].segment, parts[2]);
});

test("a dead end turns around once and the next road is a different one", () => {
  const { parts, adj } = crossRoads();
  const east = parts[1];
  const trip = planTrip({
    adjacency: adj,
    fromSegment: east,
    atNode: nodeKey(east.b),
    goal: [0, 70],
    minLength: 40,
    rng: () => 0,
  });
  assert.equal(trip.steps[0].segment, east);
  assert.equal(trip.steps[0].direction, -1);
  assert.notEqual(trip.steps[1].segment, east);
});

test("traffic keeps travelling toward a goal without pacing one segment", () => {
  const { parts, adj } = crossRoads();
  let state = {
    segment: parts[0],
    s: 0.7,
    direction: 1,
    speed: 12,
    goal: [0, 70],
    minLength: 50,
  };
  const samples = [];
  for (let i = 0; i < 24; i++) {
    state = rollVehicle(state, 0.4, adj, parts, () => 0);
    samples.push([state.x, state.z]);
  }
  assert.ok(samples.some((p) => p[1] > 15), "never reached the north road");
  const northward = samples.filter((p) => p[1] > 10);
  assert.ok(northward.every((p) => p[0] > -5));
  const end = samples[samples.length - 1];
  const start = [parts[0].a[0] + 80 * 0.7, 0];
  assert.ok(Math.hypot(end[0] - start[0], end[1] - start[1]) > 25);
  const goal = chooseGoal(parts, [0, 0], 50, () => 0.9);
  assert.ok(Math.hypot(goal[0], goal[1]) >= 50);
});
