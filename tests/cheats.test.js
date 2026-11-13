import test from "node:test";
import assert from "node:assert/strict";
import {
  CHEAT_WORDS,
  PEDESTRIAN_BOOST,
  PEDESTRIAN_CAP,
  TRAFFIC_BOOST,
  TRAFFIC_CAP,
  cheatNotice,
  matchCheat,
  nextWeather,
  populationRoom,
  weatherLook,
} from "../src/cheats.js";

test("tilde words raise the footpath, the traffic, and the weather", () => {
  assert.deepEqual(matchCheat("bazaar"), { word: "bazaar", effect: "pedestrians" });
  assert.deepEqual(matchCheat(" Rush-Hour "), {
    word: "rushhour",
    effect: "traffic",
  });
  assert.deepEqual(matchCheat("MONSOON"), { word: "monsoon", effect: "weather" });
  assert.equal(matchCheat(""), null);
  assert.equal(matchCheat("hesoyam"), null);
  assert.equal(Object.keys(CHEAT_WORDS).length, 3);
});

test("weather steps from clear through rain into blue hour", () => {
  assert.equal(nextWeather("clear"), "drizzle");
  assert.equal(nextWeather("drizzle"), "monsoon");
  assert.equal(nextWeather("monsoon"), "blue-hour");
  assert.equal(nextWeather("blue-hour"), "clear");
  assert.equal(nextWeather("unknown"), "drizzle");
  const clear = weatherLook("clear");
  const monsoon = weatherLook("monsoon");
  assert.equal(clear.rain, false);
  assert.equal(clear.night, false);
  assert.equal(monsoon.rain, true);
  assert.ok(monsoon.density > clear.density);
  assert.ok(monsoon.sun < clear.sun);
  assert.equal(weatherLook("blue-hour").night, true);
  assert.equal(weatherLook("blue-hour").rain, false);
  assert.match(cheatNotice("weather", "monsoon", 0), /monsoon/i);
  assert.match(cheatNotice("pedestrians", "clear", PEDESTRIAN_BOOST), /footpath/i);
  assert.match(cheatNotice("pedestrians", "clear", 0), /full/i);
  assert.match(cheatNotice("traffic", "clear", 1), /traffic/i);
});

test("population boosts stop at a cap", () => {
  assert.equal(populationRoom(48, PEDESTRIAN_CAP, PEDESTRIAN_BOOST), PEDESTRIAN_BOOST);
  assert.equal(populationRoom(PEDESTRIAN_CAP, PEDESTRIAN_CAP, PEDESTRIAN_BOOST), 0);
  assert.equal(populationRoom(114, PEDESTRIAN_CAP, PEDESTRIAN_BOOST), 6);
  assert.equal(
    populationRoom(60, TRAFFIC_CAP, TRAFFIC_BOOST.cars + TRAFFIC_BOOST.motorcycles),
    TRAFFIC_BOOST.cars + TRAFFIC_BOOST.motorcycles,
  );
  assert.ok(TRAFFIC_CAP > 60);
});
