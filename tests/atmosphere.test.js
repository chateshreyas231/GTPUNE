import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  CameraZoomController,
  createAtmosphere,
  applyOutfit,
} from "../src/atmosphere.js";

test("scene camera zoom clamps and movement restores player follow distance", () => {
  const zoom = new CameraZoomController({ distance: 13, min: 3, max: 30 });
  assert.equal(zoom.wheel(-100000), 3);
  assert.equal(zoom.follow(false), 3);
  assert.equal(zoom.follow(true), 13);
  assert.equal(zoom.wheel(100000), 30);
  assert.equal(zoom.wheel(NaN), 30);
});

test("weather and festivals change visible scene effects and restore atmosphere on disposal", () => {
  const scene = new THREE.Scene();
  const oldBackground = new THREE.Color(0xff00ff);
  scene.background = oldBackground;
  const atmosphere = createAtmosphere(scene, {
    rainCount: 100.5,
    birdCount: 4.4,
  });
  assert.equal(atmosphere.state.weather, "clear");
  assert.equal(scene.background.getHex(), 0x8bbce0);
  assert.equal(atmosphere.root.getObjectByName("Local rain").visible, false);
  assert.equal(atmosphere.setWeather("storm"), true);
  assert.equal(atmosphere.root.getObjectByName("Local rain").visible, true);
  assert.equal(atmosphere.root.getObjectByName("Flying birds").visible, false);
  assert.equal(atmosphere.setWeather("unknown"), false);
  atmosphere.setFestival("ganpati", new THREE.Vector3(20, 0, 40));
  assert.equal(
    atmosphere.root.getObjectByName("Stylized Ganpati festival mandap").visible,
    true,
  );
  atmosphere.setFestival("diwali");
  assert.equal(
    atmosphere.root.getObjectByName("Stylized Diwali fireworks").visible,
    true,
  );
  atmosphere.setFestival("kites");
  assert.equal(atmosphere.root.getObjectByName("Festival kites").visible, true);
  atmosphere.setWind(200);
  assert.equal(atmosphere.state.wind, 3);
  atmosphere.update(0.05, 999, new THREE.Vector3(1200, 0, -500));
  atmosphere.root.traverse((object) => {
    if (object.isInstancedMesh)
      assert.ok(object.instanceMatrix.array.every(Number.isFinite));
    if (object.geometry?.attributes.position)
      assert.ok(
        object.geometry.attributes.position.array.every(Number.isFinite),
      );
  });
  atmosphere.dispose();
  atmosphere.dispose();
  assert.equal(scene.background, oldBackground);
  assert.equal(scene.children.length, 0);
});

test("clothes recoloring preserves skin and other residents sharing the original material", () => {
  const root = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: 0x123456 });
  shirt.name = "Shirt";
  const skin = new THREE.MeshStandardMaterial({ color: 0xc59b75 });
  skin.name = "Skin";
  const shirtMesh = new THREE.Mesh(new THREE.BoxGeometry(), shirt);
  const skinMesh = new THREE.Mesh(new THREE.BoxGeometry(), skin);
  root.add(shirtMesh, skinMesh);
  assert.equal(applyOutfit(root, 0xff7700), 1);
  assert.equal(shirt.color.getHex(), 0x123456);
  assert.equal(shirtMesh.material.color.getHex(), 0xff7700);
  assert.equal(skinMesh.material, skin);
  assert.equal(skin.color.getHex(), 0xc59b75);
});
