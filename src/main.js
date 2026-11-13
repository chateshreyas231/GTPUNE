import { createDelivery, tickDelivery, interactDelivery } from "./delivery.js";
import { streetDetails } from "./street-details.js";
import { loadSurfacePhotos, hydrateResidents } from "./visual-assets.js";
import { lines } from "./dialogue.js";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import "./style.css";
import {
  fallbackCity,
  parseOSM,
  segmentDistance,
  inside,
  makeCar,
  person,
  origin,
} from "./city.js";
const $ = (id) => document.getElementById(id);
let city = fallbackCity();
try {
  const r = await fetch("/data/pune-osm.json");
  if (r.ok && r.headers.get("content-type")?.includes("json"))
    city = parseOSM(await r.json());
} catch (e) {
  console.warn("Using illustrative map:", e.message);
}
const surfacePhotos = await loadSurfacePhotos();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc6c8ac);
scene.fog = new THREE.FogExp2(0xc6c8ac, 0.0013);
const renderer = new THREE.WebGLRenderer({
  canvas: $("world"),
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
const gl = renderer.getContext(),
  debug = gl.getExtension("WEBGL_debug_renderer_info");
const softwareGPU =
  debug &&
  /swiftshader|llvmpipe/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
renderer.shadowMap.enabled = !softwareGPU;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const camera = new THREE.PerspectiveCamera(
  57,
  innerWidth / innerHeight,
  0.2,
  6000,
);
const hemi = new THREE.HemisphereLight(0xe7ecde, 0x676956, 2.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd59b, 3.5);
sun.position.set(-170, 240, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, {
  left: -180,
  right: 180,
  top: 180,
  bottom: -180,
  near: 1,
  far: 650,
});
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const material = (c) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
const mats = {
  road: new THREE.MeshStandardMaterial({
    color: 0xb0b0b0,
    map: surfacePhotos.asphalt,
    roughness: 0.93,
  }),
  walk: material(0xb2af92),
  mark: material(0xc8c9aa),
  trunk: material(0x6e5c42),
  leaf: material(0x566d43),
};
function box(w, h, d, mat, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  if (mat === mats.road) {
    const pos = m.geometry.attributes.position,
      uv = m.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, pos.getX(i) / 4, pos.getZ(i) / 4);
  }
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
box(16000, 1, 16000, material(0x8b9273), 0, -0.6, 0);
const roadSegments = [];
for (const road of city.roads)
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1],
      b = road.points[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 0.3) continue;
    const angle = Math.atan2(dx, dz),
      x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2;
    roadSegments.push({ a, b, width: road.width, length, angle });
  }
const roadGroup = new THREE.Group();
scene.add(roadGroup);
function renderRoads(cx, cz) {
  for (const mesh of [...roadGroup.children]) {
    mesh.geometry.dispose();
    roadGroup.remove(mesh);
  }
  for (const r of roadSegments) {
    if (segmentDistance(cx, cz, r.a, r.b) > 1000) continue;
    const { a, b, width, length, angle } = r,
      x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2;
    box(width + 5, 0.2, length, mats.walk, x, 0, z, roadGroup).rotation.y =
      angle;
    box(
      width,
      0.08,
      length + 0.1,
      mats.road,
      x,
      0.15,
      z,
      roadGroup,
    ).rotation.y = angle;
    for (let t = 6; t < length; t += 18)
      box(
        0.17,
        0.03,
        5,
        mats.mark,
        a[0] + ((b[0] - a[0]) * t) / length,
        0.2,
        a[1] + ((b[1] - a[1]) * t) / length,
        roadGroup,
      ).rotation.y = angle;
  }
  mergeStatic(roadGroup);
}

