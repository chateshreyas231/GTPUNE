import test from "node:test";
import assert from "node:assert/strict";
import { lines, streetTalk } from "../src/dialogue.js";
import {
  BLUE_HOUR,
  GOLDEN_HOUR,
  advanceHour,
  claimGroups,
  faceYaw,
  formatClock,
  nearbyTalk,
  phaseForHour,
  plantVariant,
  seedCritters,
  shouldYield,
  skyForHour,
  stepRoadAgent,
  tickCritter,
  vehiclePose,
} from "../src/living.js";

test("golden hour and blue hour keep the existing light presets", () => {
  const golden = skyForHour(GOLDEN_HOUR, false);
  assert.equal(formatClock(GOLDEN_HOUR), "17:42");
  assert.equal(golden.phase, "golden");
  assert.equal(golden.sky, 0xc6c8ac);
  assert.equal(golden.sunIntensity, 3.5);
  assert.equal(golden.hemi, 2.3);
  assert.equal(golden.sunVisible, true);
  assert.equal(golden.moonVisible, false);
  const blue = skyForHour(BLUE_HOUR, false);
  assert.equal(blue.phase, "blue");
  assert.equal(blue.sky, 0x526675);
  assert.equal(blue.sunIntensity, 0.4);
  assert.equal(blue.hemi, 1);
  assert.equal(blue.moonVisible, true);
});

test("the sun crosses the sky and the moon takes the night", () => {
  const noon = skyForHour(12, false);
  assert.equal(phaseForHour(12), "day");
  assert.equal(noon.phase, "day");
  assert.ok(noon.sun.y > 0.95);
  assert.equal(noon.sunVisible, true);
  assert.equal(noon.moonVisible, false);
  assert.equal(noon.lamps, 0);
  const rise = skyForHour(6, false);
  assert.ok(rise.sun.x > 0.8);
  assert.ok(Math.abs(rise.sun.y) < 0.08);
  const set = skyForHour(18, false);
  assert.ok(set.sun.x < -0.8);
  const night = skyForHour(22, false);
  assert.equal(night.phase, "night");
  assert.ok(night.sun.y < 0);
  assert.equal(night.sunVisible, false);
  assert.ok(night.moon.y > 0.4);
  assert.equal(night.moonVisible, true);
  assert.ok(night.lamps >= 0.9);
  assert.ok(night.windows >= 0.9);
});

test("rain dulls the daylight", () => {
  const dry = skyForHour(12, false);
  const wet = skyForHour(12, true);
  assert.equal(wet.rain, true);
  assert.ok(wet.sunIntensity < dry.sunIntensity * 0.5);
  assert.ok(wet.hemi < dry.hemi);
  assert.notEqual(wet.sky, dry.sky);
  assert.ok(wet.fogDensity > dry.fogDensity);
});

test("the day can advance and wrap, or stay held", () => {
  assert.ok(advanceHour(17.7, 8, true) > 17.7);
  assert.equal(advanceHour(17.7, 8, false), 17.7);
  assert.ok(advanceHour(23.5, 40, true) < 4);
  assert.equal(formatClock(0), "00:00");
});

test("sidewalk plants vary in kind and size", () => {
  const kinds = new Set();
  const scales = new Set();
  for (let i = 0; i < 18; i++) {
    const plant = plantVariant(i);
    kinds.add(plant.kind);
    scales.add(plant.scale.toFixed(2));
    assert.ok(plant.scale > 0.6 && plant.scale < 1.5);
  }
  assert.ok(kinds.has("tree") && kinds.has("shrub") && kinds.has("pot"));
  assert.ok(scales.size >= 4);
});

