import { applyCheat } from "./cheats.js";
import { interactAt } from "./missions.js";
import { clampScene, sceneBeat } from "./scene.js";
import { emptySave, parseSave } from "./save.js";
import { loadingTips, streetLines } from "./tips.js";

const WORLD_W = 1600;
const WORLD_H = 1000;
const SAVE_KEY = "gtpune-save";

const solids = [
  { x: 40, y: 20, w: 430, h: 270 },
  { x: 590, y: 20, w: 970, h: 270 },
  { x: 100, y: 790, w: 160, h: 120 },
  { x: 740, y: 770, w: 200, h: 150 },
];

const places = [
  { id: "college-strip", x: 530, y: 330, r: 52, label: "College strip" },
  { id: "chai-stall", x: 180, y: 745, r: 50, label: "Chai stall" },
  { id: "bookshop", x: 840, y: 730, r: 52, label: "Bookshop" },
  { id: "signal", x: 1180, y: 480, r: 48, label: "Signal" },
  { id: "dog", x: 370, y: 660, r: 40, label: "Street dog" },
  { id: "cricket", x: 500, y: 910, r: 56, label: "Gully" },
];

const people = [
  { x: 640, y: 350 },
  { x: 250, y: 760 },
  { x: 700, y: 740 },
  { x: 1260, y: 520 },
];

const lookLines = {
  "college-strip": "The college strip is bags, notice boards, and people who are late on purpose.",
  bookshop: "The bookshop smells like old syllabi and a little rain.",
  signal: "The signal holds FC Road for a breath.",
};

const settleLines = {
  chappal: "You hold up a chappal. The argument decides it has somewhere else to be.",
  newspaper: "A rolled newspaper is enough of a gavel. The crowd thins.",
  dabba: "The steel dabba rings once. Everyone remembers their own business.",
};

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const lineEl = document.querySelector("#line");
const tipEl = document.querySelector("#tip");
const loaderEl = document.querySelector("#loader");
const cheatInput = document.querySelector("#cheat");
const cashEl = document.querySelector("#cash");
const weatherEl = document.querySelector("#weather");
const sceneEl = document.querySelector("#scene");
const missionEl = document.querySelector("#missions");
const cheatedEl = document.querySelector("#cheated");
const vehicleEl = document.querySelector("#vehicle");
const bagEl = document.querySelector("#bag");

let save = loadSave();
const player = { x: save.x, y: save.y, vehicle: save.vehicle };
const parked = {
  scooter: { x: 300, y: 630 },
  auto: { x: 1320, y: 640 },
};
if (player.vehicle === "scooter") parked.scooter = { x: player.x, y: player.y };
if (player.vehicle === "auto") parked.auto = { x: player.x, y: player.y };

const keys = new Set();
let started = false;
let sceneActive = save.scene >= 100;
let objects = [];
let cricketStep = 0;
let honkUntil = 0;
let blockUntil = 0;
let footpathTime = 0;
let streetAt = 0;
let lastPersist = 0;
let celebrated = save.missions.every((mission) => mission.status === "done");
const bumpUntil = new Map();
let audio;

if (sceneActive) spawnObjects();

function loadSave() {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY)) ?? emptySave();
  } catch {
    return emptySave();
  }
}

function persist() {
  save.x = player.x;
  save.y = player.y;
  save.vehicle = player.vehicle;
  save.bag = true;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // The browser kept the chapter in memory only.
  }
}

function say(text) {
  lineEl.textContent = text;
}

function showTip() {
  const index = Math.floor(performance.now() / 2200) % loadingTips.length;
  tipEl.textContent = loadingTips[index];
}

function begin() {
  if (started) return;
  started = true;
  loaderEl.hidden = true;
  audio = new AudioContext();
  say("You are new on FC Road. One bag. The old scooter is waiting.");
}

function cheatFocused() {
  return document.activeElement === cheatInput;
}

function beep() {
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.value = 196;
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.16);
}

function hits(x, y) {
  const radius = 14;
  if (x < 18 || y < 18 || x > WORLD_W - 18 || y > WORLD_H - 18) return true;
  return solids.some((solid) => (
    x + radius > solid.x &&
    x - radius < solid.x + solid.w &&
    y + radius > solid.y &&
    y - radius < solid.y + solid.h
  ));
}

function move(dx, dy) {
  if (!hits(player.x + dx, player.y)) player.x += dx;
  if (!hits(player.x, player.y + dy)) player.y += dy;
}

function onFootpath(x, y) {
  return (y >= 290 && y < 400) || (y >= 560 && y < 750);
}

