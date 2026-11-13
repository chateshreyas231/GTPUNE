import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createApp } from "../src/server.js";

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

after(() => server.close());

describe("GTPUNE server", () => {
  it("names GTPUNE and the three Pune neighbourhoods", async () => {
    const response = await fetch(`${base}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    const html = await response.text();
    assert.match(html, /GTPUNE/);
    assert.match(html, /Pune/);
    assert.match(html, /Kothrud/);
    assert.match(html, /Karve Nagar/);
    assert.match(html, /FC Road/);
  });

  it("returns the service area as JSON", async () => {
    const response = await fetch(`${base}/areas`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.product, "GTPUNE");
    assert.equal(body.city, "Pune");
    assert.deepEqual(
      body.neighbourhoods.map((neighbourhood) => neighbourhood.name),
      ["Kothrud", "Karve Nagar", "FC Road"],
    );
  });

  it("does not serve other paths", async () => {
    const response = await fetch(`${base}/rides`);
    assert.equal(response.status, 404);
  });

  it("accepts only GET", async () => {
    const response = await fetch(`${base}/`, { method: "POST" });
    assert.equal(response.status, 405);
  });

  it("lets the page pick a pickup and a dropoff", async () => {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /id="pickup"/);
    assert.match(html, /id="dropoff"/);
    assert.match(html, /id="request"/);
    assert.match(html, /Finding/);
    assert.match(html, /Arriving/);
    assert.match(html, /On trip/);
    assert.match(html, /Done/);
  });

  it("requests a ride and moves it through the trip", async () => {
    const created = await fetch(`${base}/rides`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pickupId: "kothrud", dropoffId: "fc-road" }),
    });
    assert.equal(created.status, 201);
    const ride = await created.json();
    assert.equal(ride.status, "finding");
    assert.equal(ride.fareInr, 90);
    assert.equal(ride.driver.name, "Asha Kulkarni");
    assert.equal(ride.pickup.name, "Kothrud");
    assert.equal(ride.dropoff.name, "FC Road");

    for (const status of ["arriving", "on trip", "done"]) {
      const response = await fetch(`${base}/rides/${ride.id}/advance`, {
        method: "POST",
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.status, status);
      assert.equal(body.fareInr, 90);
    }
  });

  it("rejects a route that is not two of the three neighbourhoods", async () => {
    const response = await fetch(`${base}/rides`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pickupId: "kothrud", dropoffId: "kothrud" }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /different neighbourhoods/);
  });
});
