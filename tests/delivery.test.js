import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDelivery,
  tickDelivery,
  interactDelivery,
} from "../src/delivery.js";
test("delivery requires collecting and delivering on foot at the correct locations", () => {
  let job = createDelivery([0, 0], [100, 0]);
  assert.equal(interactDelivery(job, [100, 0], true).paid, 0);
  assert.equal(interactDelivery(job, [0, 0], false).job.phase, "pickup");
  job = interactDelivery(job, [0, 0], true).job;
  assert.equal(job.phase, "delivery");
  const done = interactDelivery(job, [100, 0], true);
  assert.equal(done.paid, 450);
  assert.equal(interactDelivery(done.job, [100, 0], true).paid, 0);
});
test("expired deliveries pay nothing", () => {
  const job = tickDelivery(createDelivery([0, 0], [100, 0]), 361);
  assert.equal(job.phase, "failed");
  assert.equal(interactDelivery(job, [0, 0], true).paid, 0);
});
