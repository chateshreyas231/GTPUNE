import { test } from "node:test";
import assert from "node:assert/strict";
import { fcRoadFacadeProfile } from "../src/facade-reference.js";
const b = (lat, lon) => ({
  points: [[(lon - 73.841) * 105500, -(lat - 18.5167) * 111320]],
  height: 22,
});
test("reference styles apply to the inspected corridor without changing surveyed dimensions", () => {
  const building = b(18.5231, 73.8412),
    before = JSON.stringify(building);
  assert.equal(fcRoadFacadeProfile(building).layout, "recessed-ribbon");
  assert.equal(
    fcRoadFacadeProfile(b(18.5176, 73.8412)).layout,
    "arched-lowrise",
  );
  assert.equal(fcRoadFacadeProfile(building).confidence, "corridor-style-only");
  assert.equal(JSON.stringify(building), before);
  assert.equal(fcRoadFacadeProfile(b(18.51, 73.81)), null);
  assert.equal(fcRoadFacadeProfile({ ...building, infill: true }), null);
});
