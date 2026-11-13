import test from "node:test";
import assert from "node:assert/strict";
import {
  fallbackCity,
  parseOSM,
  project,
  segmentDistance,
  inside,
  gaitCycle,
  punchEnvelope,
  person,
  makeMotorcycle,
  splitRoadsAtJunctions,
  roadAdjacency,
  planTrip,
  tripPolyline,
  advanceAlong,
  chooseGoal,
  STREET_FLEET,
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
test("gait follows speed from idle through a walk into a run", () => {
  const idle = gaitCycle(1, 0);
  const walk = gaitCycle(1, 1.6);
  const run = gaitCycle(1, 5.2);
  assert.equal(idle.idle, true);
  assert.equal(idle.stride, 0);
  assert.equal(idle.knee, 0);
  assert.ok(walk.amount > 0.9);
  assert.ok(walk.run < 0.05);
  assert.ok(run.run > 0.9);
  assert.ok(run.stride > walk.stride);
  assert.ok(run.knee > walk.knee);
  assert.ok(run.lean > walk.lean);
  assert.equal(punchEnvelope(0), 0);
  assert.ok(punchEnvelope(0.9) < 0);
  assert.ok(punchEnvelope(0.4) > 0.5);
});
function crossRoads() {
  const parts = splitRoadsAtJunctions([
    { a: [-120, 0], b: [120, 0], width: 12 },
    { a: [0, -120], b: [0, 120], width: 12 },
  ]);
  return { parts, adj: roadAdjacency(parts) };
}
test("roads split into a junction instead of one reversible segment", () => {
  const { parts, adj } = crossRoads();
  assert.equal(parts.length, 4);
  assert.equal(adj.get("0.0,0.0").length, 4);
});
test("a trip leaves a junction on another exit even when the goal is behind", () => {
  const { parts, adj } = crossRoads();
  const west = parts.find((s) => s.b[0] === 0 && s.a[0] < 0 && s.a[1] === 0);
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
  const back = planTrip({
    adjacency: adj,
    fromSegment: west,
    atNode: "0.0,0.0",
    goal: [100, 0],
    minLength: 30,
    rng: () => 0,
  });
  assert.equal(back.endNode === "0.0,0.0", false);
});
test("a dead end turns around once and the next junction takes a different road", () => {
  const { parts, adj } = crossRoads();
  const east = parts.find((s) => s.a[0] === 0 && s.b[0] > 0 && s.a[1] === 0);
  const dead = planTrip({
    adjacency: adj,
    fromSegment: east,
    atNode: "120.0,0.0",
    goal: [200, 0],
    minLength: 20,
    rng: () => 0,
  });
  assert.equal(dead.steps[0].segment, east);
  assert.equal(dead.endNode, "0.0,0.0");
  const leave = planTrip({
    adjacency: adj,
    fromSegment: east,
    atNode: "0.0,0.0",
    goal: [0, 100],
    minLength: 30,
    rng: () => 0,
  });
  assert.notEqual(leave.steps[0].segment, east);
  assert.ok(leave.length >= 30);
});
test("a walker travels toward a goal and does not pace back over the same metres", () => {
  const { parts, adj } = crossRoads();
  const west = parts.find((s) => s.a[0] < 0 && s.b[0] === 0 && s.a[1] === 0);
  const trip = planTrip({
    adjacency: adj,
    fromSegment: west,
    fromT: 0.1,
    direction: 1,
    goal: [80, 40],
    minLength: 40,
    rng: () => 0.2,
  });
  assert.ok(trip.length >= 40);
  const points = tripPolyline(trip, () => 6);
  let state = {
    points,
    index: 0,
    x: points[0][0],
    z: points[0][1],
    speed: 1.35,
    yaw: 0,
  };
  const start = [state.x, state.z];
  let travelled = 0;
  let prev = [...start];
  while (!state.arrived && travelled < 70) {
    state = advanceAlong(state, 0.2);
    const step = Math.hypot(state.x - prev[0], state.z - prev[1]);
    travelled += step;
    prev = [state.x, state.z];
    if (travelled > 10) {
      assert.ok(
        Math.hypot(state.x - start[0], state.z - start[1]) > 8,
        "walker returned to the same spot",
      );
    }
  }
  const gained = Math.hypot(state.x - start[0], state.z - start[1]);
  assert.ok(gained > 25);
  assert.ok(Math.abs(gained - travelled) < 2);
  const next = chooseGoal(parts, [state.x, state.z], 24, () => 0.4);
  assert.ok(Math.hypot(next[0] - state.x, next[1] - state.z) >= 24);
});
test("motorcycles outnumber cars", () => {
  assert.ok(STREET_FLEET.motorcycles >= STREET_FLEET.cars * 3);
  const bike = makeMotorcycle(0xb4332a, 0xc4926a);
  assert.equal(bike.userData.kind, "motorcycle");
});
test("residents are varied Maharashtrian adults with a natural opposite-limb gait", () => {
  const people = Array.from({ length: 12 }, (_, i) => person(i));
  const roles = people.map((p) => p.userData.role);
  for (const garment of ["saree", "kurta", "shirt"])
    assert.ok(roles.some((r) => r.garment === garment));
  for (const gender of ["woman", "man"])
    assert.ok(roles.some((r) => r.gender === gender));
  for (const kind of ["student", "shop", "older"])
    assert.ok(roles.some((r) => r.kind === kind));
  assert.ok(new Set(roles.map((r) => r.height)).size >= 4);
  for (const role of roles) {
    assert.ok(role.height >= 1.5 && role.height <= 1.86);
    assert.ok(role.skin >= 0xb07050 && role.skin <= 0xf0d0b0);
  }
  const idleBody = person(0);
  idleBody.userData.walk(0, 0);
  const idle = idleBody.userData.pose();
  assert.ok(Math.abs(idle.leftArm) < 0.25);
  assert.ok(Math.abs(idle.rightArm) < 0.25);
  assert.ok(Math.abs(idle.leftArmZ) < 0.35);
  assert.ok(Math.abs(idle.rightArmZ) < 0.35);
  idleBody.userData.walk(0.25, 1.5);
  const step = idleBody.userData.pose();
  assert.ok(step.leftLeg * step.leftArm < 0);
  assert.ok(step.rightLeg * step.rightArm < 0);
  assert.ok(step.leftLeg * step.rightLeg < 0);
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
