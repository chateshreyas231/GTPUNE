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
  makeVehicle,
  vehicleSpec,
  person,
  origin,
  roadTitle,
  roadUnder,
  buildingLook,
  PLASTER,
  GLASS_PLASTER,
  frontageName,
  isShopFront,
  mapPlaces,
  rollVehicle,
  mulberry32,
  nodeKey,
  SHOP_BOARDS,
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
    roadSegments.push({
      a,
      b,
      width: road.width,
      length,
      angle,
      name: road.name || "",
      altName: road.altName || "",
    });
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

function facade(base, glass) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 18; y < 512; y += 128) {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, y + 102, 512, 8);
    for (let x = 24; x < 512; x += 128) {
      ctx.fillStyle = "#243033";
      ctx.fillRect(x - 4, y - 4, 72, 88);
      ctx.fillStyle = glass;
      ctx.fillRect(x, y, 64, 78);
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fillRect(x + 4, y + 4, 22, 66);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const plasterTex = facade("#f6f3ec", "#7f96a0");
const glassTex = facade("#d7e4ea", "#8eb6c8");
const plasterMats = new Map(
  [...Object.values(PLASTER), GLASS_PLASTER].map((hex) => [
    hex,
    new THREE.MeshStandardMaterial({
      color: hex,
      map: hex === GLASS_PLASTER ? glassTex : plasterTex,
      roughness: hex === GLASS_PLASTER ? 0.22 : 0.94,
      metalness: hex === GLASS_PLASTER ? 0.55 : 0.02,
    }),
  ]),
);
const bandMats = new Map(
  [0x7c2f3b, 0x1f6b4a, 0x1d4f88, 0xc4892b].map((hex) => [
    hex,
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.78 }),
  ]),
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
const signGroup = new THREE.Group();
scene.add(signGroup);
const places = mapPlaces(city.buildings);
const signTextures = new Map();
const BAND_CSS = {
  0x7c2f3b: "#7c2f3b",
  0x1f6b4a: "#1f6b4a",
  0x1d4f88: "#1d4f88",
  0xc4892b: "#c4892b",
};
let buildingCenter = new THREE.Vector2(Infinity, Infinity);
let signCenter = new THREE.Vector2(Infinity, Infinity);
let detailGroup;
function boardTexture(text, css) {
  const key = css + ":" + text;
  if (signTextures.has(key)) return signTextures.get(key);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#f8f1df";
  ctx.font = "bold 44px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.length > 22 ? text.slice(0, 21) + "…" : text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  signTextures.set(key, tex);
  return tex;
}
function extrudeFootprint(points, height) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], -points[0][1]);
  for (const pt of points.slice(1)) shape.lineTo(pt[0], -pt[1]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 10, uv.getY(i) / 12);
  return geo;
}
function shopSpot(b) {
  const x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2;
  let best = null, bestD = 36;
  for (const r of roadSegments) {
    if (Math.abs(r.a[0] - x) > 90 && Math.abs(r.b[0] - x) > 90) continue;
    if (Math.abs(r.a[1] - z) > 90 && Math.abs(r.b[1] - z) > 90) continue;
    const dist = segmentDistance(x, z, r.a, r.b);
    if (dist < bestD) { bestD = dist; best = r; }
  }
  if (!best) return null;
  const dx = best.b[0] - best.a[0], dz = best.b[1] - best.a[1], len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - best.a[0]) * dx + (z - best.a[1]) * dz) / len2));
  const qx = best.a[0] + dx * t, qz = best.a[1] + dz * t;
  const toRoadX = qx - x, toRoadZ = qz - z, vlen = Math.hypot(toRoadX, toRoadZ) || 1;
  let sx = x, sz = z, walked = 0;
  while (walked < 80 && sx >= b.minX && sx <= b.maxX && sz >= b.minZ && sz <= b.maxZ) {
    walked += 0.5;
    sx = x + (toRoadX / vlen) * walked;
    sz = z + (toRoadZ / vlen) * walked;
  }
  sx += (toRoadX / vlen) * 1.2;
  sz += (toRoadZ / vlen) * 1.2;
  return { x: sx, z: sz, angle: Math.atan2(toRoadX, toRoadZ) + Math.PI / 2 };
}
function refreshSigns(cx, cz) {
  for (const mesh of [...signGroup.children]) {
    mesh.geometry.dispose();
    mesh.material.dispose();
    signGroup.remove(mesh);
  }
  const near = [];
  for (const b of obstacles) {
    const dist = Math.hypot((b.minX + b.maxX) / 2 - cx, (b.minZ + b.maxZ) / 2 - cz);
    if (dist > 140) continue;
    const named = Boolean(b.name);
    if (!named && !isShopFront(b)) continue;
    let score = dist;
    if (b.shop === "mall" || /mall|college|hospital/i.test(b.name || "")) score -= 25;
    else if (named) score -= 10;
    near.push({ b, score, label: named ? b.name : frontageName(b) });
  }
  near.sort((a, c) => a.score - c.score);
  for (const item of near.slice(0, 18)) {
    const spot = shopSpot(item.b);
    if (!spot) continue;
    const look = buildingLook(item.b);
    const tex = boardTexture(item.label, BAND_CSS[look.band] || "#7c2f3b");
    const width = Math.min(16, 4 + item.label.length * 0.42);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width / 4),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }),
    );
    mesh.position.set(spot.x, 3.1, spot.z);
    mesh.rotation.y = spot.angle;
    mesh.name = item.label;
    signGroup.add(mesh);
  }
  signCenter.set(cx, cz);
}
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
    const look = buildingLook(b);
    const bandH = Math.min(3.3, Math.max(2.2, b.height * 0.34));
    const upperH = Math.max(0.6, b.height - bandH);
    const upperMat = plasterMats.get(look.plaster) || plasterMats.get(GLASS_PLASTER);
    const bandMat = bandMats.get(look.band);
    const upper = new THREE.Mesh(extrudeFootprint(b.points, upperH), [roofMat, upperMat]);
    upper.position.y = bandH;
    upper.castShadow = true;
    upper.receiveShadow = true;
    buildingGroup.add(upper);
    const band = new THREE.Mesh(extrudeFootprint(b.points, bandH), [bandMat, bandMat]);
    band.castShadow = true;
    band.receiveShadow = true;
    buildingGroup.add(band);
  }
  mergeStatic(buildingGroup);
  refreshSigns(cx, cz);
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
const shopNames = SHOP_BOARDS.slice(0, 9).map((board) => board.name);
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
for (const r of roadSegments)
  for (const end of [r.a, r.b]) {
    const key = nodeKey(end);
    if (!adjacency.has(key)) adjacency.set(key, []);
    adjacency.get(key).push(r);
  }
