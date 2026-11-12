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
  "weather",
  "cheated",
  "cheatsUsed",
  "scene",
  "vehicle",
  "x",
  "y",
  "bag",
  "freeRoam",
];

describe("save shape", () => {
  it("starts a new FC Road chapter with the later neighbourhoods locked", () => {
    const save = emptySave();
    assert.deepEqual(Object.keys(save).sort(), [...SAVE_KEYS].sort());
    assert.equal(save.version, 1);
    assert.equal(save.product, "GTPUNE");
    assert.equal(save.chapter, "fc-road");
    assert.equal(save.bag, true);
    assert.equal(save.cheated, false);
    assert.deepEqual(save.cheatsUsed, []);
    assert.equal(save.vehicle, "foot");
    assert.deepEqual(
      save.areas.map((area) => [area.id, area.name, area.locked]),
      [
        ["kothrud", "Kothrud", true],
        ["karve-nagar", "Karve Nagar", true],
        ["fc-road", "FC Road", false],
      ],
    );
    assert.deepEqual(save.freeRoam, { chai: false, cricket: false, dog: false });
  });

  it("round-trips mission progress, cash, and the cheated flag", () => {
    const save = emptySave();
    save.missions.find((mission) => mission.id === "cutting-run").status = "done";
    save.cash = 60;
    save.weather = "rain";
    save.cheated = true;
    save.cheatsUsed = ["pavsa"];
    save.freeRoam.dog = true;
    save.x = 120;
    save.y = 80;

    const parsed = parseSave(JSON.stringify(save));
    assert.equal(parsed.missions.find((mission) => mission.id === "cutting-run").status, "done");
    assert.equal(parsed.cash, 60);
    assert.equal(parsed.weather, "rain");
    assert.equal(parsed.cheated, true);
    assert.deepEqual(parsed.cheatsUsed, ["pavsa"]);
    assert.equal(parsed.freeRoam.dog, true);
    assert.equal(parsed.x, 120);
    assert.equal(parsed.y, 80);
    assert.equal(parsed.bag, true);
  });

  it("keeps Kothrud and Karve Nagar locked even if a save says otherwise", () => {
    const save = emptySave();
    save.areas = save.areas.map((area) => ({ ...area, locked: false }));
    const parsed = parseSave(JSON.stringify(save));
    assert.equal(parsed.areas.find((area) => area.id === "kothrud").locked, true);
    assert.equal(parsed.areas.find((area) => area.id === "karve-nagar").locked, true);
    assert.equal(parsed.areas.find((area) => area.id === "fc-road").locked, false);
  });

  it("rejects a save that is not this game", () => {
    assert.equal(parseSave("not json"), null);
    assert.equal(parseSave(JSON.stringify({ product: "something-else" })), null);
    assert.equal(parseSave(JSON.stringify({ product: "GTPUNE", version: 1 })), null);
  });
});
