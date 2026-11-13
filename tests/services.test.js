import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  CITY_SERVICES,
  SERVICE_BODIES,
  SIREN_TONES,
  applyWander,
  beaconLit,
  junkieProfile,
  laneLateral,
  makeVehicle,
  nextWander,
  officerProfile,
  passage,
  person,
  serviceFleet,
  serviceLateral,
  sidewalkLateral,
  sirenFrequency,
} from "../src/city.js";
import { blocksMove, bodyRadius } from "../src/harm.js";

function named(root, name) {
  const found = [];
  root.traverse((child) => {
    if (child.name === name) found.push(child);
  });
  return found;
}

test("city services ride in the car lane and stop for people", () => {
  assert.equal(CITY_SERVICES.officers >= 4, true);
  assert.ok(CITY_SERVICES.junkies >= 3 && CITY_SERVICES.junkies <= 5);
  assert.ok(CITY_SERVICES.policeCars >= 2);
  assert.ok(CITY_SERVICES.ambulances >= 1);
  assert.ok(CITY_SERVICES.fireEngines >= 1);
  const fleet = serviceFleet();
  assert.equal(fleet.filter((body) => body.startsWith("police-")).length, CITY_SERVICES.policeCars);
  assert.equal(fleet.filter((body) => body === "ambulance-van").length, CITY_SERVICES.ambulances);
  assert.equal(fleet.filter((body) => body === "fire-engine").length, CITY_SERVICES.fireEngines);
  const road = { width: 10 };
  assert.equal(serviceLateral(road, 1), laneLateral(road, "car", 1));
  assert.notEqual(serviceLateral(road, 1), sidewalkLateral(road, 1));
  assert.ok(bodyRadius("fire") > bodyRadius("ambulance"));
  assert.ok(bodyRadius("ambulance") > bodyRadius("car"));
  const person = { x: 0, z: 0 };
  const blocked = passage({ x: 1.4, z: 0, kind: "ambulance", people: [person], bodies: [] });
  assert.equal(blocked.clear, false);
  assert.equal(blocked.hit, person);
  const open = passage({ x: 9, z: 0, kind: "fire", people: [person], bodies: [] });
  assert.equal(open.clear, true);
  assert.equal(open.hit, null);
  const queued = passage({
    x: 0,
    z: 0,
    kind: "police",
    people: [],
    bodies: [{ x: 1.6, z: 0, radius: bodyRadius("car") }],
  });
  assert.equal(queued.blocked, true);
  assert.equal(queued.clear, false);
  assert.equal(
    blocksMove(0, 0, bodyRadius("fire"), [{ x: 2, z: 0, radius: bodyRadius("person") }]),
    true,
  );
});

test("service meshes are original geometry with a synthesized siren", () => {
  const seen = new Set();
  for (const body of SERVICE_BODIES) {
    const mesh = makeVehicle(body);
    mesh.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    const signature = [mesh.userData.kind, mesh.userData.label, size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2)].join("|");
    assert.equal(seen.has(signature), false);
    seen.add(signature);
    if (mesh.userData.assetFile) assert.match(mesh.userData.assetFile,/\.glb$/);
    else assert.ok(mesh.userData.beacons.length >= 2);
    assert.ok(mesh.userData.siren.low < mesh.userData.siren.high);
    assert.equal(mesh.userData.siren.sample, undefined);
    mesh.traverse((child) => {
      if (!child.isMesh) return;
      const list = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of list) {
        assert.equal(material.map, null);
      }
    });
  }
  assert.ok(named(makeVehicle("ambulance-van"), "cross").length >= 2);
  assert.ok(named(makeVehicle("fire-engine"), "ladder").length >= 2);
  assert.equal(named(makeVehicle("fire-engine"), "hose").length, 1);
  const tones = Object.values(SIREN_TONES);
  assert.equal(new Set(tones.map((tone) => tone.rate)).size, tones.length);
  assert.equal(new Set(tones.map((tone) => tone.type)).size, tones.length);
  for (const tone of tones) {
    assert.equal(JSON.stringify(tone).match(/mp3|wav|ogg|http/i), null);
    const mid = sirenFrequency(tone, 0);
    const high = sirenFrequency(tone, 0.25 / tone.rate);
    assert.ok(mid > tone.low && mid < tone.high);
    assert.ok(Math.abs(high - tone.high) < 0.001);
    assert.equal(beaconLit(tone.rate, 0), true);
    assert.equal(beaconLit(tone.rate, 0.75 / tone.rate), false);
  }
});

test("officers wear a cap and wanderers pause, slouch, and turn back", () => {
  const officer = person(0, { role: officerProfile(0) });
  assert.equal(officer.userData.service, "police");
  assert.equal(named(officer, "cap").length, 1);
  assert.equal(named(officer, "lathi").length, 1);
  const wanderer = person(1, { role: junkieProfile(0) });
  assert.equal(wanderer.userData.service, "junkie");
  assert.equal(wanderer.userData.slouch, true);
  assert.equal(named(wanderer, "slouch").length, 1);
  const rolls = [0.1, 0];
  const paused = nextWander({ speed: 0.5, wait: 0, rng: () => rolls.shift() }, 0.1);
  assert.equal(paused.speed, 0);
  assert.equal(paused.reverse, false);
  const held = nextWander({ speed: 0.2, wait: 1, rng: () => 0 }, 0.1);
  assert.equal(held.speed, 0.2);
  assert.ok(held.wait < 1);
  const path = [
    [0, 0],
    [2, 0],
    [4, 0],
    [6, 0],
  ];
  const agent = {
    speed: 0.5,
    wait: 0,
    index: 2,
    x: 4,
    z: 0,
    points: path.map((point) => [...point]),
    rng: (() => {
      const values = [0.5, 0, 0];
      return () => values.shift();
    })(),
  };
  applyWander(agent, 0.2);
  assert.ok(agent.speed > 0 && agent.speed < 0.7);
  assert.equal(agent.index, 0);
  assert.equal(agent.x, 4);
  assert.deepEqual(agent.points[0], [4, 0]);
  assert.deepEqual(agent.points.at(-1), [0, 0]);
});
