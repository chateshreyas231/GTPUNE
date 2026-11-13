import { test, expect } from "@playwright/test";

test("Pune houses, local wardrobe, Blender workers, public buses and police replace their old counterparts", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(
    () =>
      window.__pune?.state.blenderHouses.length > 0 &&
      window.__pune.state.urban.detailedWorkers > 0 &&
      window.__pune.state.transportFleet.every((v) => v.asset),
    { timeout: 60000 },
  );
  const state = await page.evaluate(() => window.__pune.state);
  expect(state.mapSource).toBe("OpenStreetMap");
  expect(state.civilianFleet.filter((v) => v.tier === "normal")).toHaveLength(
    10,
  );
  expect(state.civilianFleet.filter((v) => v.tier === "super")).toHaveLength(2);
  expect(state.civilianFleet.every((v) => v.asset === v.body)).toBe(true);
  expect(state.transportFleet.filter((v) => v.kind === "bus")).toHaveLength(3);
  expect(state.transportFleet.filter((v) => v.kind === "police")).toHaveLength(
    3,
  );
  expect(
    state.transportFleet
      .filter((v) => v.kind === "police")
      .every((v) => v.beacons === 2),
  ).toBe(true);
  for (const cast of [
    "traditional-man",
    "nauvari-woman",
    "police-officer",
    "policewoman",
  ])
    expect(state.residentCast).toContain(cast);
  await page.locator("#play").click();
  const house = await page.evaluate(() => window.__pune.debug.focusHouse());
  expect(house.renderedHeight).toBeCloseTo(house.recordedHeight, 3);
  await expect
    .poll(
      async () => (await page.evaluate(() => window.__pune.state)).cameraY,
      { timeout: 15000 },
    )
    .toBeLessThan(10);
  await page.screenshot({ path: "test-results/pune-blender-houses.png" });
  expect(errors).toEqual([]);
});

test("a Blender public bus can be spawned, entered and driven with the normal controls", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/data/pune-osm.json", (r) =>
    r.fulfill({ status: 404, body: "fixture" }),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__pune?.state.playerVehicle.ready);
  await page.locator("#play").click();
  await page.keyboard.press("Backquote");
  await page.locator("#cheat-code").fill("CITYBUS");
  await page.keyboard.press("Enter");
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__pune.state)).spawned.find(
          (v) => v.kind === "city-green-bus",
        )?.asset,
    )
    .toBe("city-green-bus");
  const ride = (await page.evaluate(() => window.__pune.state)).spawned.find(
    (v) => v.kind === "city-green-bus",
  );
  await page.evaluate((r) => window.__pune.debug.stand(r.x + 2.2, r.z), ride);
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.press("e");
  expect(
    (await page.evaluate(() => window.__pune.state)).playerVehicle.body,
  ).toBe("city-green-bus");
  const before = (await page.evaluate(() => window.__pune.state))
    .distanceTravelled;
  await page.keyboard.down("w");
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__pune.state)).distanceTravelled,
      { timeout: 15000 },
    )
    .toBeGreaterThan(before + 0.2);
  await page.keyboard.up("w");
  await page.keyboard.down("Space");
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.__pune.state)).speed),
    )
    .toBeLessThan(1);
  await page.keyboard.up("Space");
  await page.keyboard.press("e");
  expect((await page.evaluate(() => window.__pune.state)).walking).toBe(true);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/pune-city-bus.png" });
  expect(errors).toEqual([]);
});
