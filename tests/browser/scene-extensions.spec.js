import { test, expect } from "@playwright/test";
test("merged sky, festivals, outfit, smoking, zoom and Panzer controls work together", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/data/pune-osm.json", (r) =>
    r.fulfill({ status: 404, body: "fallback" }),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__pune);
  await page.locator("#play").click();
  await expect
    .poll(() => page.evaluate(() => window.__pune.state.detailedHumans), {
      timeout: 30000,
    })
    .toBeGreaterThan(0);
  const state = await page.evaluate(() => window.__pune.state);
  expect(state.policeCars).toBe(3);
  expect(state.ambulances).toBe(2);
  expect(state.fireEngines).toBe(2);
  expect(state.urban.workers).toBeGreaterThan(0);
  await page.locator("#festival").selectOption("diwali");
  expect(
    (await page.evaluate(() => window.__pune.state)).atmosphere.festival,
  ).toBe("diwali");
  for (const code of [
    "GANPATI",
    "KITES",
    "FESTIVALOFF",
    "WIND",
    "FOG",
    "BLUESKY",
  ]) {
    expect(
      await page.evaluate((c) => window.__pune.debug.cheat(c), code),
    ).toBeTruthy();
  }
  expect(
    (await page.evaluate(() => window.__pune.state)).atmosphere.weather,
  ).toBe("clear");
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.press("e");
  await page.keyboard.press("v");
  await page.keyboard.press("v");
  expect((await page.evaluate(() => window.__pune.state)).look).toBe("man");
  const before = await page.evaluate(() => window.__pune.debug.body().paints);
  await page.evaluate(() => window.__pune.debug.cheat("CLOTHES"));
  expect(
    await page.evaluate(() => window.__pune.debug.body().paints),
  ).not.toEqual(before);
  await page.evaluate(() => window.__pune.debug.cheat("SMOKE"));
  expect((await page.evaluate(() => window.__pune.state)).urban.smoking).toBe(
    true,
  );
  await page.evaluate(() => window.__pune.debug.cheat("SMOKE"));
  await page.keyboard.press("Escape");
  const oldZoom = (await page.evaluate(() => window.__pune.state))
    .cameraDistance;
  await page.locator("#world").hover({ position: { x: 700, y: 450 } });
  await page.mouse.wheel(0, -200);
  await expect
    .poll(() => page.evaluate(() => window.__pune.state.cameraDistance))
    .toBeLessThan(oldZoom);
  await page.evaluate(() => window.__pune.debug.cheat("PANZER"));
  const ride = (await page.evaluate(() => window.__pune.state)).spawned.find(
    (r) => r.kind === "panzer",
  );
  expect(ride).toBeTruthy();
  await page.evaluate((r) => window.__pune.debug.stand(r.x + 1.5, r.z), ride);
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.press("e");
  expect((await page.evaluate(() => window.__pune.state)).walking).toBe(false);
  await expect(page.locator("#mode")).toContainText(/Panzer/i);
  await page.keyboard.press("g");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/pune-combined-scene.png" });
});