const traffic = [];
const driveable = roadSegments.filter((r) => r.length > 45);
const trafficRoads = driveable.length ? driveable : roadSegments;
const trafficTarget = Math.min(96, Math.max(48, trafficRoads.length));
function vehicleRadius(kind) {
  if (kind === "bus") return 4.4;
  if (kind === "bike") return 1.2;
  if (kind === "auto") return 1.9;
  return 2.3;
}
function vehiclePoint(t) {
  const r = t.segment, len = r.length || 1;
  const dx = (r.b[0] - r.a[0]) / len, dz = (r.b[1] - r.a[1]) / len;
  const side = t.kind === "bus" ? 0.12 : t.kind === "bike" ? 0.34 : t.kind === "auto" ? 0.26 : 0.2;
  return {
    x: r.a[0] + (r.b[0] - r.a[0]) * t.s + dz * r.width * side * t.direction,
    z: r.a[1] + (r.b[1] - r.a[1]) * t.s - dx * r.width * side * t.direction,
    angle: r.angle + (t.direction === 1 ? Math.PI : 0),
  };
}
const nearbyTraffic = trafficRoads
  .map((r) => ({
    r,
    d: Math.hypot((r.a[0] + r.b[0]) / 2 - city.spawn[0], (r.a[1] + r.b[1]) / 2 - city.spawn[1]),
  }))
  .filter((item) => item.d < 180)
  .sort((a, b) => a.d - b.d)
  .slice(0, 12)
  .map((item) => item.r);
