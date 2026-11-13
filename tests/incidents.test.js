import test from "node:test";
import assert from "node:assert/strict";
import {
  INCIDENTS,
  chooseIncident,
  createIncidentSchedule,
  crowdRing,
  nearestRoadSite,
  pickIncidentSite,
  releaseIncident,
  tickSchedule,
} from "../src/incidents.js";

const road = { a: [0, -200], b: [0, 200], length: 400, width: 12 };

test("the three city incidents are a stall, a crowd, and a roadside breakdown", () => {
  assert.deepEqual(
    INCIDENTS.map((item) => item.id),
    ["stalled-vehicle", "stall-crowd", "roadside-breakdown"],
  );
  assert.equal(INCIDENTS[1].crowd, 6);
  assert.match(INCIDENTS[0].notice, /stalled/i);
  assert.match(INCIDENTS[1].notice, /crowd/i);
  assert.match(INCIDENTS[2].notice, /side of the road/i);
});

test("incidents wait until play is running, then arrive in order", () => {
  const schedule = createIncidentSchedule({ rng: () => 0, firstDelay: 10, gap: 20 });
  assert.equal(tickSchedule(schedule, 100, { playing: false }), null);
  assert.equal(schedule.nextIn, 10);
  assert.equal(tickSchedule(schedule, 9, { playing: true }), null);
  const first = tickSchedule(schedule, 1, { playing: true });
  const second = tickSchedule(schedule, 20, { playing: true });
  assert.equal(first.id, "stalled-vehicle");
  assert.equal(second.id, "stall-crowd");
  assert.equal(tickSchedule(schedule, 20, { playing: true }), null);
  assert.equal(schedule.active.size, 2);
  releaseIncident(schedule, "stalled-vehicle");
  const third = tickSchedule(schedule, 5, { playing: true });
  assert.equal(third.id, "roadside-breakdown");
  releaseIncident(schedule, "stall-crowd");
  releaseIncident(schedule, "roadside-breakdown");
  const again = chooseIncident(schedule);
  assert.ok(INCIDENTS.some((item) => item.id === again.id));
});

test("an incident is placed ahead on the road, with the crowd kept on the footpath", () => {
  const site = pickIncidentSite([road], 0, 0, 0);
  assert.ok(site);
  assert.equal(site.segment, road);
  assert.ok(site.d >= 22 && site.d <= 78);
  const pointZ = road.a[1] + (road.b[1] - road.a[1]) * site.t;
  assert.ok(pointZ < -20);
  assert.equal(pickIncidentSite([], 0, 0, 0), null);
  const near = nearestRoadSite([road], 10, 0, 40);
  assert.ok(near);
  assert.ok(Math.abs(near.t - 0.5) > 0.05);
  const crowd = crowdRing(6);
  assert.equal(crowd.length, 6);
  const along = crowd.map((spot) => spot.along);
  assert.ok(Math.max(...along) - Math.min(...along) > 3);
  assert.ok(crowd.every((spot) => spot.out < 1.2));
});