function bumpScene(amount) {
  const before = save.scene;
  save.scene = clampScene(before + amount);
  const beat = sceneBeat(before, save.scene);
  if (beat === "shout") say("A balcony tells you to keep it down.");
  if (beat === "blocked") {
    say("An auto noses into the lane and will not move.");
    blockUntil = performance.now() + 2800;
  }
  if (beat === "scene") startScene();
}

function spawnObjects() {
  objects = [
    ["chappal", -52, 30],
    ["newspaper", 50, 26],
    ["dabba", 4, -52],
  ].map(([kind, dx, dy]) => ({
    kind,
    x: Math.max(30, Math.min(WORLD_W - 30, player.x + dx)),
    y: Math.max(30, Math.min(WORLD_H - 30, player.y + dy)),
  }));
}

function startScene() {
  sceneActive = true;
  save.scene = 100;
  spawnObjects();
  say("The road is making a scene. A chappal, a newspaper, or a dabba will settle it.");
}

function nearestPlace() {
  return places.find((place) => Math.hypot(place.x - player.x, place.y - player.y) <= place.r) ?? null;
}

function nearestParked() {
  let best = null;
  for (const kind of ["scooter", "auto"]) {
    if (player.vehicle === kind) continue;
    const spot = parked[kind];
    const distance = Math.hypot(spot.x - player.x, spot.y - player.y);
    if (distance < 48 && (!best || distance < best.distance)) best = { kind, distance };
  }
  return best;
}

function applyMission(placeId) {
  const result = interactAt(
    { missions: save.missions, carrying: save.carrying },
    placeId,
    save.weather,
  );
  save.missions = result.progress.missions;
  save.carrying = result.progress.carrying;
  if (result.weather) save.weather = result.weather;
  if (result.pay) save.cash += result.pay;
  if (!result.line) return false;
  say(result.line);
  if (!celebrated && save.missions.every((mission) => mission.status === "done")) {
    celebrated = true;
    say(`${result.line} FC Road has let you in. Kothrud and Karve Nagar stay locked.`);
  }
  return true;
}

function onInteract() {
  if (sceneActive) {
    const object = objects.find((item) => Math.hypot(item.x - player.x, item.y - player.y) < 36);
    if (!object) {
      say("Pick up what the street left: a chappal, a newspaper, or a dabba.");
      return;
    }
    save.scene = 20;
    sceneActive = false;
    objects = [];
    say(settleLines[object.kind]);
    persist();
    return;
  }

  const place = nearestPlace();
  if (place?.id === "dog") {
    save.freeRoam.dog = true;
    say("The street dog accepts one hand, then goes back to its shift.");
    persist();
    return;
  }
  if (place?.id === "cricket") {
    save.freeRoam.cricket = true;
    if (cricketStep === 0) {
      cricketStep = 1;
      say("A brick and a chappal are the stumps. The ball comes in low.");
    } else {
      cricketStep = 0;
      say("You connect. The ball dies in a tarpaulin, and the gully calls it a four.");
    }
    persist();
    return;
  }
  if (place) {
    if (applyMission(place.id)) {
      persist();
      return;
    }
    if (place.id === "chai-stall") {
      save.freeRoam.chai = true;
      if (save.cash >= 10) {
        save.cash -= 10;
        say("You stop for a cutting. Two sips, three opinions, ten rupees.");
      } else {
        say("You stop anyway. The stall waves off the cup. First week on the road.");
      }
      persist();
      return;
    }
    say(lookLines[place.id] ?? "Nothing here but the road.");
    return;
  }

  if (player.vehicle !== "foot") {
    parked[player.vehicle] = { x: player.x, y: player.y + 28 };
    const left = player.vehicle;
    player.vehicle = "foot";
    say(left === "scooter"
      ? "You leave the old scooter where it stopped."
      : "You leave the auto at the curb.");
    persist();
    return;
  }

  const parkedRide = nearestParked();
  if (parkedRide) {
    player.vehicle = parkedRide.kind;
    say(parkedRide.kind === "scooter"
      ? "The old scooter coughs, then agrees."
      : "The auto smells like vinyl and yesterday's dust.");
    persist();
    return;
  }

  say("Nothing here but the road.");
}

function onHonk() {
  if (player.vehicle === "foot") {
    say("Honking on foot just startles the pigeons.");
    return;
  }
  honkUntil = performance.now() + 500;
  beep();
  bumpScene(player.vehicle === "auto" ? 12 : 15);
}

