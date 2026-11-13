import test from "node:test";
import assert from "node:assert/strict";
import {
  streetDetails,
  swayCanopies,
  LEAF_CLUMPS,
  AWNING_DEPTH_M,
  SHOP_BAY_M,
} from "../src/street-details.js";

test("trees are leaf clumps that sway, and shop bays follow the frontage", () => {
  const roads = [
    {
      a: [0, 0],
      b: [0, 90],
      width: 7,
      length: 90,
      sidewalk: 1.6,
      angle: 0,
    },
  ];
  const buildings = [
    {
      points: [
        [6, 20],
        [18, 20],
        [18, 38],
        [6, 38],
      ],
      minX: 6,
      maxX: 18,
      minZ: 20,
      maxZ: 38,
      height: 12,
    },
  ];
  const root = streetDetails(8, 30, roads, () => false, buildings);
  assert.ok(root.userData.trees.length > 0);
  const clumps = root.userData.trees[0].userData.clumps;
  assert.equal(clumps.length, LEAF_CLUMPS);
  const before = clumps[0].position.y;
  swayCanopies(root, 1.3);
  assert.notEqual(clumps[0].position.y, before);
  assert.notEqual(clumps[0].rotation.z, 0);
  let awnings = 0;
  root.traverse((object) => {
    if (object.isMesh && object.geometry.parameters?.width === AWNING_DEPTH_M)
      awnings++;
  });
  const frontage = 18;
  const bays = Math.max(1, Math.round(frontage / SHOP_BAY_M));
  assert.equal(awnings, bays);
});
