import { test, expect } from "@playwright/test";
test("F punches in camera direction during deliveries and G remains the interaction key", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/data/pune-osm.json", (r) =>
    r.fulfill({ status: 404, body: "fixture" }),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__pune);
  await expect
    .poll(() => page.evaluate(() => window.__pune.state.detailedHumans), {
      timeout: 30000,
    })
    .toBeGreaterThan(0);
  await page.locator("#play").click();
  // Start a job: it must not consume the attack key anywhere in the world.
  await page.locator("#job").click();
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.press("e");
  // Set up geometry only. This deliberately does not call the direct-damage debug helper.
  await page.evaluate(() => {
    const p = window.__pune.debug.person("Asha");
    window.__pune.debug.stand(p.x - 0.95, p.z);
    window.__pune.debug.aim(-Math.PI / 2, 0.28);
  });
  await page.keyboard.press("t");
  await expect(page.locator("#dialogue")).toBeVisible();
  const before = await page.evaluate(
    () => window.__pune.debug.person("Asha").health ?? 3,
  );
  await page.keyboard.press("1");
  await page.keyboard.press("f");
  await expect
    .poll(() => page.evaluate(() => window.__pune.debug.person("Asha").health))
    .toBe(before - 1);
  expect(
    (await page.evaluate(() => window.__pune.state)).lastAttack,
  ).toMatchObject({ weapon: "fists", hit: true, target: "Asha" });
  expect((await page.evaluate(() => window.__pune.state)).job).toBe("pickup");
  expect((await page.evaluate(() => window.__pune.state)).attackClip).toMatch(
    /^Punch_/,
  );
  await page.keyboard.press("Escape");
  await page.locator("#reset").click();
  await page.locator("#world").click({ position: { x: 700, y: 450 } });
  await page.keyboard.press("e");
  await page.keyboard.press("g");
  expect((await page.evaluate(() => window.__pune.state)).job).toBe("delivery");
  expect(errors).toEqual([]);
});
