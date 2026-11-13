import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  VEHICLE_TYPES,
  planTraffic,
  makeVehicle,
  hornSpec,
  engineSpec,
  distanceGain,
  createSmoke,
  stepSmoke,
} from "../src/vehicles.js";

const BANNED =
  /kia|seltos|thar|mahindra|scorpio|activa|jupiter|splendor|rx\s?100|honda|tvs|hero|yamaha|suzuki/i;

function sizeOf(id) {
  const mesh = makeVehicle(id);
  mesh.updateMatrixWorld(true);
  const size = new THREE.Box3()
    .setFromObject(mesh)
    .getSize(new THREE.Vector3());
  return [size.x, size.y, size.z].map((v) => Math.round(v * 100) / 100);
}

test("traffic catalog uses original type labels", () => {
  const labels = VEHICLE_TYPES.map((t) => t.label);
  for (const label of [
    "City Car",
    "Rickshaw",
    "Compact SUV",
    "Boxy Off-roader",
    "Tall SUV",
    "Scooter",
    "City Scooter",
    "Moped",
    "Geared Bike",
  ])
    assert.ok(labels.includes(label), label);
  for (const type of VEHICLE_TYPES)
    assert.equal(BANNED.test(type.label), false);
  assert.equal(
    new Set(VEHICLE_TYPES.map((t) => t.id)).size,
    VEHICLE_TYPES.length,
  );
});

test("new car bodies are different shapes, not recolors", () => {
  const city = sizeOf("city-car");
  const bodies = ["compact-suv", "boxy-offroader", "tall-suv"].map(sizeOf);
  for (const body of bodies) assert.notDeepEqual(body, city);
  assert.notDeepEqual(bodies[0], bodies[1]);
  assert.notDeepEqual(bodies[1], bodies[2]);
  assert.notDeepEqual(bodies[0], bodies[2]);
  const compact = makeVehicle("compact-suv");
  assert.ok(compact.userData.parts.includes("roof-rail"));
  assert.ok(compact.userData.parts.includes("hatch"));
  const boxy = makeVehicle("boxy-offroader");
  assert.ok(boxy.userData.parts.includes("spare-wheel"));
  assert.ok(boxy.userData.parts.includes("wheel-arch"));
  const tall = makeVehicle("tall-suv");
  assert.ok(tall.userData.parts.includes("bonnet"));
  assert.ok(tall.userData.parts.includes("quarter-glass"));
  assert.ok(
    tall.userData.length > makeVehicle("boxy-offroader").userData.length,
  );
});

test("two-wheelers are distinct and outnumber cars", () => {
  const scooter = makeVehicle("scooter");
  const cityScooter = makeVehicle("city-scooter");
  const moped = makeVehicle("moped");
  const geared = makeVehicle("geared-bike");
  for (const bike of [scooter, cityScooter, moped, geared])
    assert.equal(bike.userData.class, "bike");
  assert.ok(scooter.userData.parts.includes("floorboard"));
  assert.ok(scooter.userData.parts.includes("apron"));
  assert.notEqual(scooter.userData.apron.w, cityScooter.userData.apron.w);
  assert.notEqual(scooter.userData.tailBox.d, cityScooter.userData.tailBox.d);
  assert.ok(moped.userData.wheelRadius < scooter.userData.wheelRadius);
  assert.ok(moped.userData.parts.includes("step"));
  for (const part of ["tank", "engine-block", "chain", "grab-rail"])
    assert.ok(geared.userData.parts.includes(part));
  assert.equal(geared.userData.parts.includes("floorboard"), false);
  const ids = planTraffic(48);
  const cars = ids.filter(
    (id) => VEHICLE_TYPES.find((t) => t.id === id).class === "car",
  );
  const bikes = ids.filter(
    (id) => VEHICLE_TYPES.find((t) => t.id === id).class === "bike",
  );
  assert.ok(bikes.length >= cars.length * 3);
  for (const type of VEHICLE_TYPES) assert.ok(ids.includes(type.id));
});

test("each vehicle type has its own horn and engine, quieter with distance", () => {
  const horns = new Set(
    VEHICLE_TYPES.map((t) => JSON.stringify(hornSpec(t.id))),
  );
  const engines = new Set(
    VEHICLE_TYPES.map((t) => JSON.stringify(engineSpec(t.id))),
  );
  assert.equal(horns.size, VEHICLE_TYPES.length);
  assert.equal(engines.size, VEHICLE_TYPES.length);
  assert.equal(distanceGain(0), 1);
  assert.equal(distanceGain(90), 0);
  assert.ok(distanceGain(40) < distanceGain(8));
  for (const type of VEHICLE_TYPES) {
    assert.ok(hornSpec(type.id).tones.length >= 1);
    assert.ok(engineSpec(type.id).base > 0);
  }
});

test("exhaust smoke fades and does not leave a trail mesh", () => {
  const host = new THREE.Group();
  const smoke = createSmoke(host, 1.4);
  const before = host.children.length;
  stepSmoke(smoke, 0.2, true);
  assert.ok(smoke.puffs.some((puff) => puff.material.opacity > 0));
  for (let i = 0; i < 12; i++) stepSmoke(smoke, 0.2, false);
  assert.ok(smoke.puffs.every((puff) => puff.material.opacity === 0));
  assert.equal(host.children.length, before);
});