test("street animals wander but dogs stay near home", () => {
  const points = Array.from({ length: 12 }, (_, i) => ({ x: i * 4, z: 2 }));
  const animals = seedCritters(points);
  assert.equal(animals.length, 12);
  assert.ok(animals.some((animal) => animal.kind === "dog"));
  assert.ok(animals.some((animal) => animal.kind === "crow"));
  assert.ok(animals.some((animal) => animal.kind === "pigeon"));
  const dog = animals.find((animal) => animal.kind === "dog");
  const x0 = dog.x;
  const z0 = dog.z;
  let time = 0;
  for (let i = 0; i < 160; i++) {
    time += 0.05;
    tickCritter(dog, 0.05, time);
  }
  assert.ok(Math.hypot(dog.x - x0, dog.z - z0) > 0.2);
  assert.ok(Math.hypot(dog.x - dog.homeX, dog.z - dog.homeZ) < 8);
  const bird = animals.find((animal) => animal.kind !== "dog");
  const heights = new Set();
  time = 0;
  for (let i = 0; i < 90; i++) {
    time += 0.1;
    tickCritter(bird, 0.1, time);
    heights.add(Math.round(bird.y * 10));
  }
  assert.ok(heights.size >= 2);
});

test("two-wheelers follow a road and yield to the player", () => {
  const road = {
    a: [0, 0],
    b: [0, 100],
    length: 100,
    width: 10,
    angle: 0,
  };
  const start = vehiclePose(road, 0, 1, 0.36);
  const later = vehiclePose(road, 0.5, 1, 0.36);
  assert.ok(later.z > start.z + 40);
  const agent = { t: 0.2, speed: 10, direction: 1, road };
  const opts = {
    adjacency: new Map(),
    nodeKey: (point) => point.join(","),
    others: [],
    lane: 0.36,
    playerRadius: 7,
    gap: 4,
    pick: 0,
  };
  const held = stepRoadAgent(agent, 0.16, {
    ...opts,
    player: { x: later.x, z: 22 },
  });
  assert.equal(held.held, true);
  assert.equal(held.t, 0.2);
  const moving = stepRoadAgent(agent, 0.16, {
    ...opts,
    player: { x: 80, z: 80 },
  });
  assert.equal(moving.held, false);
  assert.ok(moving.t > 0.2);
  assert.equal(shouldYield(0, 0, { x: 3, z: 0 }, [], 7, 4), true);
  assert.equal(shouldYield(0, 0, { x: 30, z: 0 }, [{ x: 2, z: 0 }], 7, 4), true);
});

test("nearby groups talk to each other without replacing the player", () => {
  const people = Array.from({ length: 72 }, (_, i) => ({
    start: { x: (i % 8) * 3, z: Math.floor(i / 8) * 3 },
  }));
  const groups = claimGroups(people);
  assert.ok(groups.length >= 6);
  for (const group of groups) {
    assert.ok(group.members.length >= 2 && group.members.length <= 3);
    for (const member of group.members) {
      assert.ok(Math.hypot(member.start.x - group.x, member.start.z - group.z) < 1.3);
      const yaw = faceYaw(member.start.x, member.start.z, group.x, group.z);
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      const dx = group.x - member.start.x;
      const dz = group.z - member.start.z;
      const len = Math.hypot(dx, dz) || 1;
      assert.ok(forwardX * (dx / len) + forwardZ * (dz / len) > 0.9);
    }
  }
  const heard = nearbyTalk({
    groups,
    x: groups[0].x + 2,
    z: groups[0].z,
    lang: "mr-IN",
    time: 0,
    playerTalking: false,
  });
  assert.match(heard.text, /[\u0900-\u097F]/);
  const reply = nearbyTalk({
    groups,
    x: groups[0].x,
    z: groups[0].z + 1,
    lang: "hi-IN",
    time: 3.4,
    playerTalking: false,
  });
  assert.notEqual(reply.text, heard.text);
  assert.equal(
    nearbyTalk({
      groups,
      x: groups[0].x,
      z: groups[0].z,
      lang: "en-IN",
      time: 1,
      playerTalking: true,
    }),
    null,
  );
  assert.equal(
    nearbyTalk({
      groups,
      x: groups[0].x + 40,
      z: groups[0].z,
      lang: "en-IN",
      time: 1,
      playerTalking: false,
    }),
    null,
  );
  for (const lang of Object.keys(lines)) {
    const spoken = new Set(lines[lang]);
    for (const pair of streetTalk[lang]) {
      assert.equal(pair.length, 2);
      for (const line of pair) assert.equal(spoken.has(line), false);
    }
  }
});
