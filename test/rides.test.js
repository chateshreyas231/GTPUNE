import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRideBook } from "../src/rides.js";

describe("ride states", () => {
  it("starts at finding and moves through arriving, on trip, and done", () => {
    const book = createRideBook();
    const ride = book.request({ pickupId: "kothrud", dropoffId: "fc-road" });

    assert.equal(ride.status, "finding");
    assert.equal(ride.fareInr, 90);
    assert.equal(ride.pickup.name, "Kothrud");
    assert.equal(ride.dropoff.name, "FC Road");
    assert.equal(ride.driver.name, "Asha Kulkarni");
    assert.equal(ride.driver.vehicle, "White Swift");

    assert.equal(book.advance(ride.id).status, "arriving");
    assert.equal(book.advance(ride.id).status, "on trip");
    assert.equal(book.advance(ride.id).status, "done");
    assert.equal(book.advance(ride.id).status, "done");
  });

  it("assigns the next driver to the next ride", () => {
    const book = createRideBook();
    book.request({ pickupId: "kothrud", dropoffId: "karve-nagar" });
    const second = book.request({ pickupId: "karve-nagar", dropoffId: "fc-road" });
    assert.equal(second.driver.name, "Rohan Patil");
    assert.equal(second.fareInr, 80);
  });
});

describe("ride routes", () => {
  it("accepts each pair of the three neighbourhoods", () => {
    const book = createRideBook();
    const pairs = [
      ["kothrud", "karve-nagar", 50],
      ["karve-nagar", "fc-road", 80],
      ["fc-road", "kothrud", 90],
    ];

    for (const [pickupId, dropoffId, fareInr] of pairs) {
      const ride = book.request({ pickupId, dropoffId });
      assert.equal(ride.pickup.id, pickupId);
      assert.equal(ride.dropoff.id, dropoffId);
      assert.equal(ride.fareInr, fareInr);
    }
  });

  it("rejects a route outside the three neighbourhoods", () => {
    const book = createRideBook();
    assert.throws(
      () => book.request({ pickupId: "kothrud", dropoffId: "kothrud" }),
      /different neighbourhoods/,
    );
    assert.throws(
      () => book.request({ pickupId: "kothrud", dropoffId: "baner" }),
      /Unknown neighbourhood/,
    );
    assert.throws(() => book.advance("missing"), /Unknown ride/);
  });
});
