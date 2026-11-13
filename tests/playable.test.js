import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import {
  parseOSM,
  project,
  person,
  orbitLook,
  footLookActive,
  footPace,
  beginJump,
  WALK_SPEED,
  RUN_SPEED,
  splitRoadsAtJunctions,
  roadAdjacency,
  planTrip,
  tripPolyline,
  advanceAlong,
  chooseGoal,
  fillBuildingGaps,
  segmentDistance,
  STREET_FLEET,
  fleetBody,
  makeVehicle,
  makeMotorcycle,
  VEHICLE_TONES,
  BODY_LABELS,
  distanceGain,
  CAR_BODIES,
  BIKE_BODIES,
} from "../src/city.js";
import {
  applyImpact,
  applyStrike,
  blocksMove,
  bodyRadius,
  canWalk,
  crashFromImpact,
  pickupWeapon,
  resumeWalking,
  strikeHit,
} from "../src/harm.js";

const ALLOWED = new Set([
  "Compact SUV",
  "Boxy Off-roader",
  "Tall SUV",
  "Scooter",
  "Moped",
  "Geared Bike",
]);

function crossRoads() {
  const parts = splitRoadsAtJunctions([
    { a: [-120, 0], b: [120, 0], width: 12 },
    { a: [0, -120], b: [0, 120], width: 12 },
  ]);
  return { parts, adj: roadAdjacency(parts) };
}

test("mouse look orbits, shift runs, and space jumps", () => {
  const looked = orbitLook(0.2, 0.3, 20, -10);
  assert.ok(looked.yaw < 0.2);
  assert.ok(looked.pitch > 0.3);
  assert.equal(footLookActive({ walking: true }), true);
  assert.equal(footLookActive({ walking: false }), false);
  assert.equal(footLookActive({ walking: true, overMap: true }), false);
  assert.equal(footLookActive({ walking: true, draggingMap: true }), false);
  assert.equal(footLookActive({ walking: true, paused: true }), false);
  assert.equal(footPace(false), WALK_SPEED);
  assert.ok(footPace(true) > footPace(false));
  assert.equal(RUN_SPEED, footPace(true));
  const hop = beginJump({ queued: true, y: 0, vy: 0 });
  assert.equal(hop.jumped, true);
  assert.ok(hop.vy > 4);
  assert.equal(hop.queued, false);
  assert.equal(beginJump({ queued: true, y: 1, vy: 0 }).jumped, false);
});

test("residents mix students, shop workers, and older people in wheatish skin", () => {
  const people = Array.from({ length: 12 }, (_, i) => person(i));
  const roles = people.map((body) => body.userData.role);
  for (const garment of ["saree", "kurta", "shirt"])
    assert.ok(roles.some((role) => role.garment === garment));
  for (const kind of ["student", "shop", "older"])
    assert.ok(roles.some((role) => role.kind === kind));
  for (const role of roles) {
    assert.ok(role.skin >= 0xc89870 && role.skin <= 0xe8c4a2);
    assert.ok(role.name && !/celebrity|khan|tendulkar/i.test(role.name));
  }
  const idle = person(2);
  idle.userData.walk(0, 0);
  const still = idle.userData.pose();
  assert.ok(Math.abs(still.leftArm) < 0.05);
  idle.userData.walk(0.25, 1.6);
  const step = idle.userData.pose();
  assert.ok(step.leftLeg * step.leftArm < 0);
  assert.ok(step.rightLeg * step.rightArm < 0);
  assert.ok(step.leftLeg * step.rightLeg < 0);
});

