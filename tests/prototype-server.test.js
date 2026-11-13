import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.js";
const server = createApp({ prototype: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());
test("serves the built prototype with its JavaScript and CSS", async () => {
  const r = await fetch(base);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /Your city/);
  for (const path of [
    ...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g),
  ].map((m) => m[1])) {
    const asset = await fetch(base + path);
    assert.equal(asset.status, 200);
    assert.match(
      asset.headers.get("content-type"),
      path.endsWith(".css") ? /text\/css/ : /javascript/,
    );
  }
  assert.match(html, /\/assets\/.*\.js/);
});
test("preserves the original chapter and its routes", async () => {
  const classic = await fetch(base + "/classic/");
  assert.equal(classic.status, 200);
  assert.match(await classic.text(), /Chapter 1 is FC Road/);
  assert.equal((await fetch(base + "/game.js")).status, 200);
  assert.equal((await fetch(base + "/areas")).status, 200);
});
test("does not expose repository files or accept writes", async () => {
  assert.equal((await fetch(base + "/package.json")).status, 404);
  assert.equal((await fetch(base + "/assets/../../package.json")).status, 404);
  assert.equal((await fetch(base, { method: "POST" })).status, 405);
});
