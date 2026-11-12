import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createApp } from "../src/server.js";

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

after(() => server.close());

describe("City Rider server", () => {
  it("names City Rider and the three Pune neighbourhoods", async () => {
    const response = await fetch(`${base}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    const html = await response.text();
    assert.match(html, /City Rider/);
    assert.match(html, /Pune/);
    assert.match(html, /Kothrud/);
    assert.match(html, /Karve Nagar/);
    assert.match(html, /FC Road/);
  });

  it("returns the service area as JSON", async () => {
    const response = await fetch(`${base}/areas`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.product, "City Rider");
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
});
