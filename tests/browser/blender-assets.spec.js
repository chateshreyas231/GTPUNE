import { test, expect } from "@playwright/test";
import { REFERENCE_CARS } from "../../src/vehicle-assets.js";

test("five Blender cars load, spawn through the cheat UI and remain driveable with animated people", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  const missing = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("pune-originals") && !r.ok()) missing.push(r.url());
  });
  await page.route("**/data/pune-osm.json", (r) =>
    r.fulfill({ status: 404, body: "fixture" }),
  );
  await page.goto("/");
  await page.waitForFunction(
    () =>
      window.__pune?.state.playerVehicle.ready &&
      window.__pune.state.detailedHumans > 0,
    { timeout: 30000 },
  );
  expect(
    (await page.evaluate(() => window.__pune.state)).playerVehicle,
  ).toMatchObject({ body: "deccan-supercar", wheels: 4 });
  await page.locator("#play").click();
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.down("w");
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__pune.state)).distanceTravelled,
      { timeout: 15000 },
    )
    .toBeGreaterThan(0.2);
  await page.keyboard.up("w");
  expect(
    (await page.evaluate(() => window.__pune.state)).distanceTravelled,
  ).toBeGreaterThan(0.2);
  await page.keyboard.down("Space");
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.__pune.state)).speed),
    )
    .toBeLessThan(1);
  await page.keyboard.up("Space");
  await page.keyboard.press("e");
  expect((await page.evaluate(() => window.__pune.state)).walking).toBe(true);
  const human = await page.evaluate(() => window.__pune.debug.body());
  expect(human.skinned).toBeGreaterThan(0);
  expect(human.paints.some((s) => s.startsWith("Iris:"))).toBe(true);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("v");
    expect(
      (await page.evaluate(() => window.__pune.debug.body())).skinned,
    ).toBeGreaterThan(0);
  }
  await page.keyboard.press("Escape");
  for (const [body, spec] of Object.entries(REFERENCE_CARS)) {
    await page.keyboard.press("Backquote");
    await page.locator("#cheat-code").fill(spec.cheat);
    await page.keyboard.press("Enter");
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.__pune.state)).spawned.find(
            (r) => r.kind === body,
          )?.asset,
        { timeout: 15000 },
      )
      .toBe(body);
  }
  // All five spawned models use the same E-entry registry as ordinary cars.
  for (const body of Object.keys(REFERENCE_CARS)) {
    const ride = (await page.evaluate(() => window.__pune.state)).spawned.find(
      (r) => r.kind === body,
    );
    await page.evaluate((r) => window.__pune.debug.stand(r.x + 1.5, r.z), ride);
    await page.keyboard.press("e");
    expect(
      (await page.evaluate(() => window.__pune.state)).playerVehicle.body,
    ).toBe(body);
    await page.keyboard.press("e");
  }
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/blender-assets-in-game.png" });
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});