function facade() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#c7bc9e";
  ctx.fillRect(0, 0, 512, 512);
  if (surfacePhotos.plaster)
    ctx.drawImage(surfacePhotos.plaster.image, 0, 0, 512, 512);
  for (let y = 12; y < 512; y += 128) {
    ctx.fillStyle = "#afa38b";
    ctx.fillRect(0, y + 107, 512, 6);
    for (let x = 20; x < 512; x += 128) {
      ctx.fillStyle = "#302f2c";
      ctx.fillRect(x - 5, y - 5, 76, 91);
      ctx.fillStyle = "#637e82";
      ctx.fillRect(x, y, 66, 78);
      ctx.fillStyle = "#a7b5ac";
      ctx.fillRect(x + 5, y + 3, 24, 68);
      ctx.fillStyle = "#bcb8a4";
      ctx.fillRect(x + 31, y, 3, 78);
      ctx.fillRect(x, y + 38, 66, 3);
      ctx.fillStyle = "#827b6a";
      ctx.fillRect(x - 8, y + 80, 82, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const facadeTex = facade();
const palette = [0xc9bd9f, 0xd6c5ad, 0xb7b8ac, 0xb8c1b0, 0xd1b29a];
const buildingMats = palette.map(
  (c) =>
    new THREE.MeshStandardMaterial({ color: c, map: facadeTex, roughness: 1 }),
);
const roofMat = material(0x9b9b8b);
const obstacles = city.buildings.map((b) => {
  const xs = b.points.map((p) => p[0]),
    zs = b.points.map((p) => p[1]);
  return {
    ...b,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
});
const buildingGroup = new THREE.Group();
scene.add(buildingGroup);
let buildingCenter = new THREE.Vector2(Infinity, Infinity);
let detailGroup;
function renderBuildings(cx, cz) {
  for (const mesh of [...buildingGroup.children]) {
    mesh.geometry.dispose();
    buildingGroup.remove(mesh);
  }
  buildingCenter.set(cx, cz);
  renderRoads(cx, cz);
  for (const b of obstacles) {
    if (
      Math.hypot((b.minX + b.maxX) / 2 - cx, (b.minZ + b.maxZ) / 2 - cz) > 900
    )
      continue;
    if (b.points.length < 3) continue;
    const shape = new THREE.Shape();
    shape.moveTo(b.points[0][0], -b.points[0][1]);
    for (const p of b.points.slice(1)) shape.lineTo(p[0], -p[1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: b.height,
      bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) / 10, uv.getY(i) / 12);
    const m = new THREE.Mesh(geo, [
      roofMat,
      buildingMats[Math.floor(b.color * 5) % 5],
    ]);
    m.castShadow = true;
    m.receiveShadow = true;
    buildingGroup.add(m);
  }
  mergeStatic(buildingGroup);
  if (detailGroup) {
    scene.remove(detailGroup);
    detailGroup.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }
  detailGroup = streetDetails(cx, cz, roadSegments, collides);
  mergeStatic(detailGroup);
  scene.add(detailGroup);
}
function sign(text, x, z, angle = 0) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#254a3d";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#dedac0";
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = "#f3e7bd";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, 256, 76);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 4),
    new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }),
  );
  m.position.set(x, 7, z);
  m.rotation.y = angle;
  scene.add(m);
  box(0.25, 5, 0.25, mats.trunk, x, 2.5, z);
}
const shopNames = [
  "अमृततुल्य · CHAI",
  "पुणेरी मिसळ",
  "पुस्तक भांडार",
  "नमस्कार पुणे",
  "BAKERY & CAFÉ",
];
const treeGeo = new THREE.IcosahedronGeometry(1, 1);
for (
  let i = 0;
  i < roadSegments.length;
  i += Math.max(1, Math.floor(roadSegments.length / 170))
) {
  const r = roadSegments[i];
  for (let t = 22; t < r.length; t += 55) {
    const dx = (r.b[0] - r.a[0]) / r.length,
      dz = (r.b[1] - r.a[1]) / r.length;
    for (const side of [-1, 1]) {
      const x = r.a[0] + dx * t + dz * (r.width / 2 + 5) * side,
        z = r.a[1] + dz * t - dx * (r.width / 2 + 5) * side;
      if (
        roadSegments.some(
          (segment) =>
            segmentDistance(x, z, segment.a, segment.b) < segment.width / 2 + 1,
        )
      )
        continue;
      box(0.65, 5, 0.65, mats.trunk, x, 2.5, z);
      const tree = new THREE.Mesh(treeGeo, mats.leaf);
      tree.scale.set(4.5, 5.5, 4.5);
      tree.position.set(x, 7, z);
      tree.castShadow = true;
      scene.add(tree);
    }
  }
}
if (city.source === "illustrative") {
  for (let i = 0; i < 9; i++) {
    const z = -650 + i * 150;
    sign(shopNames[i % shopNames.length], -35, z);
    box(
      15,
      0.4,
      6,
      material([0x9d5f45, 0x506d5d, 0xb1904b][i % 3]),
      -35,
      4.5,
      z + 2,
    );
  }
  sign("फर्ग्युसन कॉलेज रस्ता  ↑", 10, -320);
  sign("कोथरूड  ←", -390, 310);
}
for (const stop of city.stops)
  sign(stop.name, stop.point[0] + 18, stop.point[1] + 12);