test("two-wheelers outnumber cars and each body is its own mesh and tone", () => {
  assert.ok(STREET_FLEET.motorcycles >= STREET_FLEET.cars * 3);
  const bodies = [...BIKE_BODIES, ...CAR_BODIES];
  const seen = new Set();
  for (const body of bodies) {
    const mesh = makeVehicle(body, 0x889977);
    mesh.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    const signature = [
      mesh.userData.kind,
      mesh.userData.label,
      size.x.toFixed(2),
      size.y.toFixed(2),
      size.z.toFixed(2),
      mesh.userData.spare ? "spare" : "",
      mesh.userData.tank ? "tank" : "",
      mesh.userData.apron || "",
    ].join("|");
    assert.ok(!seen.has(signature), signature);
    seen.add(signature);
    assert.ok(ALLOWED.has(mesh.userData.label));
    assert.ok(mesh.userData.exhaust[2] > 0);
    const tone = VEHICLE_TONES[body];
    assert.ok(tone.hornFreq > 40 && tone.engineBase > 20);
    assert.equal(tone, mesh.userData.tone);
  }
  const horns = new Set(bodies.map((body) => VEHICLE_TONES[body].hornFreq));
  const engines = new Set(
    bodies.map((body) => `${VEHICLE_TONES[body].engineType}:${VEHICLE_TONES[body].engineBase}`),
  );
  assert.equal(horns.size, bodies.length);
  assert.equal(engines.size, bodies.length);
  assert.equal(makeMotorcycle().userData.kind, "motorcycle");
  assert.equal(distanceGain(0), 1);
  assert.equal(distanceGain(46), 0);
  assert.ok(distanceGain(10) > distanceGain(30));
  const bikes = Array.from({ length: STREET_FLEET.motorcycles }, (_, i) => fleetBody(i));
  const cars = Array.from({ length: STREET_FLEET.cars }, (_, i) =>
    fleetBody(STREET_FLEET.motorcycles + i),
  );
  assert.ok(bikes.every((body) => BIKE_BODIES.includes(body)));
  assert.ok(cars.every((body) => CAR_BODIES.includes(body)));
  assert.ok(new Set(bikes).size === BIKE_BODIES.length);
  assert.ok(new Set(cars).size === CAR_BODIES.length);
  const named = (root, name) => {
    let found = null;
    root.traverse((child) => {
      if (child.name === name) found = child;
    });
    return found;
  };
  for (const body of CAR_BODIES) {
    const hood = named(makeVehicle(body), "hood");
    assert.ok(hood, body);
    assert.notEqual(hood.geometry.type, "BoxGeometry");
  }
  const tank = named(makeVehicle("geared-bike"), "tank");
  assert.equal(tank.geometry.type, "LatheGeometry");
});

test("a trip continues through a junction instead of pacing back", () => {
  const { parts, adj } = crossRoads();
  assert.equal(parts.length, 4);
  const west = parts.find((segment) => segment.a[0] < 0 && segment.b[0] === 0);
  const trip = planTrip({
    adjacency: adj,
    fromSegment: west,
    atNode: "0.0,0.0",
    goal: [-100, 0],
    minLength: 30,
    rng: () => 0,
  });
  assert.notEqual(trip.steps[0].segment, west);
  assert.ok(trip.length >= 30);
  const points = tripPolyline(trip, () => 4);
  let state = {
    points,
    index: 0,
    x: points[0][0],
    z: points[0][1],
    speed: 1.4,
    yaw: 0,
  };
  const start = [state.x, state.z];
  let travelled = 0;
  let prev = [...start];
  while (!state.arrived && travelled < 80) {
    state = advanceAlong(state, 0.2);
    travelled += Math.hypot(state.x - prev[0], state.z - prev[1]);
    prev = [state.x, state.z];
    if (travelled > 12)
      assert.ok(Math.hypot(state.x - start[0], state.z - start[1]) > 8);
  }
  assert.ok(Math.hypot(state.x - start[0], state.z - start[1]) > 20);
  const next = chooseGoal(parts, [state.x, state.z], 24, () => 0.4);
  assert.ok(Math.hypot(next[0] - state.x, next[1] - state.z) >= 24);
});

