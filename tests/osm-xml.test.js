import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeOSMExports } from "../scripts/osm-xml.mjs";
test("joins and deduplicates ways across exports, excluding contributor metadata", () => {
  const xml =
    '<osm><node id="1" lat="18.5" lon="73.8" user="alice"/><node id="2" lat="18.6" lon="73.9"/><way id="7"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/></way></osm>';
  const data = mergeOSMExports([xml, xml]);
  assert.equal(data.elements.length, 1);
  assert.deepEqual(data.elements[0].geometry, [
    { lat: 18.5, lon: 73.8 },
    { lat: 18.6, lon: 73.9 },
  ]);
  assert.ok(!JSON.stringify(data).includes("alice"));
});
test("rejects bad exports and incomplete geometry", () => {
  assert.throws(() => mergeOSMExports(["<error>failed</error>"]));
  assert.throws(() =>
    mergeOSMExports([
      '<osm><way id="1"><nd ref="missing"/><tag k="highway" v="primary"/></way></osm>',
    ]),
  );
});
