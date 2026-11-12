import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serviceArea } from "../src/areas.js";

describe("service area", () => {
  it("is City Rider in Pune, limited to three neighbourhoods", () => {
    assert.equal(serviceArea.product, "City Rider");
    assert.equal(serviceArea.city, "Pune");
    assert.deepEqual(
      serviceArea.neighbourhoods.map((neighbourhood) => neighbourhood.name),
      ["Kothrud", "Karve Nagar", "FC Road"],
    );
    assert.deepEqual(
      serviceArea.neighbourhoods.map((neighbourhood) => neighbourhood.id),
      ["kothrud", "karve-nagar", "fc-road"],
    );
  });
});
