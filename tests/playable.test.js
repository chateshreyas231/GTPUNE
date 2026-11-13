import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  parseOSM,
  project,
  person,
  orbitLook,
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

test("fuel, gyms, and grounds use ordinary names and keep footprints", () => {
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
    ],
  });
  assert.equal(map.buildings[0].points.length, 5);
  assert.equal(map.buildings[0].height, 11);
  assert.equal(map.buildings[0].points[0][0], project(18.5164, 73.8413)[0]);
  for (const kind of ["fuel", "gym", "ground"])
    assert.ok(map.places.some((place) => place.kind === kind), kind);
  const names = map.places.map((place) => place.name).join(" | ");
  assert.match(names, /Fuel/);
  assert.match(names, /Gym/);
  assert.match(names, /Ground/);
  assert.doesNotMatch(names, /Autolines|Body Fuel|HPCL|Indian Oil|BPCL|Gold/i);
  for (const label of Object.values(BODY_LABELS)) assert.ok(ALLOWED.has(label));
});
