import { serviceArea } from "./areas.js";
import { createProgress } from "./missions.js";

const STATUSES = new Set(["available", "active", "done"]);

export function emptySave() {
  const progress = createProgress();
  return {
    version: 2,
    product: serviceArea.product,
    chapter: "fc-road",
    areas: serviceArea.neighbourhoods.map((area) => ({
      id: area.id,
      name: area.name,
      locked: area.id !== "fc-road",
    })),
    missions: progress.missions,
    carrying: null,
    cash: 0,
    night: false,
    rain: false,
    x: -4,
    y: 1.15,
    z: 5.6,
  };
}

export function parseSave(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || data.product !== "GTPUNE" || data.version !== 2) return null;
  if (!Array.isArray(data.missions)) return null;

  const save = emptySave();
  for (const mission of save.missions) {
    const incoming = data.missions.find((item) => item && item.id === mission.id);
    if (!incoming || !STATUSES.has(incoming.status)) return null;
    mission.status = incoming.status;
  }

  const carried = save.missions.find((mission) => mission.id === data.carrying);
  save.carrying = carried && carried.status === "active" ? carried.id : null;
  save.cash = Number.isFinite(data.cash) ? Math.max(0, Math.round(data.cash)) : 0;
  save.night = data.night === true;
  save.rain = data.rain === true;
  save.x = Number.isFinite(data.x) ? data.x : save.x;
  save.y = Number.isFinite(data.y) ? data.y : save.y;
  save.z = Number.isFinite(data.z) ? data.z : save.z;
  return save;
}