// Merge static scenery by material to keep draw calls low on integrated GPUs.
function mergeStatic(root) {
  const batches = new Map();
  for (const object of [...root.children]) {
    if (!object.isMesh) continue;
    object.updateMatrixWorld();
    const source = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry;
    const groups = Array.isArray(object.material)
      ? source.groups
      : [
          {
            start: 0,
            count: source.attributes.position.count,
            materialIndex: 0,
          },
        ];
    for (const group of groups) {
      const mat = Array.isArray(object.material)
        ? object.material[group.materialIndex]
        : object.material;
      const geometry = new THREE.BufferGeometry();
      for (const name of ["position", "normal", "uv"]) {
        const attr = source.attributes[name];
        if (attr)
          geometry.setAttribute(
            name,
            new THREE.BufferAttribute(
              attr.array.slice(
                group.start * attr.itemSize,
                (group.start + group.count) * attr.itemSize,
              ),
              attr.itemSize,
            ),
          );
      }
      geometry.applyMatrix4(object.matrixWorld);
      if (!batches.has(mat)) batches.set(mat, []);
      batches.get(mat).push(geometry);
    }
    root.remove(object);
    object.geometry.dispose();
  }
  for (const [mat, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    for (const g of geometries) g.dispose();
  }
}
mergeStatic(scene);
renderBuildings(city.spawn[0], city.spawn[1]);
const spawnRoad = roadSegments.reduce((a, b) =>
  segmentDistance(...city.spawn, a.a, a.b) <
  segmentDistance(...city.spawn, b.a, b.b)
    ? a
    : b,
);
const spawnHeading = city.source === "OpenStreetMap" ? spawnRoad.angle : 0;
const player = makeCar(0xe5d6ae);
player.rotation.y = spawnHeading;
scene.add(player);
player.position.set(city.spawn[0], 0, city.spawn[1]);
const avatar = person(3);
avatar.visible = false;
scene.add(avatar);
const localRoads = roadSegments.filter(
  (r) => r.length > 25 && segmentDistance(...city.spawn, r.a, r.b) < 300,
);
const populationRoads = localRoads.length ? localRoads : roadSegments;
const pedestrians = [];
for (let i = 0; i < 72; i++) {
  const r = populationRoads[(i * 7) % populationRoads.length],
    t = 0.15 + (i % 7) * 0.1,
    dx = (r.b[0] - r.a[0]) / r.length,
    dz = (r.b[1] - r.a[1]) / r.length,
    offset = r.width / 2 + 1.7;
  const p = person(i);
  if (i > 0 && i % 12 === 1) {
    p.scale.setScalar(0.68);
    p.userData.child = true;
  }
  const start = new THREE.Vector3(
    r.a[0] + (r.b[0] - r.a[0]) * t + dz * offset,
    0,
    r.a[1] + (r.b[1] - r.a[1]) * t - dx * offset,
  );
  if (p.userData.child && pedestrians.length) {
    start.copy(pedestrians[pedestrians.length - 1].start);
    start.x += 0.85;
  }
  p.position.copy(start);
  scene.add(p);
  pedestrians.push({
    mesh: p,
    start,
    angle: r.angle,
    phase: p.userData.child ? i - 1 : i,
  });
}
// Put a resident within conversational reach of the starting point.
pedestrians[0].start.set(city.spawn[0] + 5, 0, city.spawn[1] - 5);
const adjacency = new Map();
const nodeKey = (p) => p.map((v) => v.toFixed(1)).join(",");
for (const r of roadSegments)
  for (const end of [r.a, r.b]) {
    const key = nodeKey(end);
    if (!adjacency.has(key)) adjacency.set(key, []);
    adjacency.get(key).push(r);
  }
const traffic = [];
for (let i = 0; i < 24; i++) {
  const r = populationRoads[(i * 11) % populationRoads.length];
  if (r.length < 30) continue;
  const m = makeCar(
    [0xa7b7b3, 0xe3dac4, 0x678e92, 0xa4523f][i % 4],
    i % 4 === 0,
  );
  scene.add(m);
  traffic.push({
    mesh: m,
    road: r,
    t: (i * 0.173) % 1,
    direction: i % 2 ? 1 : -1,
  });
}
const parked = [];
let detailedHumans = 0;
hydrateResidents([
  avatar,
  ...pedestrians.filter((_, i) => i % 9 === 0).map((p) => p.mesh),
])
  .then((n) => (detailedHumans = n))
  .catch((e) => console.warn("Human asset fallback", e));
let job = null,
  wallet = 0;
try {
  wallet = Number(localStorage.getItem("pune-wallet")) || 0;
} catch {}
let targetIndex = 0;
const marker = new THREE.Group();
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(6, 0.25, 8, 48),
  new THREE.MeshBasicMaterial({ color: 0xffcd77 }),
);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.5;
marker.add(ring);
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 5, 45, 16, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0xffce7a,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
);
beam.position.y = 22;
marker.add(beam);
scene.add(marker);
marker.position.set(...[city.stops[0].point[0], 0, city.stops[0].point[1]]);
let active = false,
  paused = false,
  walking = false,
  running = false,
  speed = 0,
  yaw = spawnHeading,
  camYaw = spawnHeading,
  camPitch = 0.05,
  orbitYaw = 0,
  view = 0,
  sound = false,
  night = false,
  elapsed = 0,
  distanceTravelled = 0;
let vehicle = { mesh: player, kind: "own" };
let moveX = 0,
  moveZ = -1;
