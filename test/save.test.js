import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptySave, parseSave } from "../src/save.js";

const SAVE_KEYS = [
  "version",
  "product",
  "chapter",
  "areas",
  "missions",
  "carrying",
  "cash",
  "night",
  "rain",
  "x",
  "y",
  "z",
];

describe("save shape", () => {
  it("starts chapter 1 on FC Road with the other neighbourhoods locked", () => {
    const save = emptySave();
    assert.deepEqual(Object.keys(save).sort(), [...SAVE_KEYS].sort());
    assert.equal(save.version, 2);
    assert.equal(save.product, "GTPUNE");
    assert.equal(save.chapter, "fc-road");
    assert.equal(save.night, false);
    assert.equal(save.rain, false);
    assert.equal(save.cash, 0);
    assert.deepEqual(
      save.areas.map((area) => [area.id, area.name, area.locked]),
      [
        ["kothrud", "Kothrud", true],
        ["karve-nagar", "Karve Nagar", true],
        ["fc-road", "FC Road", false],
      ],
    );
  });

  it("round-trips mission progress, cash, weather, and position", () => {
    const save = emptySave();
    save.missions.find((mission) => mission.id === "cutting-run").status = "done";
    save.cash = 40;
    save.night = true;
    save.rain = true;
    save.x = 3;
    save.y = 1;
    save.z = -2;

    const parsed = parseSave(JSON.stringify(save));
    assert.equal(parsed.missions.find((mission) => mission.id === "cutting-run").status, "done");
    assert.equal(parsed.cash, 40);
    assert.equal(parsed.night, true);
    assert.equal(parsed.rain, true);
    assert.equal(parsed.x, 3);
    assert.equal(parsed.z, -2);
  });

  it("keeps Kothrud and Karve Nagar locked even if a save says otherwise", () => {
    const save = emptySave();
    save.areas = save.areas.map((area) => ({ ...area, locked: false }));
    const parsed = parseSave(JSON.stringify(save));
    assert.equal(parsed.areas.find((area) => area.id === "kothrud").locked, true);
    assert.equal(parsed.areas.find((area) => area.id === "karve-nagar").locked, true);
    assert.equal(parsed.areas.find((area) => area.id === "fc-road").locked, false);
  });

  it("rejects a save from another game", () => {
    assert.equal(parseSave("nope"), null);
    assert.equal(parseSave(JSON.stringify({ product: "GTPUNE", version: 1, missions: [] })), null);
  });
});