test("places keep the OpenStreetMap name and skip kinds the extract does not tag", () => {
  const map = parseOSM({
    elements: [
      {
        id: 1,
        tags: { highway: "residential", name: "FC Road", lanes: "2" },
        geometry: [
          { lat: 18.516, lon: 73.841 },
          { lat: 18.523, lon: 73.841 },
        ],
      },
      {
        id: 8,
        tags: { building: "commercial", height: "11" },
        geometry: [
          { lat: 18.5164, lon: 73.8413 },
          { lat: 18.5165, lon: 73.8413 },
          { lat: 18.5165, lon: 73.8414 },
          { lat: 18.5164, lon: 73.8414 },
          { lat: 18.5164, lon: 73.8413 },
        ],
      },
      {
        id: 9,
        tags: { amenity: "fuel", name: "Autolines Petrol Pump" },
        lat: 18.52,
        lon: 73.841,
      },
      {
        id: 10,
        tags: { leisure: "fitness_centre", name: "Body Fuel Fitness Club" },
        lat: 18.518,
        lon: 73.84,
      },
      {
        id: 11,
        tags: { amenity: "school", name: "GR Palkar Primary School" },
        lat: 18.519,
        lon: 73.842,
      },
    ],
  });
  assert.equal(map.buildings[0].points.length, 5);
  assert.equal(map.buildings[0].height, 11);
  assert.equal(map.buildings[0].points[0][0], project(18.5164, 73.8413)[0]);
  assert.deepEqual(
    map.places.map((place) => place.kind).sort(),
    ["fuel", "gym", "school"],
  );
  const names = map.places.map((place) => place.name);
  assert.ok(names.includes("Autolines Petrol Pump"));
  assert.ok(names.includes("Body Fuel Fitness Club"));
  assert.ok(names.includes("GR Palkar Primary School"));
  assert.equal(map.places.some((place) => place.osm === false), false);
  for (const invented of ["Kothrud Fuel", "Deccan Gym", "FC Ground", "Kothrud Ground"])
    assert.equal(names.includes(invented), false);
  for (const label of Object.values(BODY_LABELS)) assert.ok(ALLOWED.has(label));
});

function rect(x, z, w, d, height) {
  return {
    points: [
      [x, z],
      [x + w, z],
      [x + w, z + d],
      [x, z + d],
    ],
    height,
    floors: 3,
    heightSource: "height-tag",
  };
}

function hitsCarriageway(points, roads) {
  for (const road of roads) {
    const half = (road.width || 7) / 2;
    const samples = points.slice();
    let sx = 0,
      sz = 0;
    for (const p of points) {
      sx += p[0];
      sz += p[1];
    }
    samples.push([sx / points.length, sz / points.length]);
    for (const [x, z] of samples) {
      const pts = road.points;
      for (let i = 1; i < pts.length; i++) {
        if (segmentDistance(x, z, pts[i - 1], pts[i]) < half) return true;
      }
    }
  }
  return false;
}

test("infill closes a gap between footprints and does not cover the road", () => {
  const roads = [{ points: [[0, -10], [0, 80]], width: 8, sidewalk: 1.6 }];
  const west = rect(-18, 6, 8, 16, 9);
  const next = rect(-18, 28, 8, 16, 15);
  const across = rect(8, 6, 8, 16, 12);
  const surveyed = [west, next, across].map((building) =>
    building.points.map((point) => point.slice()),
  );
  const infill = fillBuildingGaps([west, next, across], roads);
  assert.deepEqual(
    [west, next, across].map((building) => building.points),
    surveyed,
  );
  assert.ok(infill.length >= 1);
  assert.ok(infill.every((building) => building.infill));
  assert.ok(infill.every((building) => !hitsCarriageway(building.points, roads)));
  const sidewalk = 8 / 2 + 1.6;
  for (const building of infill)
    for (const [x] of building.points) assert.ok(Math.abs(x) >= sidewalk - 0.05);
  const heights = infill.map((building) => building.height);
  assert.ok(heights.every((height) => height >= 9 && height <= 15));
  const lone = fillBuildingGaps([west], roads);
  assert.equal(lone.length, 0);
});

test("infill fills open ground up to the sidewalk at the neighbours' height", () => {
  const width = 6;
  const sidewalk = 1.6;
  const roads = [{ points: [[0, -30], [0, 90]], width, sidewalk }];
  const front = rect(-28, 8, 12, 20, 15);
  const beside = rect(-28, 36, 12, 18, 9);
  const original = front.points.map((point) => point.slice());
  const infill = fillBuildingGaps([front, beside], roads);
  assert.deepEqual(front.points, original);
  const wall = infill.filter((building) =>
    building.points.some(([x]) => x > -16 && x < 0),
  );
  assert.ok(wall.length >= 1);
  const kerb = width / 2 + sidewalk;
  for (const building of wall) {
    const xs = building.points.map(([x]) => x);
    assert.ok(Math.min(...xs) >= -16 + 0.7);
    assert.ok(Math.max(...xs) <= -kerb + 0.05);
    assert.ok(Math.max(...xs) > -kerb - 1.4);
    assert.equal(building.height, 12);
  }
});

