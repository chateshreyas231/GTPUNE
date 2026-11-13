import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { REFERENCE_CARS } from "../src/vehicle-assets.js";

const manifest = JSON.parse(
  readFileSync("public/assets/pune-originals/manifest.json"),
);
const digest = (b) => createHash("sha256").update(b).digest("hex");
function glb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
}

test("Blender assets have closed source/export hashes, local buffers and bounded geometry", () => {
  assert.equal(manifest.license, "CC0-1.0");
  assert.equal(manifest.assets.length, 8);
  for (const asset of manifest.assets) {
    const bytes = readFileSync(`public${asset.file}`);
    assert.equal(digest(bytes), asset.sha256, asset.id);
    assert.equal(
      digest(readFileSync(asset.source)),
      asset.sourceSha256,
      asset.id,
    );
    assert.equal(bytes.length, asset.bytes);
    const json = glb(bytes);
    assert.ok(json.buffers.every((buffer) => !buffer.uri));
    let triangles = 0;
    for (const mesh of json.meshes) {
      for (const primitive of mesh.primitives) {
        assert.ok(primitive.indices != null);
        assert.equal(primitive.mode ?? 4, 4);
        triangles += json.accessors[primitive.indices].count / 3;
        const positions = json.accessors[primitive.attributes.POSITION];
        assert.ok([...positions.min, ...positions.max].every(Number.isFinite));
      }
    }
    assert.equal(triangles, asset.triangles, asset.id);
    assert.ok(triangles < (asset.kind === "vehicle" ? 30000 : 22000));
    assert.ok(bytes.length < 1_100_000);
    assert.ok(json.materials.length <= 12);
    if (asset.kind === "vehicle") {
      assert.ok(REFERENCE_CARS[asset.id]);
      assert.equal(
        json.nodes.filter((n) => n.name?.startsWith("wheel_")).length,
        4,
      );
      assert.ok(
        asset.dimensionsMeters[2] > 4 && asset.dimensionsMeters[2] < 5.5,
      );
    } else {
      assert.ok(json.skins.length > 0);
      assert.deepEqual(
        json.animations.map((a) => a.name).sort(),
        [...asset.animations].sort(),
      );
      assert.ok(
        json.meshes.every((m) =>
          m.primitives.every(
            (p) =>
              p.attributes.JOINTS_0 != null && p.attributes.WEIGHTS_0 != null,
          ),
        ),
      );
      assert.ok(
        asset.dimensionsMeters[1] > 1.65 && asset.dimensionsMeters[1] < 1.8,
      );
    }
  }
});
