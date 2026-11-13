import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createProgress, interactAt } from "../src/missions.js";

function status(progress, id) {
  return progress.missions.find((mission) => mission.id === id).status;
}

describe("mission state", () => {
  it("opens chapter 1 with two deliveries and two street stories", () => {
    const progress = createProgress();
    assert.deepEqual(
      progress.missions.map((mission) => ({
        id: mission.id,
        kind: mission.kind,
        status: mission.status,
      })),
      [
        { id: "cutting-run", kind: "delivery", status: "available" },
        { id: "notes-drop", kind: "delivery", status: "available" },
        { id: "stall-regular", kind: "story", status: "available" },
        { id: "red-means-talk", kind: "story", status: "available" },
      ],
    );
    assert.equal(progress.carrying, null);
  });

  it("carries the cutting run to the college strip and pays extra in the rain", () => {
    const accepted = interactAt(createProgress(), "chai-stall", "clear");
    assert.equal(status(accepted.progress, "cutting-run"), "active");
    assert.equal(accepted.progress.carrying, "cutting-run");
    assert.equal(accepted.weather, "rain");
    assert.match(accepted.line, /dabba/i);

    const delivered = interactAt(accepted.progress, "college-strip", "rain");
    assert.equal(status(delivered.progress, "cutting-run"), "done");
    assert.equal(delivered.progress.carrying, null);
    assert.equal(delivered.pay, 60);
  });

  it("pays the dry rate when the notes drop stays clear", () => {
    const accepted = interactAt(createProgress(), "bookshop", "clear");
    assert.equal(accepted.progress.carrying, "notes-drop");
    assert.equal(accepted.weather, undefined);

    const delivered = interactAt(accepted.progress, "signal", "clear");
    assert.equal(status(delivered.progress, "notes-drop"), "done");
    assert.equal(delivered.pay, 50);
  });

  it("pays the rain bonus on the notes drop too", () => {
    const accepted = interactAt(createProgress(), "bookshop", "rain");
    const delivered = interactAt(accepted.progress, "signal", "rain");
    assert.equal(delivered.pay, 75);
  });

  it("does not finish a delivery that was never picked up", () => {
    const result = interactAt(createProgress(), "college-strip", "rain");
    assert.equal(result.pay, 0);
    assert.equal(result.progress.carrying, null);
    assert.equal(status(result.progress, "cutting-run"), "available");
  });

  it("holds one bag, so a second delivery waits", () => {
    const accepted = interactAt(createProgress(), "chai-stall", "clear");
    const blocked = interactAt(accepted.progress, "bookshop", "rain");
    assert.equal(blocked.progress.carrying, "cutting-run");
    assert.equal(status(blocked.progress, "notes-drop"), "available");
    assert.match(blocked.line, /bag/i);
  });

  it("tells the stall story only after the cutting run, in three lines", () => {
    let progress = interactAt(createProgress(), "chai-stall", "clear").progress;
    progress = interactAt(progress, "college-strip", "rain").progress;

    const first = interactAt(progress, "chai-stall", "clear");
    assert.equal(status(first.progress, "stall-regular"), "active");
    assert.match(first.line, /stall|regular|kettle/i);

    const second = interactAt(first.progress, "chai-stall", "clear");
    assert.equal(status(second.progress, "stall-regular"), "active");

    const third = interactAt(second.progress, "chai-stall", "clear");
    assert.equal(status(third.progress, "stall-regular"), "done");
    assert.ok(third.line);
  });

  it("tells the signal story without a parcel", () => {
    const first = interactAt(createProgress(), "signal", "clear");
    assert.equal(status(first.progress, "red-means-talk"), "active");
    assert.equal(status(first.progress, "notes-drop"), "available");

    const second = interactAt(first.progress, "signal", "clear");
    const third = interactAt(second.progress, "signal", "clear");
    assert.equal(status(third.progress, "red-means-talk"), "done");
  });

  it("delivers notes before starting the signal story when the bag is full", () => {
    const accepted = interactAt(createProgress(), "bookshop", "clear");
    const delivered = interactAt(accepted.progress, "signal", "clear");
    assert.equal(delivered.pay, 50);
    assert.equal(status(delivered.progress, "red-means-talk"), "available");
  });
});
