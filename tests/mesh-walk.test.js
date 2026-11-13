import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { person } from "../src/city.js";
import {
  CHARACTER_CAST,
  characterFor,
  mountCharacter,
} from "../src/visual-assets.js";

function loadGltf(file) {
  const buf = readFileSync(
    new URL(`../public/assets/characters/${file}`, import.meta.url),
  );
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      "",
      resolve,
      reject,
    );
  });
}

function locals(root) {
  root.updateMatrixWorld(true);
  const read = (name) => {
    const point = new THREE.Vector3();
    root.getObjectByName(name).getWorldPosition(point);
    root.worldToLocal(point);
    return point;
  };
  return {
    footL: read("FootL"),
    footR: read("FootR"),
    fistL: read("FistL"),
    fistR: read("FistR"),
    head: read("Head"),
  };
}

function poseClip(body, mode, time) {
  for (const [name, action] of Object.entries(body.userData.actions)) {
    action.reset().play();
    action.setEffectiveWeight(name === mode ? 1 : 0);
    action.setEffectiveTimeScale(1);
  }
  body.userData.mixer.setTime(time);
  return locals(body);
}

test("residents pick a matching CC0 body and the player uses the casual man", () => {
  assert.equal(characterFor(person(0)).file, "casual-female.glb");
  assert.equal(characterFor(person(1)).file, "casual-male.glb");
  assert.equal(characterFor(person(3)).file, "worker-male.glb");
  assert.equal(characterFor(person(4)).file, "worker-female.glb");
  assert.equal(characterFor(person(6)).file, "older-female.glb");
  assert.equal(characterFor(person(7)).file, "older-male.glb");
  assert.equal(characterFor(person(0, { player: true })).id, "casual-male");
});

test("each shipped mesh walks opposite limbs and shifts its weight", async () => {
  for (const cast of CHARACTER_CAST) {
    const gltf = await loadGltf(cast.file);
    const body = mountCharacter(person(0, { player: true }), gltf);
    body.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
    assert.ok(size.y > 1.4 && size.y < 2.1, `${cast.id} height ${size.y}`);
    assert.equal(body.userData.gaitMode, "idle");
    body.userData.walk(0.25, 1.6);
    assert.equal(body.userData.gaitMode, "walk");
    body.userData.walk(0.25, 6.8);
    assert.equal(body.userData.gaitMode, "run");
    assert.ok(
      body.userData.authored.walk > 0.4 && body.userData.authored.walk < 2.8,
      `${cast.id} walk pace ${body.userData.authored.walk}`,
    );
    assert.ok(
      body.userData.authored.run > body.userData.authored.walk,
      `${cast.id} run pace ${body.userData.authored.run}`,
    );

    const walk = gltf.animations.find((clip) => clip.name === "Walk");
    const planted = poseClip(body, "walk", walk.duration * 0.02);
    const shifted = poseClip(body, "walk", walk.duration * 0.52);
    const feet = planted.footL.z - planted.footR.z;
    const hands = planted.fistL.z - planted.fistR.z;
    assert.ok(Math.abs(feet) > 0.15, `${cast.id} feet barely step`);
    assert.ok(feet * hands < 0, `${cast.id} arms follow the same leg`);
    assert.ok(
      (planted.footL.z - planted.footR.z) * (shifted.footL.z - shifted.footR.z) < 0,
      `${cast.id} feet do not swap`,
    );
    assert.ok(
      Math.abs(planted.head.x - shifted.head.x) > 0.03,
      `${cast.id} head shift ${Math.abs(planted.head.x - shifted.head.x)}`,
    );

    const run = gltf.animations.find((clip) => clip.name === "Run");
    const running = poseClip(body, "run", run.duration * 0.02);
    assert.ok(
      (running.footL.z - running.footR.z) * (running.fistL.z - running.fistR.z) < 0,
      `${cast.id} run arms match the legs`,
    );

    let skin = null;
    body.traverse((object) => {
      if (object.isMesh && object.material?.name === "Skin") skin = object.material;
    });
    assert.equal(skin.color.getHex(), 0xd6b08a);
  }
});
