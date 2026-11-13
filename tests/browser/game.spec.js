import { existsSync } from "node:fs";
import { test, expect } from "@playwright/test";
test("renders and supports driving, pause, reset, walking and local dialogue", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/data/pune-osm.json", (route) =>
    route.fulfill({ status: 404, body: "No map fixture" }),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__pune);
  await expect(page.locator("#welcome")).toBeVisible();
  await page.screenshot({ path: "test-results/pune-welcome.png" });
  await expect
    .poll(() => page.evaluate(() => window.__pune.state.detailedHumans), {
      timeout: 20000,
    })
    .toBeGreaterThan(0);
  expect(
    (await page.evaluate(() => window.__pune.state)).humanHeight,
  ).toBeLessThan(2.1);
  await page.locator("#play").click();
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.down("w");
  await expect
    .poll(
      async () => page.evaluate(() => window.__pune.state.distanceTravelled),
      { timeout: 15000 },
    )
    .toBeGreaterThan(2);
  await page.keyboard.up("w");
  const moving = await page.evaluate(() => window.__pune.state);
  expect(moving.distanceTravelled).toBeGreaterThan(1);
  await page.keyboard.press("p");
  const stopped = await page.evaluate(() => window.__pune.state);
  await page.waitForTimeout(300);
  expect((await page.evaluate(() => window.__pune.state)).z).toBe(stopped.z);
  await page.keyboard.press("p");
  await page.locator("#reset").click();
  await page.keyboard.press("e");
  expect((await page.evaluate(() => window.__pune.state)).walking).toBe(true);
  await page.keyboard.press("Escape");
  await page.locator("#audio").click();
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.press("t");
  await expect
    .poll(() => page.evaluate(() => window.__pune.state.voiceTime), {
      timeout: 10000,
    })
    .toBeGreaterThan(0);
  await expect(page.locator("#dialogue")).toBeVisible();
  await expect(page.locator("#dialogue")).toContainText(/[\u0900-\u097F]/);
  await page.keyboard.press("Escape");
  await page.locator("#language").selectOption("hi-IN");
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.press("t");
  await expect(page.locator("#dialogue")).toContainText("चाय");
  await page.keyboard.press("Escape");
  await page.locator("#job").click();
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.press("f");
  expect((await page.evaluate(() => window.__pune.state)).job).toBe("delivery");
  await page.keyboard.press("Escape");
  await page.locator("#lighting").click();
  await expect(page.locator("#lighting")).toHaveText("BLUE HOUR");
  await page.screenshot({ path: "test-results/pune-game.png" });
  expect(errors).toEqual([]);
});
test("help and mobile layout remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/data/pune-osm.json", (route) =>
    route.fulfill({ status: 404, body: "No map fixture" }),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__pune);
  await page.locator("#help").click();
  await expect(page.locator("#instructions")).toBeVisible();
  await page.locator("#resume").click();
  await page.locator("#play").click();
  await expect(page.locator("#mobile")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("imported Pune map renders real footprints and allows driving", async ({
  page,
}) => {
  test.skip(
    !existsSync("public/data/pune-osm.json"),
    "Run npm run map:fetch to enable real-map validation",
  );
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__pune, { timeout: 90000 });
  const initial = await page.evaluate(() => window.__pune.state);
  expect(initial.mapSource).toBe("OpenStreetMap");
  expect(initial.roads).toBeGreaterThan(1000);
  expect(initial.buildings).toBeGreaterThan(1000);
  expect(initial.nearbyBuildingBatches).toBeGreaterThan(0);
  await expect(page.locator("#map-source")).toContainText("OPENSTREETMAP");
  await page.locator("#play").click();
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.down("w");
  await expect
    .poll(() => page.evaluate(() => window.__pune.state.distanceTravelled), {
      timeout: 20000,
    })
    .toBeGreaterThan(2);
  await page.keyboard.up("w");
  await page.screenshot({ path: "test-results/pune-real-map.png" });
  expect(errors).toEqual([]);
});

test("health, replies, fists, weapons and the cheat box", async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/data/pune-osm.json", (route) =>
    route.fulfill({ status: 404, body: "No map fixture" }),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__pune);
  await expect(page.locator("#health")).toContainText("HEALTH 3/3");
  await expect(page.locator("#weapon")).toHaveText("FISTS");
  await page.locator("#play").click();
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.press("e");
  await page.keyboard.press("t");
  await expect(page.locator("#dialogue")).toContainText("REPLIES");
  await expect(page.locator("#dialogue")).toContainText(/[\u0900-\u097F]/);
  const before = await page.evaluate(() => window.__pune.state);
  await page.keyboard.press("Backquote");
  await expect(page.locator("#cheat-box")).toBeVisible();
  await page.locator("#cheat-code").fill("LOHAKATHI");
  await page.locator("#cheat-code").press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__pune.state.held))
    .toBe("pipe");
  await page.keyboard.press("1");
  await expect
    .poll(() => page.evaluate(() => window.__pune.state.held))
    .toBe("fists");
  await page.keyboard.press("2");
  await expect
    .poll(() => page.evaluate(() => window.__pune.state.held))
    .toBe("pipe");
  await page.keyboard.press("1");
  const punch = await page.evaluate(() => window.__pune.debug.swingFront());
  expect(punch.hit).toBe(true);
  expect(punch.dead).toBe(false);
  expect(punch.health).toBe(2);
  expect(
    (await page.evaluate(() => window.__pune.state)).wanted,
  ).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.__pune.debug.cheat("not-a-code");
  });
  await page.keyboard.press("Backquote");
  await page.locator("#cheat-code").fill("KAVACHVAN");
  await page.locator("#cheat-code").press("Enter");
  await page.keyboard.press("Backquote");
  await page.locator("#cheat-code").fill("NAVINMOTAR");
  await page.locator("#cheat-code").press("Enter");
  await page.keyboard.press("Backquote");
  await page.locator("#cheat-code").fill("JEEVANBHAR");
  await page.locator("#cheat-code").press("Enter");
  const after = await page.evaluate(() => window.__pune.state);
  expect(after.playerDead).toBe(false);
  expect(after.playerHealth).toBe(3);
  await expect(page.locator("#health")).toContainText("HEALTH 3/3");
  const kinds = after.spawned.map((ride) => ride.kind).sort();
  expect(kinds).toEqual(["armor", "car"]);
  for (const ride of after.spawned) {
    const distance = Math.hypot(ride.x - before.x, ride.z - before.z);
    expect(distance).toBeGreaterThan(3);
    expect(distance).toBeLessThan(14);
  }
  await page.evaluate(() => window.__pune.debug.armPlayer());
  await expect
    .poll(() => page.evaluate(() => window.__pune.state.playerDown), {
      timeout: 4000,
    })
    .toBe(true);
  const survived = await page.evaluate(() => window.__pune.state);
  expect(survived.playerDead).toBe(false);
  expect(survived.playerHealth).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("4K photo exports a 3840 by 2160 PNG", async ({ page }) => {
  test.setTimeout(90000);
  await page.route("**/data/pune-osm.json", (r) =>
    r.fulfill({ status: 404, body: "fixture" }),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__pune);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#photo").click();
  const download = await downloadPromise;
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(await download.path());
  expect(bytes.readUInt32BE(16)).toBe(3840);
  expect(bytes.readUInt32BE(20)).toBe(2160);
});
