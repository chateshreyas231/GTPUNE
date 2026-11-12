import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createProgress, interactAt } from "../src/missions.js";

function status(progress, id) {
  return progress.missions.find((mission) => mission.id === id).status;
}

describe("mission state", () => {
  it("opens FC Road with two deliveries", () => {
    const progress = createProgress();
    assert.deepEqual(
      progress.missions.map((mission) => ({ id: mission.id, kind: mission.kind, status: mission.status })),
      [
        { id: "cutting-run", kind: "delivery", status: "available" },
        { id: "notes-drop", kind: "delivery", status: "available" },
      ],
    );
    assert.equal(progress.carrying, null);
  });

  it("starts the cutting run by walking up to the stall and finishes it at the college strip", () => {
    const accepted = interactAt(createProgress(), "chai-stall");
    assert.equal(status(accepted.progress, "cutting-run"), "active");
    assert.equal(accepted.progress.carrying, "cutting-run");
    assert.match(accepted.line, /dabba/i);

    const delivered = interactAt(accepted.progress, "college-strip");
    assert.equal(status(delivered.progress, "cutting-run"), "done");
    assert.equal(delivered.progress.carrying, null);
    assert.equal(delivered.pay, 40);
  });

  it("starts the notes drop at the stall only after the first run", () => {
    const early = interactAt(createProgress(), "signal");
    assert.equal(early.pay, 0);
    assert.equal(status(early.progress, "notes-drop"), "available");

    let progress = interactAt(createProgress(), "chai-stall").progress;
    progress = interactAt(progress, "college-strip").progress;
    const second = interactAt(progress, "chai-stall");
    assert.equal(second.progress.carrying, "notes-drop");

    const delivered = interactAt(second.progress, "signal");
    assert.equal(delivered.pay, 50);
    assert.equal(status(delivered.progress, "notes-drop"), "done");
  });

  it("keeps the bag to one run", () => {
    const accepted = interactAt(createProgress(), "chai-stall");
    const again = interactAt(accepted.progress, "chai-stall");
    assert.equal(again.progress.carrying, "cutting-run");
    assert.match(again.line, /bag/i);
    assert.equal(status(again.progress, "notes-drop"), "available");
  });
});
