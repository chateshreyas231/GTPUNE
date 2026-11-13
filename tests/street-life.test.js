import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { applyImpact, crashFromImpact, deathStain } from "../src/harm.js";
import { CAR_ENTER_RANGE, nearestCar } from "../src/vehicles.js";
import { PLAYER_LOOKS, cycleLook, defaultLook } from "../src/characters.js";

test("E can enter the nearest car and ignores bikes and far cars", () => {
  const cars = [
    { id: "bike", kind: "motorcycle", x: 1, z: 0 },
    { id: "far", kind: "car", x: 12, z: 0 },
    { id: "suv", kind: "car", x: 5, z: 1 },
    { id: "edge", kind: "car", x: 0, z: CAR_ENTER_RANGE },
    { id: "close", kind: "car", x: 2, z: -1 },
  ];
  const nearest = nearestCar({ x: 0, z: 0 }, cars);
  assert.equal(nearest.id, "close");
  assert.ok(nearest.distance < 3);
  assert.equal(nearestCar({ x: 0, z: 0 }, [{ id: "far", kind: "car", x: 7.01, z: 0 }]), null);
  assert.equal(
    nearestCar({ x: 0, z: 0 }, [{ id: "edge", kind: "car", x: 7, z: 0 }]).id,
    "edge",
  );
  assert.equal(nearestCar({ x: 0, z: 0 }, [{ id: "bike", kind: "motorcycle", x: 1, z: 0 }]), null);
});

test("blood stays at the death spot when the body is shoved", () => {
  const person = { health: 3, x: 4, z: 8, down: false, dead: false };
  const bruise = applyImpact(person, crashFromImpact(4), 1, 0);
  assert.equal(deathStain(person, bruise), null);
  const killed = applyImpact(person, crashFromImpact(12), 1, 0);
  assert.equal(killed.dead, true);
  assert.notEqual(killed.x, person.x);
  assert.deepEqual(deathStain(person, killed), { x: 4, z: 8 });
  assert.equal(deathStain({ ...person, dead: true }, killed), null);
});

test("the default player is the girl, then the boy, then the man", () => {
  assert.equal(defaultLook().id, "girl");
  assert.equal(defaultLook().label, "Girl");
  assert.deepEqual(
    PLAYER_LOOKS.map((look) => look.id),
    ["girl", "boy", "man"],
  );
  assert.equal(cycleLook("girl"), "boy");
  assert.equal(cycleLook("boy"), "man");
  assert.equal(cycleLook("man"), "girl");
  assert.equal(cycleLook("missing"), "girl");
  const girl = PLAYER_LOOKS[0];
  const boy = PLAYER_LOOKS[1];
  const man = PLAYER_LOOKS[2];
  assert.ok(girl.height < man.height);
  assert.ok(boy.height < girl.height);
  assert.equal(girl.materials.Hair_Blond, 0x1a1412);
  assert.equal(girl.materials.White, 0xf4f1ea);
  assert.ok(girl.materials.Skin >= 0xc89870 && girl.materials.Skin <= 0xe8c4a2);
  for (const look of PLAYER_LOOKS) {
    assert.equal(look.license, "CC0-1.0");
    assert.match(look.source, /^assets\/blender\/pune-.*\.blend$/);
    assert.equal(existsSync(look.source), true);
    assert.equal(
      existsSync(fileURLToPath(new URL(`../public${look.file}`, import.meta.url))),
      true,
    );
  }
  const license = readFileSync("public/assets/characters/LICENSE-QUATERNIUS.txt", "utf8");
  assert.match(license, /CC0 1\.0/);
  assert.match(license, /girl\.glb/);
  assert.match(license, /boy\.glb/);
  assert.match(license, /man\.glb/);
});
