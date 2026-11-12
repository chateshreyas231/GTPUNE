import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quoteFare } from "../src/fare.js";

describe("fare", () => {
  it("charges a base fare plus a per-kilometre rate, in either direction", () => {
    assert.deepEqual(quoteFare("kothrud", "karve-nagar"), {
      kilometres: 2,
      fareInr: 50,
    });
    assert.deepEqual(quoteFare("karve-nagar", "kothrud"), {
      kilometres: 2,
      fareInr: 50,
    });
    assert.deepEqual(quoteFare("karve-nagar", "fc-road"), {
      kilometres: 5,
      fareInr: 80,
    });
    assert.deepEqual(quoteFare("kothrud", "fc-road"), {
      kilometres: 6,
      fareInr: 90,
    });
  });

  it("rejects a ride that stays in one neighbourhood", () => {
    assert.throws(
      () => quoteFare("fc-road", "fc-road"),
      /Pickup and dropoff must be different neighbourhoods/,
    );
  });

  it("rejects a neighbourhood outside Pune service area", () => {
    assert.throws(
      () => quoteFare("kothrud", "baner"),
      /Unknown neighbourhood/,
    );
  });
});
