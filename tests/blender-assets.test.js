import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BLENDER_VEHICLES, REFERENCE_CARS } from "../src/vehicle-assets.js";

const manifests = [
  "manifest.json",
  "houses-manifest.json",
  "transport-manifest.json",
  "wardrobe-manifest.json",
].map((file) =>
  JSON.parse(readFileSync(`public/assets/pune-originals/${file}`)),
);
const digest = (b) => createHash("sha256").update(b).digest("hex");
function glb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
}

test("Blender assets have closed source/export hashes, local buffers and bounded geometry", () => {
  assert.ok(manifests.every((m) => m.license === "CC0-1.0"));
  const assets = manifests.flatMap((m) => m.assets);
  assert.equal(assets.length, 37);
  assert.equal(new Set(assets.map((a) => a.id)).size, assets.length);
  for (const asset of assets) {
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
    const building = asset.kind === "building",
      transport = asset.kind === "vehicle" && !REFERENCE_CARS[asset.id];
    assert.ok(
      triangles <
        (building
          ? 60000
          : transport
            ? 36000
            : asset.kind === "vehicle"
              ? 30000
              : 22000),
      asset.id,
    );
    assert.ok(
      bytes.length < (building ? 3_500_000 : transport ? 1_900_000 : 1_100_000),
      asset.id,
    );
    assert.ok(json.materials.length <= (building ? 12 : 18), asset.id);
    if (asset.kind === "vehicle") {
      assert.ok(BLENDER_VEHICLES[asset.id]);
      assert.equal(
        json.nodes.filter((n) => n.name?.startsWith("wheel_")).length,
        4,
      );
      assert.ok(
        asset.dimensionsMeters[2] > 3.4 && asset.dimensionsMeters[2] < 12,
      );
      if (BLENDER_VEHICLES[asset.id].kind === "police")
        assert.equal(
          json.nodes.filter((n) => n.name?.startsWith("beacon_")).length,
          2,
        );
    } else if (asset.kind === "animated-human") {
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
        asset.dimensionsMeters[1] > 1.65 && asset.dimensionsMeters[1] < 1.9,
      );
    } else {
      assert.ok(
        asset.dimensionsMeters[1] > 6 && asset.dimensionsMeters[1] < 14,
      );
    }
  }
});
