import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCheat } from "../src/cheats.js";
import { emptySave } from "../src/save.js";

describe("cheat flags", () => {
  it("pavsa starts the rain and marks the save cheated", () => {
    const next = applyCheat(emptySave(), "pavsa");
    assert.equal(next.accepted, true);
    assert.equal(next.save.weather, "rain");
    assert.equal(next.save.cheated, true);
    assert.deepEqual(next.save.cheatsUsed, ["pavsa"]);
  });

  it("unhala clears the sky and still counts as a cheat", () => {
    const raining = applyCheat(emptySave(), "pavsa").save;
    const next = applyCheat(raining, "UNHALA");
    assert.equal(next.accepted, true);
    assert.equal(next.save.weather, "clear");
    assert.equal(next.save.cheated, true);
    assert.deepEqual(next.save.cheatsUsed, ["pavsa", "unhala"]);
  });

  it("paise adds cash and marks the save cheated", () => {
    const next = applyCheat(emptySave(), " paise ");
    assert.equal(next.accepted, true);
    assert.equal(next.save.cash, 100);
    assert.equal(next.save.cheated, true);
    assert.deepEqual(next.save.cheatsUsed, ["paise"]);
  });

  it("does not mark the save cheated for an unknown word", () => {
    const next = applyCheat(emptySave(), "hello");
    assert.equal(next.accepted, false);
    assert.equal(next.save.cheated, false);
    assert.deepEqual(next.save.cheatsUsed, []);
    assert.equal(next.save.cash, 0);
    assert.equal(next.save.weather, "clear");
  });

  it("records a repeated cheat once", () => {
    const once = applyCheat(emptySave(), "paise").save;
    const twice = applyCheat(once, "paise");
    assert.equal(twice.save.cash, 200);
    assert.deepEqual(twice.save.cheatsUsed, ["paise"]);
    assert.equal(twice.save.cheated, true);
  });
});
