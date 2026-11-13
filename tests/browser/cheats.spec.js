import { test, expect } from "@playwright/test";

test("tilde cheats change population, traffic, and weather", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/data/pune-osm.json", (route) =>
    route.fulfill({ status: 404, body: "No map fixture" }),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__pune);
  await page.locator("#play").click();
  const before = await page.evaluate(() => window.__pune.state);
  await page.keyboard.press("Backquote");
  await expect(page.locator("#cheat-bar")).toBeVisible();
  await page.screenshot({ path: "test-results/cheat-bar.png" });
  await page.keyboard.type("bazaar");
  await page.keyboard.press("Enter");
  await expect(page.locator("#cheat-bar")).toBeHidden();
  await expect(page.locator("#toast")).toContainText(/footpath/i);
  const busier = await page.evaluate(() => window.__pune.state);
  expect(busier.pedestrians).toBe(before.pedestrians + 18);
  await page.keyboard.press("Backquote");
  await page.keyboard.type("rushhour");
  await page.keyboard.press("Enter");
  const jammed = await page.evaluate(() => window.__pune.state);
  expect(jammed.cars).toBe(before.cars + 6);
  expect(jammed.motorcycles).toBe(before.motorcycles + 12);
  await page.keyboard.press("Backquote");
  await page.keyboard.type("nope");
  await page.keyboard.press("Enter");
  await expect(page.locator("#cheat-bar")).toBeVisible();
  await expect(page.locator("#toast")).toContainText(/nothing/i);
  await page.locator("#cheat-line").fill("monsoon");
  await page.keyboard.press("Enter");
  await expect(page.locator("#lighting")).toHaveText("DRIZZLE");
  await page.keyboard.press("Backquote");
  await page.keyboard.type("monsoon");
  await page.keyboard.press("Enter");
  await expect(page.locator("#lighting")).toHaveText("MONSOON");
  expect((await page.evaluate(() => window.__pune.state)).weather).toBe("monsoon");
  const stalled = await page.evaluate(() => window.__pune.debug.incident("stalled-vehicle"));
  const crowd = await page.evaluate(() => window.__pune.debug.incident("stall-crowd"));
  const breakdown = await page.evaluate(() => window.__pune.debug.incident("roadside-breakdown"));
  expect([stalled, crowd, breakdown]).toEqual([
    "stalled-vehicle",
    "stall-crowd",
    "roadside-breakdown",
  ]);
  const life = await page.evaluate(() => window.__pune.state.incidents);
  expect(life.find((item) => item.id === "stalled-vehicle").vehicles).toEqual(["car"]);
  expect(life.find((item) => item.id === "stall-crowd").people).toBe(6);
  expect(life.find((item) => item.id === "roadside-breakdown").vehicles).toEqual([
    "motorcycle",
  ]);
  await page.evaluate(() => window.__pune.debug.focusIncident("stalled-vehicle"));
  await page.waitForTimeout(900);
  await page.screenshot({ path: "test-results/cheat-stalled.png" });
  await page.evaluate(() => window.__pune.debug.focusIncident("stall-crowd"));
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/cheat-crowd.png" });
  await page.evaluate(() => window.__pune.debug.focusIncident("roadside-breakdown"));
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/cheat-breakdown.png" });
  expect(errors).toEqual([]);
});
