import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeArmoredCarrier } from "../src/vehicles.js";
import { applyImpact, applyStrike, crashFromImpact, strikeHit } from "../src/harm.js";
import {
  CHEAT_WORDS,
  emptyLoadout,
  faceYaw,
  grantWeapon,
  healthLabel,
  nearestReply,
  nextStreetWeapon,
  parkBeside,
  readCheat,
  refillHealth,
  selectSlot,
  selectedWeapon,
  weaponBySlot,
} from "../src/street-fight.js";

test("fists hit up close and a number key selects an owned street weapon", () => {
  const fists = weaponBySlot(1);
  assert.equal(fists.id, "fists");
  const punch = strikeHit({ weapon: fists, distance: 1, facingDot: 0.8 });
  assert.equal(punch.hit, true);
  assert.equal(punch.damage, 1);
  const bruised = applyStrike({ health: 3, down: false, dead: false }, punch);
  assert.equal(bruised.health, 2);
  assert.equal(bruised.dead, false);
  const miss = strikeHit({ weapon: fists, distance: 2.4, facingDot: 1 });
  assert.equal(miss.hit, false);

  let loadout = emptyLoadout();
  assert.equal(selectedWeapon(loadout).id, "fists");
  assert.equal(selectSlot(loadout, 2).ok, false);
  loadout = grantWeapon(loadout, "pipe");
  assert.equal(loadout.selected, "pipe");
  loadout = selectSlot(loadout, 1);
  assert.equal(loadout.selected, "fists");
  loadout = selectSlot(loadout, 2);
  assert.equal(loadout.ok, true);
  assert.equal(selectedWeapon(loadout).name, "Pipe");
  assert.equal(nextStreetWeapon(loadout), "stick");
});

test("cheat words give a weapon, an armored carrier, a car, or full health", () => {
  assert.deepEqual(Object.keys(CHEAT_WORDS).sort(), [
    "JEEVANBHAR",
    "KAVACHVAN",
    "LOHAKATHI",
    "NAVINMOTAR",
  ]);
  assert.equal(readCheat("lohakathi").effect, "weapon");
  assert.equal(readCheat("kavach van").effect, "armor");
  assert.equal(readCheat("NAVINMOTAR").effect, "car");
  assert.equal(readCheat("Jeevan Bhar").effect, "health");
  assert.equal(readCheat("hesoyam"), null);
  assert.equal(readCheat(""), null);

  const hurt = { health: 1, down: true, dead: false, downUntil: 9 };
  const healed = refillHealth(hurt);
  assert.equal(healed.health, 3);
  assert.equal(healed.down, false);
  assert.equal(healthLabel(healed.health), "HEALTH 3/3");
  assert.equal(healthLabel(1), "HEALTH 1/3");

  const knocked = applyImpact(
    { health: 1, down: false, dead: false },
    crashFromImpact(20),
    1,
    0,
    { survive: true },
  );
  assert.equal(knocked.dead, false);
  assert.ok(knocked.health > 0);
});

test("a reply comes from the nearest person who is still standing", () => {
  const people = [
    { name: "far", x: 30, z: 0, dead: false, down: false },
    { name: "down", x: 1, z: 0, dead: false, down: true },
    { name: "near", x: 4, z: 1, dead: false, down: false },
  ];
  const found = nearestReply(people, 0, 0);
  assert.equal(found.person.name, "near");
  assert.ok(found.distance < 22);
  assert.equal(nearestReply([{ name: "gone", x: 2, z: 0, dead: true }], 0, 0), null);
  const yaw = faceYaw(0, 0, 0, -4);
  assert.ok(Math.abs(yaw) < 0.01);
});

test("a spawned ride parks beside the player and the carrier is an original hull", () => {
  const spot = parkBeside(10, 20, 0, { distance: 5.5, side: 1 });
  assert.ok(Math.abs(spot.x - 15.5) < 0.001);
  assert.ok(Math.abs(spot.z - 20) < 0.001);
  assert.ok(Math.hypot(spot.x - 10, spot.z - 20) < 8);

  const mesh = makeArmoredCarrier();
  assert.equal(mesh.userData.kind, "armor");
  assert.equal(mesh.userData.label, "Kavach Carrier");
  assert.equal(mesh.userData.body, "kavach");
  assert.ok(mesh.getObjectByName("turret"));
  assert.ok(mesh.getObjectByName("barrel"));
  const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
  assert.ok(size.x > 1.6 && size.x < 3.4);
  assert.ok(size.y > 0.8 && size.y < 2.6);
  assert.ok(size.z > 3 && size.z < 5.5);
  assert.equal(mesh.userData.wheels.length, 10);
});