const keys = new Set();
let previousTime = performance.now();
let audioContext, engine, engineGain, toastTimer;
const voicePlayer = new Audio();
voicePlayer.volume = 0.9;
const actor = () => (walking ? avatar : vehicle.mesh);
const ENTER_REACH = 4;
function carChoices() {
  return [
    { mesh: player, kind: "own" },
    ...traffic.map((sim) => ({ mesh: sim.mesh, kind: "traffic", sim })),
    ...parked,
  ];
}
function nearVehicle(x, z, radius, ignore) {
  return carChoices().some(
    (car) =>
      car.mesh !== ignore &&
      Math.hypot(x - car.mesh.position.x, z - car.mesh.position.z) < radius,
  );
}
function closestCar() {
  let best = null,
    bestD = ENTER_REACH;
  for (const car of carChoices()) {
    const d = Math.hypot(
      avatar.position.x - car.mesh.position.x,
      avatar.position.z - car.mesh.position.z,
    );
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").style.opacity = "0"), 3200);
}
function enableSound() {
  sound = !sound;
  $("audio").textContent = sound ? "SOUND ON" : "SOUND OFF";
  if (sound && !audioContext) {
    audioContext = new AudioContext();
    engine = audioContext.createOscillator();
    engineGain = audioContext.createGain();
    engine.type = "sawtooth";
    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 170;
    engine.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(audioContext.destination);
    engineGain.gain.value = 0;
    engine.start();
  }
  if (sound) audioContext.resume();
  else {
    voicePlayer.pause();
    window.speechSynthesis?.cancel();
  }
}
function honk() {
  if (!sound) {
    toast("Turn sound on to hear the horn and engine.");
    return;
  }
  const o = audioContext.createOscillator(),
    g = audioContext.createGain();
  o.frequency.value = 370;
  o.type = "triangle";
  o.connect(g);
  g.connect(audioContext.destination);
  g.gain.setValueAtTime(0.08, audioContext.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
  o.start();
  o.stop(audioContext.currentTime + 0.36);
}
let talkIndex = 0,
  dialogueTimer;
function talk() {
  const nearby = pedestrians.some(
    (p) => p.mesh.position.distanceTo(actor().position) < 22,
  );
  if (!nearby) {
    toast("Get within 22 metres of a pedestrian to talk.");
    return;
  }
  const lang = $("language").value,
    clipIndex = talkIndex++ % 3,
    text = lines[lang][clipIndex];
  $("dialogue").replaceChildren();
  const label = document.createElement("small");
  label.textContent = "NEIGHBOUR · शेजारी";
  $("dialogue").append(label, document.createTextNode(text));
  $("dialogue").hidden = false;
  clearTimeout(dialogueTimer);
  dialogueTimer = setTimeout(() => ($("dialogue").hidden = true), 6000);
  if (sound) {
    voicePlayer.pause();
    voicePlayer.src = `/audio/${lang}-${clipIndex}.mp3`;
    voicePlayer
      .play()
      .catch(() => toast("Audio could not play. Subtitles remain available."));
  }
}
function reset() {
  player.position.set(city.spawn[0], 0, city.spawn[1]);
  player.rotation.y = spawnHeading;
  speed = 0;
  running = false;
  yaw = spawnHeading;
  camYaw = spawnHeading;
  orbitYaw = 0;
  camPitch = 0.05;
  walking = false;
  avatar.visible = false;
  vehicle = { mesh: player, kind: "own" };
  toast("Back in Deccan. The evening is yours.");
}
function exitSpot(mesh, side) {
  return [
    mesh.position.x + Math.cos(yaw) * side,
    mesh.position.z - Math.sin(yaw) * side,
  ];
}
function leaveVehicle() {
  if (Math.abs(speed) > 0.8) {
    toast("Stop the car before getting out.");
    return;
  }
  const mesh = vehicle.mesh;
  let spot = exitSpot(mesh, 2.3);
  if (collides(spot[0], spot[1], 0.4)) {
    spot = exitSpot(mesh, -2.3);
    if (collides(spot[0], spot[1], 0.4)) {
      toast("There is no room to exit here.");
      return;
    }
  }
  walking = true;
  running = false;
  avatar.position.set(spot[0], 0, spot[1]);
  avatar.rotation.y = yaw;
  avatar.visible = true;
  camYaw = yaw;
  orbitYaw = 0;
  speed = 0;
  vehicle = null;
  toast("On foot. Shift runs. E enters a nearby car. Q punches. T talks.");
}
function takeVehicle(car) {
  if (car.sim) {
    const index = traffic.indexOf(car.sim);
    if (index >= 0) traffic.splice(index, 1);
    const parkedCar = { mesh: car.mesh, kind: "traffic" };
    parked.push(parkedCar);
    vehicle = parkedCar;
  } else vehicle = { mesh: car.mesh, kind: car.kind };
  walking = false;
  running = false;
  avatar.visible = false;
  yaw = car.mesh.rotation.y;
  orbitYaw = 0;
  camPitch = 0.12;
  speed = 0;
  toast(car.kind === "traffic" ? "You took the wheel." : "Back behind the wheel.");
}
function toggleWalk() {
  if (!walking) {
    leaveVehicle();
    return;
  }
  const car = closestCar();
  if (!car) {
    toast("No car close enough.");
    return;
  }
  takeVehicle(car);
}
function punch() {
  if (!walking) return;
  if (speed < 0.35) {
    yaw = camYaw;
    avatar.rotation.y = yaw;
  }
  avatar.userData.strike = 1;
  const fx = -Math.sin(yaw),
    fz = -Math.cos(yaw);
  let best = null,
    bestD = 1.6;
  for (const ped of pedestrians) {
    const dx = ped.mesh.position.x - avatar.position.x,
      dz = ped.mesh.position.z - avatar.position.z,
      dist = Math.hypot(dx, dz);
    if (dist > bestD || dist < 0.05) continue;
    if ((dx / dist) * fx + (dz / dist) * fz < 0.4) continue;
    best = ped;
    bestD = dist;
  }
  if (!best) return;
  best.stunUntil = elapsed + 2.2;
  best.frozenAt = elapsed;
  best.recoil = best.recoil || new THREE.Vector3();
  best.recoil.x += fx * 1.15;
  best.recoil.z += fz * 1.15;
  toast("They stumble back.");
}
function collides(x, z, r = 1.4) {
  for (const b of obstacles) {
    if (x < b.minX - r || x > b.maxX + r || z < b.minZ - r || z > b.maxZ + r)
      continue;
    if (
      inside(x, z, b.points) ||
      b.points.some(
        (a, i) =>
          segmentDistance(x, z, a, b.points[(i + 1) % b.points.length]) < r,
      )
    )
      return true;
  }
  return false;
}
function startJob() {
  if (job && ["pickup", "delivery"].includes(job.phase)) {
    toast("Finish the current delivery first.");
    return;
  }
  job = createDelivery(city.spawn, city.stops[0].point);
  $("job").textContent = "DABBA RUN ACTIVE";
  toast("Stop near Deccan, get out with E, then press F to collect the dabba.");
}
function interactJob() {
  if (!job) return;
  const result = interactDelivery(
    job,
    [actor().position.x, actor().position.z],
    walking,
  );
  if (result.job.phase === job.phase) {
    toast("Get out and press F within 14 metres of the delivery marker.");
    return;
  }
  job = result.job;
  if (result.paid) {
    wallet += result.paid;
    try {
      localStorage.setItem("pune-wallet", String(wallet));
    } catch {}
    toast("Delivered! ₹450 added to your wallet.");
    $("job").textContent = "REPLAY DABBA RUN · ₹450";
    marker.position.set(
      city.stops[Math.min(targetIndex, 2)].point[0],
      0,
      city.stops[Math.min(targetIndex, 2)].point[1],
    );
  } else toast("Dabba collected. Take it to FC Road before the timer ends.");
}
$("job").onclick = startJob;
function action(key) {
  if (key === "p" && active) {
    paused = !paused;
    toast(paused ? "Paused · press P to resume" : "Back on the road");
  }
  if (paused || !active) return;
  if (key === "e") toggleWalk();
  if (key === "q") punch();
  if (key === "f") interactJob();
  if (key === "j") startJob();
  if (key === "c") {
    view = (view + 1) % 3;
    toast(["Chase camera", "Close camera", "Overhead camera"][view]);
  }
  if (key === "h") honk();
  if (key === "t") talk();
}
window.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "SELECT"].includes(e.target.tagName) ||
    (e.target.tagName === "BUTTON" && [" ", "Enter"].includes(e.key)) ||
    $("instructions").open
  )
    return;
  const k = e.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
    e.preventDefault();
  if (!e.repeat) action(k);
  keys.add(k);
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
renderer.domElement.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || !active || paused || $("instructions").open) return;
  punch();
});
renderer.domElement.addEventListener("click", () => {
  if (navigator.webdriver) return;
  if (document.pointerLockElement !== renderer.domElement)
    renderer.domElement.requestPointerLock();
});
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  const sensitivity = 0.0022;
  camPitch = THREE.MathUtils.clamp(
    camPitch - e.movementY * sensitivity,
    walking ? -0.45 : -0.35,
    walking ? 0.55 : 0.85,
  );
  if (walking) camYaw -= e.movementX * sensitivity;
  else orbitYaw -= e.movementX * sensitivity;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && active) {
    paused = true;
    keys.clear();
    toast("Paused · press P to resume");
  }
});
$("play").onclick = () => {
  active = true;
  document.body.classList.add("playing");
  $("play").blur();
  toast("WASD moves. Click to look. Shift runs. E takes a nearby car.");
};
$("audio").onclick = enableSound;
$("photo").onclick = () => {
  const oldPixelRatio = renderer.getPixelRatio(),
    size = new THREE.Vector2();
  renderer.getSize(size);
  const aspect = camera.aspect;
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(3840, 2160, false);
    camera.aspect = 3840 / 2160;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const link = document.createElement("a");
    link.download = "pune-4k.png";
    link.href = renderer.domElement.toDataURL("image/png");
    link.click();
    toast("Saved 3840 × 2160 scene photo.");
  } finally {
    renderer.setPixelRatio(oldPixelRatio);
    renderer.setSize(size.x, size.y, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
};
$("reset").onclick = reset;
$("help").onclick = () => {
  keys.clear();
  $("instructions").showModal();
};
$("close-help").onclick = $("resume").onclick = () => $("instructions").close();
$("lighting").onclick = () => {
  night = !night;
  $("lighting").textContent = night ? "BLUE HOUR" : "GOLDEN HOUR";
  scene.background.set(night ? 0x526675 : 0xc6c8ac);
  scene.fog.color.copy(scene.background);
  sun.intensity = night ? 0.4 : 3.5;
  hemi.intensity = night ? 1 : 2.3;
};
for (const b of document.querySelectorAll("[data-key]")) {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(b.dataset.key);
  };
  b.onpointerup = b.onpointercancel = () => keys.delete(b.dataset.key);
}
$("map-source").textContent =
  city.source === "OpenStreetMap"
    ? "© OPENSTREETMAP · ODbL"
    : "ILLUSTRATIVE CITY · NOT SURVEYED";
