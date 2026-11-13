import { existsSync } from "node:fs";
import { test, expect } from "@playwright/test";
test("renders and supports driving, pause, reset, walking and local dialogue", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/data/pune-osm.json", (route) =>
    route.fulfill({ status: 404, body: "No map fixture" }),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__pune);
  await expect(page.locator("#welcome")).toBeVisible();
  await page.screenshot({ path: "test-results/pune-welcome.png" });
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
  await page.keyboard.press("t");
  await expect(page.locator("#dialogue")).toBeVisible();
  await expect(page.locator("#dialogue")).toContainText(/[\u0900-\u097F]/);
  await page.locator("#language").selectOption("hi-IN");
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.press("t");
  await expect(page.locator("#dialogue")).toContainText("चाय");
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