test("a vehicle impact leaves the player alive and a hard hit can still kill a pedestrian", () => {
  const player = { health: 3, x: 0, z: 0, down: false, dead: false };
  const knocked = applyImpact(player, crashFromImpact(12), 1, 0, { survive: true });
  assert.equal(knocked.down, true);
  assert.equal(knocked.dead, false);
  assert.ok(knocked.health > 0);
  const again = applyImpact(
    { ...knocked, down: false },
    crashFromImpact(20),
    1,
    0,
    { survive: true },
  );
  assert.equal(again.dead, false);
  assert.ok(again.health > 0);
  assert.equal(resumeWalking({ ...again, downUntil: Infinity }, 999), false);
  const pedestrian = { health: 3, x: 2, z: 0, down: false, dead: false };
  const killed = applyImpact(pedestrian, crashFromImpact(12), 1, 0);
  assert.equal(killed.down, true);
  assert.equal(killed.dead, true);
  assert.equal(killed.health, 0);
  assert.equal(canWalk(killed), false);
  assert.equal(resumeWalking(killed, 999), false);
});

test("a car impact knocks a person down and a dead person stays down", () => {
  const person = { health: 3, x: 0, z: 0, down: false, dead: false };
  const hard = applyImpact(person, crashFromImpact(12), 1, 0);
  assert.equal(hard.down, true);
  assert.equal(hard.dead, true);
  assert.equal(canWalk(hard), false);
  assert.equal(resumeWalking(hard, 999), false);
  const bruise = applyImpact(person, crashFromImpact(4), 0, 1);
  assert.equal(bruise.down, true);
  assert.equal(bruise.dead, false);
  assert.equal(canWalk(bruise), false);
  assert.equal(blocksMove(0, 0, bodyRadius("car"), [{ x: 1, z: 0, radius: bodyRadius("person") }]), true);
  assert.equal(blocksMove(8, 0, bodyRadius("car"), [{ x: 1, z: 0, radius: 0.45 }]), false);
});

test("a picked-up street weapon registers a hit", () => {
  const weapon = pickupWeapon("pipe");
  assert.equal(weapon.name, "Pipe");
  const hit = strikeHit({ weapon, distance: 1.2, facingDot: 0.9 });
  assert.equal(hit.hit, true);
  const victim = applyStrike({ health: 3, down: false, dead: false }, hit);
  assert.equal(victim.down, true);
  assert.equal(victim.dead, true);
  assert.equal(canWalk(victim), false);
  const miss = strikeHit({ weapon, distance: 4, facingDot: 1 });
  assert.equal(miss.hit, false);
  const stick = pickupWeapon("stick");
  const tap = applyStrike({ health: 3 }, strikeHit({ weapon: stick, distance: 1, facingDot: 1 }));
  assert.equal(tap.down, true);
  assert.equal(tap.dead, false);
});

test("the Pune extract contributes only tagged places", () => {
  const map = parseOSM(
    JSON.parse(readFileSync(new URL("../public/data/pune-osm.json", import.meta.url), "utf8")),
  );
  const count = (kind) => map.places.filter((place) => place.kind === kind).length;
  assert.equal(count("school"), 4);
  assert.equal(count("college"), 4);
  assert.equal(count("store"), 17);
  assert.equal(count("playground"), 0);
  assert.equal(count("fuel"), 2);
  assert.equal(count("gym"), 4);
  assert.equal(map.places.length, 31);
  assert.equal(map.buildings.filter((building) => !building.infill).length, 19850);
  assert.ok(map.infill > 0);
  assert.equal(map.places.some((place) => place.osm === false), false);
  for (const invented of ["Kothrud Fuel", "Deccan Gym", "FC Ground", "Kothrud Ground", "FC Fuel"])
    assert.equal(map.places.some((place) => place.name === invented), false);
});