if (city.source === "OpenStreetMap") {
  const link = document.createElement("a");
  link.href = "https://www.openstreetmap.org/copyright";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = $("map-source").textContent;
  link.style.color = "inherit";
  $("map-source").replaceChildren(link);
}
const map = $("map").getContext("2d");
function drawMap() {
  const pos = actor().position;
  map.fillStyle = "#163b33";
  map.fillRect(0, 0, 260, 170);
  const scale = 0.16,
    ox = 130 - pos.x * scale,
    oz = 85 - pos.z * scale;
  map.strokeStyle = "#547467";
  for (const r of city.roads) {
    map.lineWidth = Math.max(1, r.width * scale);
    map.beginPath();
    r.points.forEach((p, i) =>
      i
        ? map.lineTo(ox + p[0] * scale, oz + p[1] * scale)
        : map.moveTo(ox + p[0] * scale, oz + p[1] * scale),
    );
    map.stroke();
  }
  map.fillStyle = "#d8b16b";
  const target = city.stops[Math.min(targetIndex, 2)].point;
  map.beginPath();
  map.arc(
    Math.max(8, Math.min(252, ox + target[0] * scale)),
    Math.max(8, Math.min(162, oz + target[1] * scale)),
    4,
    0,
    Math.PI * 2,
  );
  map.fill();
  map.save();
  map.translate(130, 85);
  map.rotate(-yaw);
  map.fillStyle = "#f2e5b7";
  map.beginPath();
  map.moveTo(0, -7);
  map.lineTo(-5, 6);
  map.lineTo(0, 3);
  map.lineTo(5, 6);
  map.closePath();
  map.fill();
  map.restore();
}
const desiredCamera = new THREE.Vector3(),
  look = new THREE.Vector3();
