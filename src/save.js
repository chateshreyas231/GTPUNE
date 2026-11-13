import { serviceArea } from "./areas.js";
import { createProgress } from "./missions.js";

const STATUSES = new Set(["available", "active", "done"]);
const VEHICLES = new Set(["foot", "scooter", "auto"]);
const CHEATS = new Set(["pavsa", "unhala", "paise"]);

export function emptySave() {
  const progress = createProgress();
  return {
    version: 1,
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
    weather: "clear",
    cheated: false,
    cheatsUsed: [],
    scene: 0,
    vehicle: "foot",
    x: 220,
    y: 680,
    bag: true,
    freeRoam: { chai: false, cricket: false, dog: false },
  };
}

export function parseSave(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || data.product !== "GTPUNE" || data.version !== 1) return null;
  if (!Array.isArray(data.missions)) return null;

  const save = emptySave();
  for (const mission of save.missions) {
    const incoming = data.missions.find((item) => item && item.id === mission.id);
    if (!incoming || !STATUSES.has(incoming.status)) return null;
    mission.status = incoming.status;
    mission.step = Number.isInteger(incoming.step) && incoming.step >= 0 ? incoming.step : 0;
  }

  const carried = save.missions.find((mission) => mission.id === data.carrying);
  save.carrying = carried && carried.status === "active" ? carried.id : null;
  save.cash = Number.isFinite(data.cash) ? Math.max(0, Math.round(data.cash)) : 0;
  save.weather = data.weather === "rain" ? "rain" : "clear";
  save.cheated = data.cheated === true;
  save.cheatsUsed = Array.isArray(data.cheatsUsed)
    ? data.cheatsUsed.filter((word, index, list) => CHEATS.has(word) && list.indexOf(word) === index)
    : [];
  save.scene = Number.isFinite(data.scene) ? Math.max(0, Math.min(100, data.scene)) : 0;
  save.vehicle = VEHICLES.has(data.vehicle) ? data.vehicle : "foot";
  save.x = Number.isFinite(data.x) ? data.x : save.x;
  save.y = Number.isFinite(data.y) ? data.y : save.y;
  save.bag = true;
  save.freeRoam = {
    chai: data.freeRoam?.chai === true,
    cricket: data.freeRoam?.cricket === true,
    dog: data.freeRoam?.dog === true,
  };
  return save;
}