function bumpPeople() {
  const now = performance.now();
  people.forEach((person, index) => {
    if (Math.hypot(person.x - player.x, person.y - player.y) > 26) return;
    if ((bumpUntil.get(index) ?? 0) > now) return;
    bumpUntil.set(index, now + 1600);
    bumpScene(12);
  });
}

function update(dt) {
  if (!started || cheatFocused()) return;
  const speed = player.vehicle === "foot" ? 155 : player.vehicle === "scooter" ? 275 : 215;
  const scale = performance.now() < blockUntil ? 0.35 : 1;
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;
  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    move((dx / length) * speed * scale * dt, (dy / length) * speed * scale * dt);
  }
  if (player.vehicle !== "foot" && onFootpath(player.x, player.y) && !sceneActive) {
    footpathTime += dt;
    if (footpathTime >= 1) {
      footpathTime = 0;
      bumpScene(8);
    }
  } else {
    footpathTime = 0;
  }
  bumpPeople();
  streetAt += dt;
  if (streetAt > 22 && !lineEl.textContent) {
    streetAt = 0;
    say(streetLines[Math.floor(Math.random() * streetLines.length)]);
  }
  if (performance.now() - lastPersist > 2000) {
    lastPersist = performance.now();
    persist();
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  const viewW = canvas.width / dpr;
  const viewH = canvas.height / dpr;
  const maxX = Math.max(0, WORLD_W - viewW);
  const maxY = Math.max(0, WORLD_H - viewH);
  const camX = Math.max(0, Math.min(maxX, player.x - viewW / 2));
  const camY = Math.max(0, Math.min(maxY, player.y - viewH / 2));

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.save();
  ctx.translate(-camX, -camY);

  ctx.fillStyle = "#d7c4a3";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = "#c4b08a";
  ctx.fillRect(30, 290, 1540, 110);
  ctx.fillRect(30, 560, 1540, 190);
  ctx.fillStyle = "#3e4a55";
  ctx.fillRect(30, 400, 1540, 160);
  ctx.strokeStyle = "#e7e5e4";
  ctx.setLineDash([28, 22]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, 480);
  ctx.lineTo(1560, 480);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const solid of solids) {
    ctx.fillStyle = solid.y < 300 ? "#6d5340" : solid.x < 400 ? "#9a3412" : "#1e3a5f";
    ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
  }
  ctx.fillStyle = "#f3e6c8";
  for (let x = 70; x < 450; x += 54) ctx.fillRect(x, 70, 28, 36);
  for (let x = 620; x < 1500; x += 54) ctx.fillRect(x, 70, 28, 36);

  ctx.fillStyle = "#1c1917";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("COLLEGE STRIP", 530, 250);
  ctx.fillText("CHAI", 180, 850);
  ctx.fillText("BOOKS", 840, 860);

  const signalRed = Math.floor(performance.now() / 3500) % 2 === 0;
  ctx.fillStyle = "#292524";
  ctx.fillRect(1172, 430, 16, 90);
  ctx.fillStyle = signalRed ? "#b91c1c" : "#3f6212";
  ctx.beginPath();
  ctx.arc(1180, 424, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#44403c";
  ctx.fillRect(470, 930, 8, 28);
  ctx.fillRect(530, 930, 8, 28);
  ctx.fillStyle = "#b91c1c";
  ctx.beginPath();
  ctx.arc(500, 900, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#78716c";
  ctx.beginPath();
  ctx.ellipse(370, 668, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(386, 658, 7, 0, Math.PI * 2);
  ctx.fill();

  for (const person of people) {
    ctx.fillStyle = "#0f766e";
    ctx.beginPath();
    ctx.arc(person.x, person.y, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  drawVehicle(parked.scooter, "scooter", player.vehicle === "scooter");
  drawVehicle(parked.auto, "auto", player.vehicle === "auto");

  for (const object of objects) {
    ctx.fillStyle = object.kind === "dabba" ? "#a8a29e" : object.kind === "newspaper" ? "#f5f5f4" : "#7c2d12";
    ctx.fillRect(object.x - 10, object.y - 8, 20, 16);
    ctx.fillStyle = "#1c1917";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(object.kind, object.x, object.y - 14);
  }

  drawActor(player.x, player.y, player.vehicle);
  if (performance.now() < honkUntil) {
    ctx.fillStyle = "#1c1917";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("HONK", player.x, player.y - 28);
  }

  ctx.restore();

  if (save.weather === "rain") {
    ctx.strokeStyle = "rgba(186, 214, 232, 0.55)";
    ctx.lineWidth = 1;
    const shift = (performance.now() / 10) % 30;
    for (let x = -40; x < viewW + 40; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x + shift, 0);
      ctx.lineTo(x + shift - 18, viewH);
      ctx.stroke();
    }
  }
}

function drawVehicle(spot, kind, ridden) {
  if (ridden) return;
  drawActor(spot.x, spot.y, kind, true);
}

function drawActor(x, y, vehicle, empty = false) {
  if (vehicle === "auto") {
    ctx.fillStyle = "#111111";
    ctx.fillRect(x - 18, y - 14, 36, 28);
    ctx.fillStyle = "#f5c518";
    ctx.fillRect(x - 16, y - 12, 32, 22);
    ctx.fillStyle = "#111111";
    ctx.fillRect(x - 16, y - 2, 32, 6);
  } else if (vehicle === "scooter") {
    ctx.fillStyle = "#334155";
    ctx.fillRect(x - 16, y - 4, 32, 8);
    ctx.beginPath();
    ctx.arc(x - 12, y + 6, 5, 0, Math.PI * 2);
    ctx.arc(x + 12, y + 6, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (empty && vehicle !== "foot") return;
  ctx.fillStyle = "#0f766e";
  ctx.beginPath();
  ctx.arc(x, y - 8, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#92400e";
  ctx.fillRect(x + 6, y - 12, 8, 10);
}

function refreshHud() {
  cashEl.textContent = `₹${save.cash}`;
  weatherEl.textContent = save.weather === "rain" ? "Rain" : "Clear";
  sceneEl.value = save.scene;
  vehicleEl.textContent = player.vehicle === "foot"
    ? "On foot"
    : player.vehicle === "scooter"
      ? "Old scooter"
      : "Auto";
  bagEl.textContent = save.carrying ? "Bag: carrying a job" : "Bag: one bag";
  cheatedEl.hidden = !save.cheated;
  missionEl.replaceChildren();
  for (const mission of save.missions) {
    const item = document.createElement("li");
    item.textContent = `${mission.title} — ${mission.status}`;
    missionEl.appendChild(item);
  }
}

function frame(then) {
  const now = performance.now();
  const dt = Math.min(0.05, (now - then) / 1000);
  if (!started) showTip();
  update(dt);
  draw();
  refreshHud();
  globalThis.__gtpune = () => ({
    x: player.x,
    y: player.y,
    vehicle: player.vehicle,
    scene: save.scene,
    weather: save.weather,
    cash: save.cash,
    cheated: save.cheated,
    line: lineEl.textContent,
    started,
    carrying: save.carrying,
    missions: save.missions.map((mission) => ({ id: mission.id, status: mission.status })),
  });
  requestAnimationFrame(() => frame(now));
}

window.addEventListener("keydown", (event) => {
  if (event.target === cheatInput) return;
  if (event.code.startsWith("Arrow")) event.preventDefault();
  if (!started) {
    if (event.key === "Enter") begin();
    return;
  }
  if (event.key === "/") {
    event.preventDefault();
    cheatInput.hidden = false;
    cheatInput.focus();
    return;
  }
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === "KeyE") onInteract();
  if (event.code === "KeyH") onHonk();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

cheatInput.addEventListener("keydown", (event) => {
  event.stopPropagation();
  if (event.key === "Escape") {
    cheatInput.value = "";
    cheatInput.hidden = true;
    cheatInput.blur();
  }
  if (event.key !== "Enter") return;
  event.preventDefault();
  save.x = player.x;
  save.y = player.y;
  save.vehicle = player.vehicle;
  const word = cheatInput.value;
  const outcome = applyCheat(save, word);
  cheatInput.value = "";
  cheatInput.hidden = true;
  cheatInput.blur();
  if (!outcome.accepted) {
    say("The road does not know that word.");
    return;
  }
  save = outcome.save;
  const cleaned = word.trim().toLowerCase();
  if (cleaned === "pavsa") say("The sky opens over FC Road. The save is marked cheated.");
  else if (cleaned === "unhala") say("The rain steps aside. The save is marked cheated.");
  else say("A hundred rupees find the bag. The save is marked cheated.");
  persist();
});

document.querySelectorAll("[data-area]").forEach((button) => {
  button.addEventListener("click", () => {
    const area = save.areas.find((item) => item.id === button.dataset.area);
    say(area.locked
      ? `${area.name} is locked. This chapter is FC Road.`
      : "You are on FC Road.");
  });
});

canvas.addEventListener("pointerdown", () => {
  if (cheatFocused()) {
    cheatInput.blur();
    cheatInput.hidden = true;
  }
});

window.addEventListener("resize", resize);
resize();
showTip();
refreshHud();
requestAnimationFrame((now) => frame(now));