const spawnAlong = (() => {
  const dx = spawnRoad.b[0] - spawnRoad.a[0], dz = spawnRoad.b[1] - spawnRoad.a[1];
  return Math.max(0, Math.min(1, ((city.spawn[0] - spawnRoad.a[0]) * dx + (city.spawn[1] - spawnRoad.a[1]) * dz) / (dx * dx + dz * dz || 1)));
})();
for (let i = 0; i < trafficTarget; i++) {
  const spec = vehicleSpec(i);
  const lead = i < 8 && (spec.kind === "bus" || spec.kind === "auto");
  const ahead = spawnAlong > 0.35;
  const r = lead
    ? spawnRoad
    : i < 24 && nearbyTraffic.length
      ? nearbyTraffic[i % nearbyTraffic.length]
      : trafficRoads[(i * 97) % trafficRoads.length];
  const mesh = makeVehicle(spec);
  const actorState = {
    mesh,
    segment: r,
    s: lead
      ? (ahead
        ? Math.max(0.02, spawnAlong - (spec.kind === "bus" ? 28 : 14) / spawnRoad.length)
        : Math.min(0.98, spawnAlong + (spec.kind === "bus" ? 28 : 14) / spawnRoad.length))
      : (i * 0.137) % 1,
    direction: lead ? (ahead ? -1 : 1) : i % 2 ? 1 : -1,
    speed: spec.kind === "bike" ? 11 : spec.kind === "bus" ? 7 : spec.kind === "auto" ? 8 : 9,
    kind: spec.kind, label: spec.label, board: spec.board, livery: spec.livery, route: spec.route,
    goal: null, trip: null, cursor: 0, rng: mulberry32(4000 + i * 17), minLength: 90, minGoal: 160,
  };
  const spot = vehiclePoint(actorState);
  mesh.position.set(spot.x, 0, spot.z);
  mesh.rotation.y = spot.angle;
  scene.add(mesh);
  traffic.push(actorState);
}
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
  speed = 0,
  yaw = spawnHeading,
  view = 0,
  sound = false,
  night = false,
  elapsed = 0,
  distanceTravelled = 0;
