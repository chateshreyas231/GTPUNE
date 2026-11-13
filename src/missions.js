const MISSIONS = [
  {
    id: "cutting-run",
    title: "Cutting run",
    pay: 40,
    accept: "The stall puts a steel dabba in your bag. The college strip is along the road.",
    complete: "The college strip takes the dabba. Forty rupees.",
    giver: "chai-stall",
    dropoff: "college-strip",
  },
  {
    id: "notes-drop",
    title: "Notes drop",
    pay: 50,
    accept: "A wrapped bundle of notes. Someone is waiting by the signal.",
    complete: "The signal takes the bundle. Fifty rupees.",
    giver: "chai-stall",
    dropoff: "signal",
  },
];

export function createProgress() {
  return {
    missions: MISSIONS.map((mission) => ({
      id: mission.id,
      kind: "delivery",
      title: mission.title,
      status: "available",
    })),
    carrying: null,
  };
}

function clone(progress) {
  return {
    carrying: progress.carrying,
    missions: progress.missions.map((mission) => ({ ...mission })),
  };
}

function mission(progress, id) {
  return progress.missions.find((item) => item.id === id);
}

function result(progress, extra = {}) {
  return { progress, pay: 0, line: null, ...extra };
}

function accept(progress, id) {
  if (progress.carrying) {
    return result(progress, { line: "Your bag already has a run." });
  }
  const job = mission(progress, id);
  job.status = "active";
  progress.carrying = id;
  return result(progress, { line: MISSIONS.find((item) => item.id === id).accept });
}

function complete(progress, id) {
  const spec = MISSIONS.find((item) => item.id === id);
  const job = mission(progress, id);
  job.status = "done";
  progress.carrying = null;
  return result(progress, { pay: spec.pay, line: spec.complete });
}

export function interactAt(progress, placeId) {
  const next = clone(progress);
  const cutting = mission(next, "cutting-run");
  const notes = mission(next, "notes-drop");

  if (placeId === "chai-stall") {
    if (cutting.status === "available") return accept(next, "cutting-run");
    if (next.carrying) return result(next, { line: "Your bag already has a run." });
    if (cutting.status === "done" && notes.status === "available") return accept(next, "notes-drop");
    return result(next, { line: "The kettle stays on. Today's runs are done." });
  }

  if (placeId === "college-strip" && next.carrying === "cutting-run") {
    return complete(next, "cutting-run");
  }

  if (placeId === "signal" && next.carrying === "notes-drop") {
    return complete(next, "notes-drop");
  }

  if (placeId === "bookshop") {
    return result(next, { line: "Second-hand syllabi, and a fan that never quite stops." });
  }

  if (placeId === "college-strip") {
    return result(next, { line: "The college strip is bags, notice boards, and people who are late on purpose." });
  }

  if (placeId === "signal") {
    return result(next, { line: "The signal holds FC Road for a breath." });
  }

  return result(next);
}
