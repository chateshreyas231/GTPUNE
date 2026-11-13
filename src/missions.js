const MISSIONS = [
  {
    id: "cutting-run",
    kind: "delivery",
    title: "Cutting run",
    giver: "chai-stall",
    dropoff: "college-strip",
    basePay: 40,
    rainBonus: 20,
    accept: "The stall hands you a steel dabba. Keep it upright on the way to the college strip.",
    clear: "The gate takes the chai. Forty rupees, counted once.",
    rain: "Wet, but the dabba stayed upright. The gate pays sixty, rain included.",
  },
  {
    id: "notes-drop",
    kind: "delivery",
    title: "Notes drop",
    giver: "bookshop",
    dropoff: "signal",
    basePay: 50,
    rainBonus: 25,
    accept: "A paper bundle of second-hand notes. A junior is waiting by the signal.",
    clear: "The junior takes the notes. Fifty rupees.",
    rain: "The junior shields the notes and adds twenty-five for the rain. Seventy-five.",
  },
  {
    id: "stall-regular",
    kind: "story",
    title: "The stall's regular",
    place: "chai-stall",
    lines: [
      "The stall has kept its kettle through three batches of the college.",
      "Regulars do not order. They arrive, and the cutting is already poured.",
      "The road changed around it. The kettle did not.",
    ],
  },
  {
    id: "red-means-talk",
    kind: "story",
    title: "Red means talk",
    place: "signal",
    lines: [
      "One evening the signal stayed red, and the road became a verandah.",
      "Someone shared a newspaper. Nobody was in a hurry to be a vehicle.",
      "When it turned green, FC Road remembered it was a road.",
    ],
  },
];

const BY_ID = Object.fromEntries(MISSIONS.map((mission) => [mission.id, mission]));

export function createProgress() {
  return {
    missions: MISSIONS.map((mission) => ({
      id: mission.id,
      kind: mission.kind,
      title: mission.title,
      status: "available",
      step: 0,
    })),
    carrying: null,
  };
}

function cloneProgress(progress) {
  return {
    carrying: progress.carrying,
    missions: progress.missions.map((mission) => ({ ...mission })),
  };
}

function findMission(progress, id) {
  return progress.missions.find((mission) => mission.id === id);
}

function payFor(id, weather) {
  const mission = BY_ID[id];
  return mission.basePay + (weather === "rain" ? mission.rainBonus : 0);
}

function result(progress, extra = {}) {
  return { progress, pay: 0, line: null, ...extra };
}

function acceptDelivery(progress, id, weather) {
  if (progress.carrying) {
    return result(progress, { line: "Your bag already has a job." });
  }
  const mission = findMission(progress, id);
  mission.status = "active";
  progress.carrying = id;
  const extra = { line: BY_ID[id].accept };
  if (weather) extra.weather = weather;
  return result(progress, extra);
}

function completeDelivery(progress, id, weather) {
  const mission = findMission(progress, id);
  mission.status = "done";
  progress.carrying = null;
  const pay = payFor(id, weather);
  const spoken = BY_ID[id];
  return result(progress, {
    pay,
    line: weather === "rain" ? spoken.rain : spoken.clear,
  });
}

function advanceStory(progress, id) {
  const mission = findMission(progress, id);
  if (mission.status === "done") return result(progress);
  const script = BY_ID[id].lines;
  const step = mission.step + 1;
  mission.step = step;
  mission.status = step >= script.length ? "done" : "active";
  return result(progress, { line: script[step - 1] });
}

function atStall(progress, weather) {
  const cutting = findMission(progress, "cutting-run");
  const story = findMission(progress, "stall-regular");
  if (cutting.status === "available") return acceptDelivery(progress, "cutting-run", "rain");
  if (progress.carrying === "cutting-run") {
    return result(progress, { line: "The dabba is already in the bag. The college strip is ahead." });
  }
  if (progress.carrying) return result(progress, { line: "Your bag already has a job." });
  if (cutting.status === "done" && story.status !== "done") return advanceStory(progress, "stall-regular");
  return result(progress);
}

function atBookshop(progress) {
  const notes = findMission(progress, "notes-drop");
  if (notes.status === "available") return acceptDelivery(progress, "notes-drop");
  if (progress.carrying) return result(progress, { line: "Your bag already has a job." });
  return result(progress);
}

function atCollege(progress, weather) {
  if (progress.carrying === "cutting-run") return completeDelivery(progress, "cutting-run", weather);
  return result(progress);
}

function atSignal(progress, weather) {
  if (progress.carrying === "notes-drop") return completeDelivery(progress, "notes-drop", weather);
  if (progress.carrying) return result(progress, { line: "Your bag already has a job." });
  const story = findMission(progress, "red-means-talk");
  if (story.status !== "done") return advanceStory(progress, "red-means-talk");
  return result(progress);
}

const PLACES = {
  "chai-stall": atStall,
  bookshop: atBookshop,
  "college-strip": atCollege,
  signal: atSignal,
};

export function interactAt(progress, placeId, weather) {
  const next = cloneProgress(progress);
  const visit = PLACES[placeId];
  if (!visit) return result(next);
  return visit(next, weather);
}
