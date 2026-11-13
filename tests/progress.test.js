import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProgress,
  loadProgress,
  saveProgress,
} from "../src/progress.js";
test("save restores wallet, chosen character, owned weapons and weather", () => {
  let saved;
  const storage = { setItem: (k, v) => (saved = v), getItem: () => saved };
  assert.equal(
    saveProgress(
      {
        wallet: 450,
        look: "man",
        owned: ["fists", "pipe"],
        selected: "pipe",
        weather: "monsoon",
      },
      storage,
    ),
    true,
  );
  assert.deepEqual(loadProgress(storage), {
    version: 1,
    wallet: 450,
    look: "man",
    owned: ["fists", "pipe"],
    selected: "pipe",
    weather: "monsoon",
  });
});
test("malformed storage cannot grant unknown items or stop startup", () => {
  assert.equal(loadProgress({ getItem: () => "{bad" }), null);
  assert.equal(
    saveProgress(
      {},
      {
        setItem: () => {
          throw Error("blocked");
        },
      },
    ),
    false,
  );
  const value = normalizeProgress({
    version: 1,
    wallet: Infinity,
    look: "unknown",
    owned: ["rocket"],
    selected: "rocket",
    weather: "bad",
  });
  assert.equal(value.wallet, 0);
  assert.deepEqual(value.owned, ["fists"]);
  assert.equal(value.look, "girl");
  assert.equal(normalizeProgress({ version: 2 }), null);
});