let frame = 0;
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  const live = active && !paused && !$("instructions").open;
  if (avatar.userData.strike > 0)
    avatar.userData.strike = Math.max(0, avatar.userData.strike - dt / 0.36);
  if (live) {
    elapsed += dt;
    const p = actor().position;
    let nx = p.x,
      nz = p.z;
    if (walking) {
      const forward =
        (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const strafe =
        (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const moving = forward !== 0 || strafe !== 0;
      let mx = 0,
        mz = 0;
      if (moving) {
        const len = Math.hypot(forward, strafe);
        const fx = -Math.sin(camYaw),
          fz = -Math.cos(camYaw),
          rx = Math.cos(camYaw),
          rz = -Math.sin(camYaw);
        mx = fx * (forward / len) + rx * (strafe / len);
        mz = fz * (forward / len) + rz * (strafe / len);
        moveX = mx;
        moveZ = mz;
      }
      running =
        moving &&
        (keys.has("shift") || keys.has("shiftleft") || keys.has("shiftright"));
      const cap = moving ? (running ? 5.4 : 1.75) : 0;
      speed += (cap - speed) * (1 - Math.exp(-dt * (cap > speed ? 8 : 11)));
      if (keys.has(" ")) speed *= Math.exp(-dt * 8);
      nx = p.x + (moving ? mx : moveX) * speed * dt;
      nz = p.z + (moving ? mz : moveZ) * speed * dt;
      if (moving) {
        const face = Math.atan2(-mx, -mz);
        const delta = Math.atan2(Math.sin(face - yaw), Math.cos(face - yaw));
        yaw += delta * (1 - Math.exp(-dt * 12));
      }
    } else {
      running = false;
      const accel =
        (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const steering =
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0) -
        (keys.has("d") || keys.has("arrowright") ? 1 : 0);
      speed += accel * 12 * dt;
      speed *= Math.exp(-dt * (keys.has(" ") ? 5 : accel ? 0.13 : 0.7));
      speed = THREE.MathUtils.clamp(speed, -9, 38);
      if (Math.abs(speed) > 0.15)
        yaw +=
          steering *
          dt *
          Math.min(1.2, Math.abs(speed) * 0.12) *
          Math.sign(speed || 1);
      nx = p.x - Math.sin(yaw) * speed * dt;
      nz = p.z - Math.cos(yaw) * speed * dt;
    }
    const hitTraffic = nearVehicle(
      nx,
      nz,
      walking ? 1.9 : 3,
      walking ? null : vehicle.mesh,
    );
    const hitPed =
      !walking &&
      pedestrians.some(
        (t) => Math.hypot(nx - t.mesh.position.x, nz - t.mesh.position.z) < 1.7,
      );
    if (!collides(nx, nz, walking ? 0.4 : 1.4) && !hitTraffic && !hitPed) {
      p.set(nx, 0, nz);
      distanceTravelled += Math.abs(speed) * dt;
    } else speed *= -0.15;
    actor().rotation.y = yaw;
    const limit = city.source === "illustrative" ? 900 : 6500;
    if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
      reset();
      toast("You reached the edge of this city patch.");
    }
    for (const t of traffic) {
      const old = t.t,
        oldRoad = t.road,
        oldDirection = t.direction;
      t.t += (dt * 8) / t.road.length;
      if (t.t > 1) {
        const endpoint = t.direction === 1 ? t.road.b : t.road.a;
        const exits = (adjacency.get(nodeKey(endpoint)) || []).filter(
          (r) => r !== t.road,
        );
        if (exits.length) {
          t.road = exits[Math.floor(elapsed + t.mesh.id) % exits.length];
          t.direction = nodeKey(t.road.a) === nodeKey(endpoint) ? 1 : -1;
        } else t.direction *= -1;
        t.t = 0;
      }
      const r = t.road,
        dx = (r.b[0] - r.a[0]) / r.length,
        dz = (r.b[1] - r.a[1]) / r.length,
        f = t.direction === 1 ? t.t : 1 - t.t;
      const x = r.a[0] + dx * r.length * f + dz * r.width * 0.22 * t.direction,
        z = r.a[1] + dz * r.length * f - dx * r.width * 0.22 * t.direction;
      if (Math.hypot(x - p.x, z - p.z) < 7 || nearVehicle(x, z, 4.5, t.mesh)) {
        t.t = old;
        t.road = oldRoad;
        t.direction = oldDirection;
        continue;
      }
      t.mesh.position.set(x, 0, z);
      t.mesh.rotation.y = r.angle + (t.direction === 1 ? Math.PI : 0);
    }
    for (const ped of pedestrians) {
      const stunned = (ped.stunUntil || 0) > elapsed;
      const clock = stunned ? ped.frozenAt || elapsed : elapsed;
      const wobble = Math.sin(clock * 0.3 + ped.phase);
      const pace = Math.abs(Math.cos(clock * 0.3 + ped.phase) * 2.4);
      if (!ped.recoil) ped.recoil = new THREE.Vector3();
      if (!stunned) ped.recoil.multiplyScalar(Math.exp(-dt * 2.2));
      ped.mesh.position.set(
        ped.start.x + Math.sin(ped.angle) * wobble * 8 + ped.recoil.x,
        0,
        ped.start.z + Math.cos(ped.angle) * wobble * 8 + ped.recoil.z,
      );
      ped.mesh.rotation.y =
        ped.angle + (Math.cos(clock * 0.3 + ped.phase) > 0 ? Math.PI : 0);
      ped.mesh.rotation.x = stunned ? 0.38 : 0;
      ped.mesh.userData.walk?.(clock + ped.phase, stunned ? 0 : pace);
    }
    if (job && ["pickup", "delivery"].includes(job.phase)) {
      job = tickDelivery(job, dt);
      const point = job.phase === "pickup" ? job.pickup : job.dropoff;
      marker.visible = true;
      marker.position.set(point[0], 0, point[1]);
      $("target").textContent =
        job.phase === "pickup"
          ? "DECCAN · COLLECT DABBA"
          : "FC ROAD · DELIVER DABBA";
      $("distance").textContent =
        `${Math.round(Math.hypot(p.x - point[0], p.z - point[1]))} m`;
      $("job-status").textContent =
        `${Math.ceil(job.remaining)}s · ${job.phase === "pickup" ? "On foot + F to collect" : "On foot + F to deliver"} · Wallet ₹${wallet}`;
      if (job.phase === "failed") {
        $("job").textContent = "RETRY DABBA RUN";
        toast("Delivery timed out. Start again when ready.");
      }
    }
    if (
      targetIndex < 3 &&
      (!job || !["pickup", "delivery"].includes(job.phase))
    ) {
      const t = city.stops[targetIndex];
      const d = Math.hypot(p.x - t.point[0], p.z - t.point[1]);
      $("distance").textContent =
        d > 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
      if (d < 18) {
        targetIndex++;
        if (job && ["pickup", "delivery"].includes(job.phase)) {
          job = tickDelivery(job, dt);
          const point = job.phase === "pickup" ? job.pickup : job.dropoff;
          marker.visible = true;
          marker.position.set(point[0], 0, point[1]);
          $("target").textContent =
            job.phase === "pickup"
              ? "DECCAN · COLLECT DABBA"
              : "FC ROAD · DELIVER DABBA";
          $("distance").textContent =
            `${Math.round(Math.hypot(p.x - point[0], p.z - point[1]))} m`;
          $("job-status").textContent =
            `${Math.ceil(job.remaining)}s · ${job.phase === "pickup" ? "On foot + F to collect" : "On foot + F to deliver"} · Wallet ₹${wallet}`;
          if (job.phase === "failed") {
            $("job").textContent = "RETRY DABBA RUN";
            toast("Delivery timed out. Start again when ready.");
          }
        }
        if (
          targetIndex < 3 &&
          (!job || !["pickup", "delivery"].includes(job.phase))
        ) {
          const next = city.stops[targetIndex];
          marker.position.set(next.point[0], 0, next.point[1]);
          $("target").textContent = next.name;
          $("route").querySelector(".eyebrow span").textContent =
            `0${targetIndex + 1} / 03`;
          toast("Stop reached. On to " + next.name + ".");
        } else {
          marker.visible = false;
          $("mission").textContent =
            "Evening run complete. Keep exploring at your own pace.";
          $("target").textContent = "FREE ROAM";
          $("distance").textContent = "✓";
          toast("Evening run complete. Welcome home.");
        }
      }
    }
  }
  const poseTime = now / 1000;
  avatar.userData.walk?.(poseTime, live && walking ? speed : 0);
  if (!live)
    for (const ped of pedestrians)
      ped.mesh.userData.walk?.(poseTime + ped.phase, 0);
  if (engineGain) {
    engineGain.gain.setTargetAtTime(
      sound && live && !walking ? 0.018 : 0,
      audioContext.currentTime,
      0.1,
    );
    engine.frequency.setTargetAtTime(
      42 + Math.abs(speed) * 4,
      audioContext.currentTime,
      0.1,
    );
  }
  const p = actor().position;
  if (Math.hypot(p.x - buildingCenter.x, p.z - buildingCenter.y) > 300)
    renderBuildings(p.x, p.z);
  if (active) {
    if (walking) {
      const dist = view === 1 ? 2.35 : 3.45;
      const pitch = camPitch;
      const horiz = dist * Math.cos(pitch);
      desiredCamera.set(
        p.x + Math.sin(camYaw) * horiz,
        Math.max(0.55, p.y + 1.45 + Math.sin(pitch) * dist * 0.45),
        p.z + Math.cos(camYaw) * horiz,
      );
      look.set(
        p.x - Math.sin(camYaw) * 1.6,
        p.y + 1.35 + Math.sin(pitch) * 0.35,
        p.z - Math.cos(camYaw) * 1.6,
      );
    } else {
      const back = view === 1 ? 5 : view === 2 ? 18 : 13,
        height = view === 1 ? 3 : view === 2 ? 42 : 7,
        cy = yaw + orbitYaw,
        pitch = camPitch,
        horiz = back * Math.cos(pitch * 0.45);
      desiredCamera.set(
        p.x + Math.sin(cy) * horiz,
        p.y + height + Math.sin(pitch) * 3,
        p.z + Math.cos(cy) * horiz,
      );
      look.set(p.x - Math.sin(cy) * 6, 1.35, p.z - Math.cos(cy) * 6);
    }
  } else {
    const t = performance.now() * 0.000025;
    desiredCamera.set(90 + Math.sin(t) * 70, 60, 185 + Math.cos(t) * 45);
    look.set(0, 3, -120);
  }
  camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 4));
  camera.lookAt(look);
  sun.position.set(p.x - 170, 240, p.z + 80);
  sun.target.position.set(p.x, 0, p.z);
  sun.target.updateMatrixWorld();
  marker.rotation.y += dt * 0.3;
  if (frame++ % 4 === 0) {
    drawMap();
    $("speed").textContent = String(Math.round(Math.abs(speed) * 3.6)).padStart(
      2,
      "0",
    );
    $("speed-bar").style.width =
      Math.min(100, (Math.abs(speed) / 38) * 100) + "%";
    $("gear").textContent = speed < -0.2 ? "R" : speed > 0.2 ? "D" : "N";
    $("mode").textContent = walking
      ? running
        ? "ON FOOT / RUN"
        : "ON FOOT / WALK"
      : vehicle?.kind === "traffic"
        ? "BORROWED / STREET"
        : "COMPACT / STREET";
    const nearest = city.stops.reduce((a, b) =>
      Math.hypot(p.x - a.point[0], p.z - a.point[1]) <
      Math.hypot(p.x - b.point[0], p.z - b.point[1])
        ? a
        : b,
    );
    $("district").textContent = nearest.name;
    if (city.source === "OpenStreetMap")
      document.querySelector(".location small").textContent =
        `${(origin.lat - p.z / 111320).toFixed(4)}° N · ${(origin.lon + p.x / 105500).toFixed(4)}° E`;
  }
  renderer.render(scene, camera);
}
camera.position.set(150, 65, 230);
animate();
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
// Read-only diagnostics for smoke tests and performance inspection.
window.__pune = {
  get state() {
    return {
      active,
      paused,
      walking,
      onFoot: walking,
      running,
      vehicle: walking ? "foot" : vehicle?.kind || "own",
      speed,
      x: actor().position.x,
      z: actor().position.z,
      distanceTravelled,
      mapSource: city.source,
      targetIndex,
      drawCalls: renderer.info.render.calls,
      roads: city.roads.length,
      buildings: city.buildings.length,
      detailedHumans,
      humanHeight: new THREE.Box3()
        .setFromObject(avatar)
        .getSize(new THREE.Vector3()).y,
      voiceTime: voicePlayer.currentTime,
      voiceReady: voicePlayer.readyState,
      job: job?.phase || "idle",
      wallet,
      voiceLocale: $("language").value,
      nearbyBuildingBatches: buildingGroup.children.length,
    };
  },
};