const keys = new Set();
let previousTime = performance.now();
let audioContext, engine, engineGain, toastTimer;
const voicePlayer = new Audio();
voicePlayer.volume = 0.9;
const actor = () => (walking ? avatar : player);
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
  const nearbyPed = pedestrians.find(
    (p) => p.mesh.position.distanceTo(actor().position) < 22,
  );
  if (!nearbyPed) {
    toast("Get within 22 metres of a pedestrian to talk.");
    return;
  }
  const lang = $("language").value,
    clipIndex = talkIndex++ % 3,
    text = lines[lang][clipIndex];
  $("dialogue").replaceChildren();
  const label = document.createElement("small");
  const who = nearbyPed.mesh.userData;
  label.textContent = `${who.name || "NEIGHBOUR"} · ${who.role || "शेजारी"}`;
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
  speed = 0;
  yaw = spawnHeading;
  walking = false;
  avatar.visible = false;
  player.rotation.y = spawnHeading;
  toast("Back in Deccan. The evening is yours.");
}
function toggleWalk() {
  if (Math.abs(speed) > 1) {
    toast("Stop the car before getting out.");
    return;
  }
  if (walking) {
    if (avatar.position.distanceTo(player.position) > 7) {
      toast("Walk back to your car to get in.");
      return;
    }
    walking = false;
    avatar.visible = false;
    yaw = player.rotation.y;
  } else {
    const p = player.position
      .clone()
      .add(new THREE.Vector3(Math.cos(yaw) * 3, 0, -Math.sin(yaw) * 3));
    if (collides(p.x, p.z, 0.4)) {
      toast("There is no room to exit here.");
      return;
    }
    walking = true;
    avatar.position.copy(p);
    avatar.visible = true;
  }
  speed = 0;
  toast(
    walking
      ? "On foot. Press T near a neighbour to talk."
      : "Back behind the wheel.",
  );
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
  toast("WASD to drive · E to walk · T to talk");
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
const mapCanvas = $("map");
const map = mapCanvas.getContext("2d");
const mapLayers = {
  roads: true,
  buildings: true,
  traffic: true,
  people: true,
  places: true,
};
let mapZoom = 1;
let mapSize = "dock";
try {
  const savedLayers = JSON.parse(localStorage.getItem("pune-map-layers") || "{}");
  Object.assign(mapLayers, savedLayers);
  mapZoom = Number(localStorage.getItem("pune-map-zoom")) || 1;
  mapSize = localStorage.getItem("pune-map-size") || "dock";
} catch {}
mapZoom = Math.min(4, Math.max(0.45, mapZoom));
for (const name of Object.keys(mapLayers)) {
  const box = $(`layer-${name}`);
  if (box) box.checked = mapLayers[name] !== false;
}
function saveMap() {
  try {
    localStorage.setItem("pune-map-layers", JSON.stringify(mapLayers));
    localStorage.setItem("pune-map-zoom", String(mapZoom));
    localStorage.setItem("pune-map-size", mapSize);
  } catch {}
}
function applyMapSize() {
  const panel = $("map-panel");
  panel.classList.toggle("is-min", mapSize === "min");
  panel.classList.toggle("is-max", mapSize === "max");
  $("map-size").textContent = mapSize === "max" ? "DOCK" : "EXPAND";
  $("map-min").textContent = mapSize === "min" ? "MAP" : "MIN";
  requestAnimationFrame(resizeMap);
}
function resizeMap() {
  if (mapSize === "min") return;
  const rect = mapCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  mapCanvas.width = Math.max(280, Math.floor(rect.width * dpr));
  mapCanvas.height = Math.max(160, Math.floor(rect.height * dpr));
}
$("map-zoom-in").onclick = () => {
  mapZoom = Math.min(4, mapZoom * 1.25);
  saveMap();
};
$("map-zoom-out").onclick = () => {
  mapZoom = Math.max(0.45, mapZoom / 1.25);
  saveMap();
};
$("map-size").onclick = () => {
  mapSize = mapSize === "max" ? "dock" : "max";
  applyMapSize();
  saveMap();
};
$("map-min").onclick = () => {
  mapSize = mapSize === "min" ? "dock" : "min";
  applyMapSize();
  saveMap();
};
for (const name of Object.keys(mapLayers)) {
  const box = $(`layer-${name}`);
  if (!box) continue;
  box.onchange = () => {
    mapLayers[name] = box.checked;
    saveMap();
  };
}
applyMapSize();
window.addEventListener("resize", resizeMap);
function drawMap() {
  if (mapSize === "min") return;
  const w = mapCanvas.width;
  const h = mapCanvas.height;
  const pos = actor().position;
  map.setTransform(1, 0, 0, 1, 0, 0);
  map.fillStyle = "#163b33";
  map.fillRect(0, 0, w, h);
  const scale = (mapSize === "max" ? 0.28 : 0.18) * mapZoom * (w / 520);
  const ox = w / 2 - pos.x * scale;
  const oz = h / 2 - pos.z * scale;
  const reach = Math.hypot(w, h) / scale + 80;
  const sx = (x) => ox + x * scale;
  const sy = (z) => oz + z * scale;
  const visible = (x, z) => {
    const px = sx(x);
    const py = sy(z);
    return px > -30 && py > -30 && px < w + 30 && py < h + 30;
  };
  if (mapLayers.buildings) {
    map.fillStyle = "rgba(214, 206, 176, 0.28)";
    for (const b of city.buildings) {
      const p0 = b.points[0];
      if (Math.abs(p0[0] - pos.x) > reach || Math.abs(p0[1] - pos.z) > reach)
        continue;
      map.beginPath();
      b.points.forEach((p, i) =>
        i ? map.lineTo(sx(p[0]), sy(p[1])) : map.moveTo(sx(p[0]), sy(p[1])),
      );
      map.closePath();
      map.fill();
    }
  }
  if (mapLayers.roads) {
    map.strokeStyle = "#6d8f7c";
    map.lineCap = "round";
    const viewMinX = pos.x - reach;
    const viewMaxX = pos.x + reach;
    const viewMinZ = pos.z - reach;
    const viewMaxZ = pos.z + reach;
    for (const r of city.roads) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of r.points) {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[1]);
        maxZ = Math.max(maxZ, p[1]);
      }
      if (maxX < viewMinX || minX > viewMaxX || maxZ < viewMinZ || minZ > viewMaxZ)
        continue;
      map.lineWidth = Math.max(1.2, r.width * scale * 0.35);
      map.beginPath();
      r.points.forEach((p, i) =>
        i ? map.lineTo(sx(p[0]), sy(p[1])) : map.moveTo(sx(p[0]), sy(p[1])),
      );
      map.stroke();
    }
    const usedLabels = [];
    for (const r of city.roads) {
      const title = roadTitle(r);
      if (!title || r.points.length < 2) continue;
      let best = null, bestPx = 0;
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1], b = r.points[i];
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        if (Math.abs(mx - pos.x) > reach || Math.abs(mz - pos.z) > reach) continue;
        const px = Math.hypot(sx(b[0]) - sx(a[0]), sy(b[1]) - sy(a[1]));
        if (px > bestPx) { bestPx = px; best = [a, b]; }
      }
      if (!best || bestPx < 70) continue;
      const lx = sx((best[0][0] + best[1][0]) / 2), ly = sy((best[0][1] + best[1][1]) / 2);
      if (usedLabels.some((item) => item.title === title && Math.hypot(item.x - lx, item.y - ly) < 110)) continue;
      usedLabels.push({ title, x: lx, y: ly });
      let angle = Math.atan2(sy(best[1][1]) - sy(best[0][1]), sx(best[1][0]) - sx(best[0][0]));
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
      map.save();
      map.translate(lx, ly);
      map.rotate(angle);
      map.fillStyle = "#e7f6ee";
      map.font = `${Math.max(11, Math.min(16, w / 46))}px sans-serif`;
      map.textAlign = "center";
      map.fillText(title, 0, -4);
      map.restore();
    }
  }
  if (mapLayers.traffic) {
    for (const t of traffic) {
      const x = t.mesh.position.x, z = t.mesh.position.z;
      if (!visible(x, z)) continue;
      const kind = t.kind || "car";
      map.fillStyle = kind === "auto" ? "#f0c31a" : kind === "bike" ? "#49b6d6" : kind === "bus" ? (t.livery === "purple" ? "#7a5aaa" : "#d24b58") : "#f4f7f2";
      const rw = kind === "bus" ? 11 : kind === "bike" ? 4 : kind === "auto" ? 6 : 7;
      const rh = kind === "bus" ? 4.2 : kind === "bike" ? 2.2 : 3.4;
      map.save();
      map.translate(sx(x), sy(z));
      map.rotate(-t.mesh.rotation.y);
      map.fillRect(-rw / 2, -rh / 2, rw, rh);
      if (mapSize === "max" && kind === "bus") {
        map.fillStyle = "#10211c";
        map.font = "9px sans-serif";
        map.textAlign = "center";
        map.fillText(t.board || "Bus", 0, 12);
      }
      map.restore();
    }
  }
  if (walking) {
    map.save();
    map.translate(sx(player.position.x), sy(player.position.z));
    map.fillStyle = "#c4b48a";
    map.fillRect(-4, -2.5, 8, 5);
    map.restore();
  }
  if (mapLayers.people) {
    map.fillStyle = "#7dcea0";
    const namedPeople = [];
    for (const person of pedestrians) {
      const x = person.mesh.position.x, z = person.mesh.position.z;
      if (!visible(x, z)) continue;
      map.beginPath();
      map.arc(sx(x), sy(z), 2.4, 0, Math.PI * 2);
      map.fill();
      const d = Math.hypot(x - pos.x, z - pos.z);
      if (d < 80) namedPeople.push({ person, d, x, z });
    }
    namedPeople.sort((a, b) => a.d - b.d);
    map.fillStyle = "#f6f3e6";
    map.font = `${Math.max(10, w / 58)}px sans-serif`;
    map.textAlign = "left";
    for (const item of namedPeople.slice(0, 8)) {
      const label = item.person.mesh.userData.label || item.person.mesh.userData.name;
      if (label) map.fillText(label, sx(item.x) + 5, sy(item.z) - 4);
    }
  }
  if (mapLayers.places) {
    city.stops.forEach((stop, index) => {
      const current = index === Math.min(targetIndex, city.stops.length - 1);
      map.fillStyle = current ? "#edbd6d" : "#8d7350";
      map.beginPath();
      map.arc(sx(stop.point[0]), sy(stop.point[1]), current ? 6 : 4, 0, Math.PI * 2);
      map.fill();
      if (mapSize === "max" || current) {
        map.fillStyle = "#f6f3e6";
        map.font = `${Math.max(11, w / 48)}px sans-serif`;
        map.textAlign = "left";
        map.fillText(stop.name, sx(stop.point[0]) + 8, sy(stop.point[1]) - 6);
      }
    });
    const visiblePlaces = [];
    for (const place of places) {
      if (!visible(place.point[0], place.point[1])) continue;
      visiblePlaces.push({
        place,
        d: Math.hypot(place.point[0] - pos.x, place.point[1] - pos.z),
      });
    }
    visiblePlaces.sort((a, b) => Number(b.place.named) - Number(a.place.named) || a.d - b.d);
    for (const item of visiblePlaces.slice(0, 40)) {
      map.fillStyle = item.place.named ? "#edbd6d" : "#d98b4a";
      map.beginPath();
      map.arc(sx(item.place.point[0]), sy(item.place.point[1]), item.place.named ? 3.5 : 2.2, 0, Math.PI * 2);
      map.fill();
    }
    map.fillStyle = "#f6f3e6";
    map.font = `${Math.max(10, w / 55)}px sans-serif`;
    map.textAlign = "left";
    for (const item of visiblePlaces.slice(0, mapSize === "max" ? 16 : 8))
      map.fillText(item.place.name, sx(item.place.point[0]) + 6, sy(item.place.point[1]) - 4);
  }
  map.fillStyle = "rgba(246, 243, 230, 0.85)";
  map.font = `${Math.max(12, w / 40)}px sans-serif`;
  map.fillText("N", w / 2 - 4, 18);
  map.save();
  map.translate(w / 2, h / 2);
  map.rotate(-yaw);
  map.fillStyle = "#f2e5b7";
  map.beginPath();
  map.moveTo(0, -9);
  map.lineTo(-6, 7);
  map.lineTo(0, 3);
  map.lineTo(6, 7);
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
  const running = active && !paused && !$("instructions").open;
  if (running) {
    elapsed += dt;
    const accel =
      (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
      (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    const steering =
      (keys.has("a") || keys.has("arrowleft") ? 1 : 0) -
      (keys.has("d") || keys.has("arrowright") ? 1 : 0);
    speed += accel * (walking ? 9 : 12) * dt;
    speed *= Math.exp(
      -dt * (keys.has(" ") ? 5 : accel ? 0.13 : walking ? 6 : 0.7),
    );
    speed = THREE.MathUtils.clamp(speed, walking ? -2 : -9, walking ? 5 : 38);
    if (walking || Math.abs(speed) > 0.15)
      yaw +=
        steering *
        dt *
        (walking ? 2.4 : Math.min(1.2, Math.abs(speed) * 0.12)) *
        Math.sign(speed || 1);
    const p = actor().position,
      nx = p.x - Math.sin(yaw) * speed * dt,
      nz = p.z - Math.cos(yaw) * speed * dt;
    const hitTraffic = traffic.some(
      (t) =>
        Math.hypot(nx - t.mesh.position.x, nz - t.mesh.position.z) <
        (walking ? 1.8 : 3),
    );
    const hitPed =
      !walking &&
      pedestrians.some(
        (t) => Math.hypot(nx - t.mesh.position.x, nz - t.mesh.position.z) < 1.7,
      );
    if (!collides(nx, nz, walking ? 0.4 : 1.4) && !hitTraffic && !hitPed) {
      p.set(nx, 0, nz);
      distanceTravelled += Math.abs(speed) * dt;
    } else {
      speed = -speed * 0.15;
    }
    actor().rotation.y = yaw;
    if (walking)
      avatar.userData.walk?.(elapsed, Math.min(1, Math.abs(speed) / 2));
    const limit = city.source === "illustrative" ? 900 : 6500;
    if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
      reset();
      toast("You reached the edge of this city patch.");
    }
    for (const t of traffic) {
      const next = rollVehicle(t, dt, adjacency, trafficRoads, t.rng);
      const spot = vehiclePoint(next);
      const gap = vehicleRadius(t.kind);
      if (
        Math.hypot(spot.x - p.x, spot.z - p.z) < gap + (walking ? 1.2 : 2.2) ||
        traffic.some(
          (other) =>
            other !== t &&
            Math.hypot(spot.x - other.mesh.position.x, spot.z - other.mesh.position.z) <
              gap + vehicleRadius(other.kind),
        )
      )
        continue;
      Object.assign(t, next);
      t.mesh.position.set(spot.x, 0, spot.z);
      t.mesh.rotation.y = spot.angle;
    }
    for (const p of pedestrians) {
      p.mesh.position.copy(p.start);
      p.mesh.position.x +=
        Math.sin(p.angle) * Math.sin(elapsed * 0.3 + p.phase) * 8;
      p.mesh.position.z +=
        Math.cos(p.angle) * Math.sin(elapsed * 0.3 + p.phase) * 8;
      p.mesh.userData.walk?.(elapsed + p.phase, 0.8);
      p.mesh.rotation.y =
        p.angle + (Math.cos(elapsed * 0.3 + p.phase) > 0 ? Math.PI : 0);
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
  if (engineGain) {
    engineGain.gain.setTargetAtTime(
      sound && running && !walking ? 0.018 : 0,
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
    const back = view === 1 ? 5 : view === 2 ? 18 : 13,
      height = view === 1 ? 3 : view === 2 ? 42 : 7;
    desiredCamera.set(
      p.x + Math.sin(yaw) * back,
      p.y + (walking ? height * 0.65 : height),
      p.z + Math.cos(yaw) * back,
    );
    look.set(p.x - Math.sin(yaw) * 8, 1.5, p.z - Math.cos(yaw) * 8);
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
    $("mode").textContent = walking ? "ON FOOT / EXPLORE" : "COMPACT / STREET";
    const nearest = city.stops.reduce((a, b) =>
      Math.hypot(p.x - a.point[0], p.z - a.point[1]) <
      Math.hypot(p.x - b.point[0], p.z - b.point[1])
        ? a
        : b,
    );
    const roadName = roadUnder(p.x, p.z, roadSegments);
    $("district").textContent = roadName || nearest.name;
    let closePerson = null, closeD = 14;
    for (const ped of pedestrians) {
      const d = Math.hypot(p.x - ped.mesh.position.x, p.z - ped.mesh.position.z);
      if (d < closeD) { closeD = d; closePerson = ped; }
    }
    $("nearby").textContent = closePerson
      ? `${closePerson.mesh.userData.name || "Neighbour"} · ${closePerson.mesh.userData.role || "neighbour"}`
      : "";
    if (Math.hypot(p.x - signCenter.x, p.z - signCenter.y) > 40) refreshSigns(p.x, p.z);
    if (city.source === "OpenStreetMap")
      $("coords").textContent = `${(origin.lat - p.z / 111320).toFixed(4)}° N · ${(origin.lon + p.x / 105500).toFixed(4)}° E`;
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
      roadName: $("district").textContent,
      nearbyPerson: $("nearby").textContent,
      vehicleKinds: [...new Set(traffic.map((t) => t.kind))],
      buses: traffic.filter((t) => t.kind === "bus").length,
      autos: traffic.filter((t) => t.kind === "auto").length,
      bikes: traffic.filter((t) => t.kind === "bike").length,
      places: places.length,
      signs: signGroup.children.map((mesh) => mesh.name),
    };
  },
};
