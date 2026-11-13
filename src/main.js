import { createDelivery, tickDelivery, interactDelivery } from "./delivery.js";
import { streetDetails, swayCanopies, laneMarking } from "./street-details.js";
import { loadSurfacePhotos, hydrateResidents, prepareLooks, applyLook } from "./visual-assets.js";
import { cycleLook, defaultLook, lookById } from "./characters.js";
import { lines } from "./dialogue.js";
import { CINEMATIC, createCinematicComposer, thirdPersonRig } from "./cinematic.js";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import "./style.css";
import {
  fallbackCity,
  parseOSM,
  segmentDistance,
  inside,
  person,
  origin,
  STOREY_METERS,
  splitRoadsAtJunctions,
  roadAdjacency,
  planTrip,
  tripPolyline,
  advanceAlong,
  chooseGoal,
  laneLateral,
  sidewalkLateral,
  segmentPoint,
  mulberry32,
  STREET_FLEET,
  fleetBody,
  makeVehicle,
  makeArmoredCarrier,
  VEHICLE_TONES,
  SIREN_TONES,
  distanceGain,
  nearestCar,
  BODY_LABELS,
  CITY_SERVICES,
  ROUND_SPEED,
  officerProfile,
  junkieProfile,
  serviceFleet,
  serviceSpeed,
  serviceLateral,
  sirenFrequency,
  beaconLit,
  applyWander,
  passage,
  serviceMapColor,
  personMapColor,
  orbitLook,
  footLookActive,
  footPace,
  beginJump,
  roadTitle,
  roadUnder,
  buildingLook,
  frontageName,
  isShopFront,
  PLASTER,
  GLASS_PLASTER,
  SHOP_BANDS,
} from "./city.js";
import {
  CHEAT_WORDS,
  emptyLoadout,
  faceYaw,
  grantWeapon,
  healthLabel,
  nearestReply,
  nextStreetWeapon,
  parkBeside,
  readCheat,
  refillHealth,
  selectSlot,
  selectedWeapon,
} from "./street-fight.js";
import {
  applyImpact,
  applyStrike,
  blocksMove,
  bodyRadius,
  crashFromImpact,
  deathStain,
  pickupWeapon,
  resumeWalking,
  strikeHit,
} from "./harm.js";
import {
  blocksDriving,
  clampZoom,
  createMapView,
  mapScale,
  panByPixels,
  recenter,
  sizeLabels,
  toggleExpand,
  toggleMin,
  viewCenter,
  wheelZoomFactor,
  zoomBy,
} from "./map-view.js";
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
scene.background = new THREE.Color(0xd4d2bc);
scene.fog = new THREE.FogExp2(0xd4d2bc, 0.00105);
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
renderer.toneMappingExposure = 0.96;
const camera = new THREE.PerspectiveCamera(
  CINEMATIC.fov,
  innerWidth / innerHeight,
  0.2,
  6000,
);
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(3200, 20, 12),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0xf6f3e6) },
      horizon: { value: new THREE.Color(0xcfcbb6) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 top;
      uniform vec3 horizon;
      void main() {
        float h = clamp(vDir.y * 0.85 + 0.12, 0.0, 1.0);
        vec3 color = mix(horizon, top, smoothstep(0.0, 0.7, h));
        color += vec3(0.22, 0.16, 0.06) * smoothstep(0.45, 1.0, h);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }),
);
sky.frustumCulled = false;
scene.add(sky);
const composer = createCinematicComposer(renderer, scene, camera);
const hemi = new THREE.HemisphereLight(0xe7ecde, 0x676956, 2.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd59b, 2.5);
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
  mark: material(0xf4f4ee),
  edge: material(0xd6b43a),
  trunk: material(0x6e5c42),
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
      sidewalk: road.sidewalk ?? 1.6,
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
      sidewalk = r.sidewalk ?? 1.6,
      x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2;
    box(
      width + sidewalk * 2,
      0.2,
      length,
      mats.walk,
      x,
      0,
      z,
      roadGroup,
    ).rotation.y = angle;
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
    const dx = (b[0] - a[0]) / length,
      dz = (b[1] - a[1]) / length,
      px = dz,
      pz = -dx,
      inset = Math.max(0.35, width / 2 - 0.22);
    const marks = laneMarking(length);
    for (const edge of marks.edges) {
      const line = box(
        0.14,
        0.03,
        length,
        mats.edge,
        x + px * inset * edge.side,
        0.21,
        z + pz * inset * edge.side,
        roadGroup,
      );
      line.rotation.y = angle;
      line.name = "lane-edge";
    }
    for (const dash of marks.dashes)
      box(
        0.16,
        0.03,
        dash.length,
        mats.mark,
        a[0] + dx * dash.t,
        0.22,
        a[1] + dz * dash.t,
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
const plasterMats = new Map(
  [...Object.values(PLASTER), GLASS_PLASTER].map((hex) => [
    hex,
    new THREE.MeshStandardMaterial({
      color: hex,
      map: facadeTex,
      roughness: hex === GLASS_PLASTER ? 0.28 : 0.94,
      metalness: hex === GLASS_PLASTER ? 0.35 : 0.02,
    }),
  ]),
);
const bandMats = new Map(
  SHOP_BANDS.map((hex) => [
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
const signTextures = new Map();
const BAND_CSS = {
  0x7c2f3b: "#7c2f3b",
  0x1f6b4a: "#1f6b4a",
  0x1d4f88: "#1d4f88",
  0xc4892b: "#c4892b",
};
let buildingCenter = new THREE.Vector2(Infinity, Infinity);
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
function shopSpot(b) {
  const x = (b.minX + b.maxX) / 2,
    z = (b.minZ + b.maxZ) / 2;
  let best = null,
    bestD = 36;
  for (const r of roadSegments) {
    if (Math.abs(r.a[0] - x) > 90 && Math.abs(r.b[0] - x) > 90) continue;
    if (Math.abs(r.a[1] - z) > 90 && Math.abs(r.b[1] - z) > 90) continue;
    const dist = segmentDistance(x, z, r.a, r.b);
    if (dist < bestD) {
      bestD = dist;
      best = r;
    }
  }
  if (!best) return null;
  const dx = best.b[0] - best.a[0],
    dz = best.b[1] - best.a[1],
    len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - best.a[0]) * dx + (z - best.a[1]) * dz) / len2));
  const qx = best.a[0] + dx * t,
    qz = best.a[1] + dz * t;
  const toRoadX = qx - x,
    toRoadZ = qz - z,
    vlen = Math.hypot(toRoadX, toRoadZ) || 1;
  let sx = x,
    sz = z,
    walked = 0;
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
    if (!isShopFront(b)) continue;
    const dist = Math.hypot((b.minX + b.maxX) / 2 - cx, (b.minZ + b.maxZ) / 2 - cz);
    if (dist > 140) continue;
    near.push({ b, dist, label: frontageName(b) });
  }
  near.sort((a, c) => a.dist - c.dist);
  for (const item of near.slice(0, 16)) {
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
}
function renderBuildings(cx, cz) {
  for (const mesh of [...buildingGroup.children]) {
    mesh.geometry.dispose();
    buildingGroup.remove(mesh);
  }
  buildingCenter.set(cx, cz);
  renderRoads(cx, cz);
  let banded = 0;
  let shopBands = 0;
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
    const storey = b.storey || STOREY_METERS;
    // The facade texture paints four storeys. Scale it so one of them
    // matches this building's storey: 3 m when the survey measured it,
    // about one person on the untagged street wall.
    const vScale = storey * 4;
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) / 10, uv.getY(i) / vScale);
    const look = buildingLook(b);
    const wall = plasterMats.get(look.plaster) || plasterMats.get(GLASS_PLASTER);
    const m = new THREE.Mesh(geo, [roofMat, wall]);
    m.castShadow = true;
    m.receiveShadow = true;
    buildingGroup.add(m);
    const dist = Math.hypot(
      (b.minX + b.maxX) / 2 - cx,
      (b.minZ + b.maxZ) / 2 - cz,
    );
    const floors =
      b.floors || Math.max(1, Math.round(b.height / storey));
    if (isShopFront(b) && dist < 160 && shopBands < 40 && b.height > 3.2) {
      shopBands++;
      const bandShape = new THREE.Shape();
      bandShape.moveTo(b.points[0][0], -b.points[0][1]);
      for (const p of b.points.slice(1)) bandShape.lineTo(p[0], -p[1]);
      bandShape.closePath();
      const bandH = Math.min(3.1, Math.max(2.2, b.height * 0.3));
      const bandGeo = new THREE.ExtrudeGeometry(bandShape, {
        depth: bandH,
        bevelEnabled: false,
      });
      bandGeo.rotateX(-Math.PI / 2);
      const shopBand = new THREE.Mesh(bandGeo, bandMats.get(look.band));
      shopBand.castShadow = true;
      shopBand.receiveShadow = true;
      buildingGroup.add(shopBand);
    }
    if (dist < 130 && banded < 48 && floors > 1) {
      banded++;
      const pts = b.points;
      for (let f = 1; f < floors && f <= 14; f++) {
        const y = f * storey;
        if (y > b.height - 0.35) break;
        for (let i = 0; i < pts.length; i++) {
          const p0 = pts[i],
            p1 = pts[(i + 1) % pts.length],
            dx = p1[0] - p0[0],
            dz = p1[1] - p0[1],
            len = Math.hypot(dx, dz);
          if (len < 1.8) continue;
          const band = new THREE.Mesh(
            new THREE.BoxGeometry(0.34, 0.16, len),
            isShopFront(b) && f === 1
              ? bandMats.get(buildingLook(b).band)
              : wall,
          );
          band.position.set((p0[0] + p1[0]) / 2, y, (p0[1] + p1[1]) / 2);
          band.rotation.y = Math.atan2(dx, dz);
          band.castShadow = true;
          band.receiveShadow = true;
          buildingGroup.add(band);
        }
      }
    }
  }
  mergeStatic(buildingGroup);
  refreshSigns(cx, cz);
  if (detailGroup) {
    scene.remove(detailGroup);
    const disposed = new Set();
    detailGroup.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of list) {
        if (!mat || disposed.has(mat)) continue;
        disposed.add(mat);
        mat.dispose();
      }
    });
  }
  detailGroup = streetDetails(cx, cz, roadSegments, collides, obstacles);
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
let player = makeVehicle("compact-suv", 0xe5d6ae);
player.rotation.y = spawnHeading;
scene.add(player);
player.position.set(city.spawn[0], 0, city.spawn[1]);
const parkedCars = [];
const spawnedRides = [];
const avatar = new THREE.Group();
avatar.userData.player = true;
avatar.userData.look = defaultLook().id;
avatar.userData.name = defaultLook().name;
avatar.userData.walk = () => {};
avatar.visible = false;
scene.add(avatar);
const driveSegments = splitRoadsAtJunctions(roadSegments);
const driveAdj = roadAdjacency(driveSegments);
const localDrive = driveSegments.filter(
  (r) => r.length > 16 && segmentDistance(...city.spawn, r.a, r.b) < 420,
);
const populationRoads = localDrive.length ? localDrive : driveSegments;
function closestOn(segments, x, z) {
  let best = null;
  for (const segment of segments) {
    const dx = segment.b[0] - segment.a[0],
      dz = segment.b[1] - segment.a[1],
      len2 = dx * dx + dz * dz || 1,
      t = Math.max(
        0.08,
        Math.min(0.92, ((x - segment.a[0]) * dx + (z - segment.a[1]) * dz) / len2),
      ),
      d = Math.hypot(segment.a[0] + dx * t - x, segment.a[1] + dz * t - z);
    if (!best || d < best.d) best = { segment, t, d };
  }
  return best;
}
function beginTrip(agent, atNode = null) {
  const goal = chooseGoal(
    populationRoads,
    [agent.x ?? city.spawn[0], agent.z ?? city.spawn[1]],
    Math.max(28, (agent.minLength || 36) * 0.7),
    agent.rng,
  );
  const trip = planTrip({
    adjacency: driveAdj,
    fromSegment: agent.segment,
    fromT: agent.t ?? 0.4,
    direction: agent.direction ?? 1,
    atNode,
    goal,
    minLength: agent.minLength || 36,
    rng: agent.rng,
  });
  const points = tripPolyline(trip, (step) => agent.lateral(step));
  if (atNode && Number.isFinite(agent.x)) points.unshift([agent.x, agent.z]);
  if (points.length < 2) {
    agent.segment =
      populationRoads[Math.floor(agent.rng() * populationRoads.length) % populationRoads.length];
    agent.t = 0.45;
    agent.direction = 1;
    if ((agent.tries || 0) < 3) {
      agent.tries = (agent.tries || 0) + 1;
      beginTrip(agent, null);
    }
    return;
  }
  agent.tries = 0;
  agent.points = points;
  agent.index = 0;
  agent.goal = goal;
  agent.trip = trip;
  agent.segment = trip.endSegment || agent.segment;
  agent.endNode = trip.endNode;
  if (!atNode) {
    agent.x = points[0][0];
    agent.z = points[0][1];
  }
  const dx = points[Math.min(1, points.length - 1)][0] - points[0][0];
  const dz = points[Math.min(1, points.length - 1)][1] - points[0][1];
  if (Math.hypot(dx, dz) > 0.05) agent.yaw = Math.atan2(-dx, -dz);
  agent.mesh.position.set(agent.x, 0, agent.z);
  agent.mesh.rotation.y = agent.yaw || 0;
  agent.arrived = false;
}
const pedestrians = [];
const spawnAnchor = closestOn(populationRoads, city.spawn[0], city.spawn[1]);
for (let i = 0; i < 48; i++) {
  const mesh = person(i);
  const anchored = i === 0 && spawnAnchor;
  const segment = anchored
    ? spawnAnchor.segment
    : populationRoads[(i * 5) % populationRoads.length];
  const t = anchored ? spawnAnchor.t : 0.12 + ((i * 17) % 70) / 100;
  let side = i % 2 ? 1 : -1;
  if (anchored) {
    const left = sidewalkLateral(segment, 1);
    const a = segmentPoint(segment, t, left);
    const b = segmentPoint(segment, t, -left);
    const da = Math.hypot(a[0] - city.spawn[0], a[1] - city.spawn[1]);
    const db = Math.hypot(b[0] - city.spawn[0], b[1] - city.spawn[1]);
    side = da <= db ? 1 : -1;
  }
  const role = mesh.userData.role || {};
  const agent = {
    mesh,
    kind: "person",
    segment,
    t,
    direction: t < 0.55 ? 1 : -1,
    side,
    lateral: (step) => sidewalkLateral(step.segment, side),
    speed: role.kind === "older" ? 0.95 : 1.2 + (i % 4) * 0.08,
    minLength: 40,
    health: 3,
    down: false,
    dead: false,
    rng: mulberry32(900 + i * 17),
    phase: i * 0.73,
    yaw: 0,
    x: segmentPoint(segment, t, 0)[0],
    z: segmentPoint(segment, t, 0)[1],
  };
  scene.add(mesh);
  beginTrip(agent);
  pedestrians.push(agent);
}
function clearSpawn(agent, gap, pace) {
  if (Math.hypot((agent.x || 0) - city.spawn[0], (agent.z || 0) - city.spawn[1]) >= gap)
    return;
  const skip = advanceAlong(agent, gap / Math.max(pace, 0.4));
  agent.x = skip.x;
  agent.z = skip.z;
  agent.index = skip.index;
  agent.yaw = skip.yaw;
  agent.mesh.position.set(agent.x, 0, agent.z);
  agent.mesh.rotation.y = agent.yaw || 0;
}
function nudgeAlong(agent, metres) {
  const skip = advanceAlong(agent, metres / Math.max(agent.speed, 0.4));
  agent.x = skip.x;
  agent.z = skip.z;
  agent.index = skip.index;
  agent.yaw = skip.yaw;
  agent.mesh.position.set(agent.x, 0, agent.z);
  agent.mesh.rotation.y = agent.yaw || 0;
}
function separateFrom(agent, others, gap) {
  for (let n = 0; n < 8; n++) {
    const crowded = others.some(
      (other) =>
        other !== agent && Math.hypot(agent.x - other.x, agent.z - other.z) < gap,
    );
    if (!crowded) return;
    nudgeAlong(agent, gap);
  }
}
const traffic = [];
const bikeColors = [0xb4332a, 0x1e1e1e, 0x1d4e89, 0xc5c8cc, 0x2f6b45, 0x8a3b2f];
const carColors = [0xa7b7b3, 0xe3dac4, 0x678e92, 0xa4523f, 0xd7c4a2, 0x6e8b74];
const homeRoad = closestOn(populationRoads, city.spawn[0], city.spawn[1]);
const fleetCount = STREET_FLEET.cars + STREET_FLEET.motorcycles;
for (let i = 0; i < fleetCount; i++) {
  const body = fleetBody(i);
  const kind = i < STREET_FLEET.motorcycles ? "motorcycle" : "car";
  const segment = populationRoads[(i * 3 + 1) % populationRoads.length];
  if (!segment || segment.length < 8) continue;
  const color = kind === "motorcycle" ? bikeColors[i % bikeColors.length] : carColors[i % carColors.length];
  const mesh = makeVehicle(body, color);
  let t = 0.08 + ((i * 13) % 80) / 100;
  let direction = i % 2 ? 1 : -1;
  if (i < 10 && homeRoad && homeRoad.segment.length > 20) {
    const along = (16 + i * 6) / homeRoad.segment.length;
    direction = 1 - homeRoad.t >= homeRoad.t ? 1 : -1;
    t = direction === 1
      ? Math.min(0.9, homeRoad.t + along)
      : Math.max(0.1, homeRoad.t - along);
  }
  const agent = {
    mesh,
    kind,
    body,
    label: BODY_LABELS[body],
    segment: i < 10 && homeRoad ? homeRoad.segment : segment,
    t,
    direction,
    lateral: (step) => laneLateral(step.segment, kind, step.direction),
    speed: kind === "motorcycle" ? 8.2 + (i % 5) * 0.4 : 6.4 + (i % 4) * 0.35,
    minLength: 70,
    rng: mulberry32(4000 + i * 29),
    yaw: 0,
    hornIn: 2 + (i % 7),
  };
  scene.add(mesh);
  beginTrip(agent);
  if (Math.hypot((agent.x || 0) - city.spawn[0], (agent.z || 0) - city.spawn[1]) < 14) {
    const skip = advanceAlong(agent, 18 / Math.max(agent.speed, 1));
    agent.x = skip.x;
    agent.z = skip.z;
    agent.index = skip.index;
    agent.yaw = skip.yaw;
    agent.mesh.position.set(agent.x, 0, agent.z);
    agent.mesh.rotation.y = agent.yaw || 0;
  }
  traffic.push(agent);
}
const nearRoads = populationRoads.filter(
  (road) => segmentDistance(...city.spawn, road.a, road.b) < 220,
);
const serviceRoads = nearRoads.length > 4 ? nearRoads : populationRoads;
for (let i = 0; i < CITY_SERVICES.officers; i++) {
  const role = officerProfile(i);
  const mesh = person(200 + i, { role });
  const side = i % 2 ? 1 : -1;
  const segment = serviceRoads[(i * 2) % serviceRoads.length];
  const agent = {
    mesh,
    kind: "person",
    service: "police",
    segment,
    t: 0.18 + (i % 5) * 0.14,
    direction: 1,
    side,
    lateral: (step) => sidewalkLateral(step.segment, side),
    speed: ROUND_SPEED,
    minLength: 100,
    health: 3,
    down: false,
    dead: false,
    rng: mulberry32(12000 + i * 13),
    phase: i * 0.4,
    yaw: 0,
  };
  scene.add(mesh);
  beginTrip(agent);
  clearSpawn(agent, 10, agent.speed);
  separateFrom(agent, pedestrians, 1.6);
  pedestrians.push(agent);
}
for (let i = 0; i < CITY_SERVICES.junkies; i++) {
  const role = junkieProfile(i);
  const mesh = person(260 + i, { role });
  const side = i % 2 ? -1 : 1;
  const segment = serviceRoads[(i * 3 + 1) % serviceRoads.length];
  const agent = {
    mesh,
    kind: "person",
    service: "junkie",
    segment,
    t: 0.22 + i * 0.2,
    direction: i % 2 ? -1 : 1,
    side,
    lateral: (step) => sidewalkLateral(step.segment, side),
    speed: 0.55,
    minLength: 24,
    health: 3,
    down: false,
    dead: false,
    rng: mulberry32(13000 + i * 19),
    phase: i * 1.1,
    wait: 0.3 + i * 0.5,
    yaw: 0,
  };
  scene.add(mesh);
  beginTrip(agent);
  clearSpawn(agent, 12, 0.55);
  separateFrom(agent, pedestrians, 1.6);
  pedestrians.push(agent);
}
serviceFleet().forEach((body, i) => {
  const mesh = makeVehicle(body);
  const kind = mesh.userData.kind;
  const segment = serviceRoads[(i * 2 + 1) % serviceRoads.length];
  if (!segment || segment.length < 8) return;
  const direction = i % 2 ? 1 : -1;
  const agent = {
    mesh,
    kind,
    body,
    service: kind,
    siren: mesh.userData.siren,
    label: mesh.userData.label,
    segment,
    t: 0.15 + (i % 4) * 0.18,
    direction,
    lateral: (step) => serviceLateral(step.segment, step.direction),
    speed: serviceSpeed(kind, i),
    minLength: 80,
    rng: mulberry32(15000 + i * 19),
    phase: i * 0.37,
    yaw: 0,
    hornIn: 999,
  };
  scene.add(mesh);
  beginTrip(agent);
  clearSpawn(agent, 16, agent.speed);
  separateFrom(
    agent,
    traffic,
    bodyRadius(kind) + bodyRadius("car") + 1.5,
  );
  traffic.push(agent);
});
function makeStreetWeapon(id) {
  const group = new THREE.Group();
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
  if (id === "pipe") {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 1.15, 8),
      mat(0x8d9296),
    );
    mesh.rotation.z = Math.PI / 2;
    group.add(mesh);
  } else if (id === "stick") {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.04, 1.05, 6),
      mat(0x6a4b2f),
    );
    mesh.rotation.z = 1.1;
    group.add(mesh);
  } else {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), mat(0x6e6a62));
    mesh.scale.set(1.15, 0.75, 1);
    group.add(mesh);
  }
  return group;
}
const weaponDrops = [];
let loadout = emptyLoadout();
let heldMesh = null;
let attack = 0;
const fist = new THREE.Mesh(
  new THREE.SphereGeometry(0.07, 8, 8),
  new THREE.MeshStandardMaterial({ color: 0xd6b08a, roughness: 0.65 }),
);
fist.position.set(0.28, 1.05, 0.22);
fist.visible = false;
fist.userData.attachment=true;
fist.castShadow = true;
avatar.add(fist);
const weaponBase = spawnAnchor
  ? segmentPoint(
      spawnAnchor.segment,
      spawnAnchor.t,
      sidewalkLateral(spawnAnchor.segment, 1),
    )
  : [city.spawn[0] + 2, city.spawn[1]];
[
  [0.6, 0.4],
  [2.4, -0.2],
  [-1.5, 1.2],
].forEach((offset, index) => {
  const id = ["pipe", "stick", "stone"][index];
  const spec = pickupWeapon(id);
  const mesh = makeStreetWeapon(id);
  const x = weaponBase[0] + offset[0];
  const z = weaponBase[1] + offset[1];
  mesh.position.set(x, id === "stone" ? 0.16 : 0.22, z);
  scene.add(mesh);
  weaponDrops.push({ ...spec, x, z, mesh, taken: false });
});
const smokePuffs = [];
for (let i = 0; i < 40; i++) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xc5c5c5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), material);
  mesh.visible = false;
  scene.add(mesh);
  smokePuffs.push({ mesh, life: 0 });
}
let smokeCursor = 0;
function emitSmoke(mesh, speed, dt, holder) {
  if (speed < 0.8) return;
  holder.smokeWait = (holder.smokeWait || 0) - dt;
  if (holder.smokeWait > 0) return;
  holder.smokeWait = 0.14;
  const puff = smokePuffs[smokeCursor++ % smokePuffs.length];
  const local = mesh.userData.exhaust || [0, 0.4, 1.4];
  const yaw = mesh.rotation.y;
  const cos = Math.cos(yaw),
    sin = Math.sin(yaw);
  puff.mesh.position.set(
    mesh.position.x + local[0] * cos + local[2] * sin,
    local[1],
    mesh.position.z - local[0] * sin + local[2] * cos,
  );
  puff.mesh.visible = true;
  puff.life = 0.65;
  puff.mesh.scale.setScalar(0.35);
  puff.mesh.material.opacity = 0.38;
}
function tickSmoke(dt) {
  for (const puff of smokePuffs) {
    if (puff.life <= 0) continue;
    puff.life -= dt;
    puff.mesh.position.y += dt * 0.9;
    const scale = puff.mesh.scale.x * (1 + dt * 1.6);
    puff.mesh.scale.setScalar(scale);
    puff.mesh.material.opacity = Math.max(0, puff.life) * 0.45;
    if (puff.life <= 0) puff.mesh.visible = false;
  }
}
function renderPlaces() {
  const group = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
  const addBox = (parent, w, h, d, c, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  for (const place of city.places || []) {
    const site = new THREE.Group();
    site.position.set(place.point[0], 0, place.point[1]);
    site.userData.place = place.kind;
    if (place.kind === "fuel") {
      for (const x of [-2.1, 2.1])
        for (const z of [-1.3, 1.3]) addBox(site, 0.16, 3.1, 0.16, 0x4a463c, x, 1.55, z);
      addBox(site, 5, 0.14, 3.2, 0xc4553a, 0, 3.15, 0);
      addBox(site, 0.62, 1.05, 0.4, 0x2c3330, -0.7, 0.55, 0.1);
      addBox(site, 0.62, 1.05, 0.4, 0x2c3330, 0.7, 0.55, 0.1);
    } else if (place.kind === "gym") {
      addBox(site, 0.12, 1.8, 2.6, 0x1e3a5f, 0, 2.3, 0);
      addBox(site, 2.4, 0.1, 0.1, 0xb7c0bc, -1.3, 2.6, 0);
      addBox(site, 2.4, 0.1, 0.1, 0xb7c0bc, 1.3, 1.7, 0);
    } else if (place.kind === "school" || place.kind === "college") {
      addBox(site, place.kind === "college" ? 8 : 6, 0.4, 5, 0xd8c39a, 0, 0.3, 0);
      addBox(site, 0.2, place.kind === "college" ? 4.2 : 3.2, 0.2, 0x8d5a3c, 0, 2, 0);
    } else if (place.kind === "store") {
      addBox(site, 2.4, 0.12, 1.1, 0x3d6a4a, 0, 2.4, 0);
      addBox(site, 1.6, 1.1, 0.2, 0xf4efe4, 0, 1.3, 0);
    } else {
      const pitch = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 10),
        new THREE.MeshStandardMaterial({ color: 0x3d7a46, roughness: 1 }),
      );
      pitch.rotation.x = -Math.PI / 2;
      pitch.position.y = 0.04;
      site.add(pitch);
    }
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#1c2420";
    ctx.font = "28px sans-serif";
    ctx.fillText(place.name, 12, 42);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.85),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas) }),
    );
    board.position.y = place.kind === "playground" ? 2.2 : 3.7;
    site.add(board);
    group.add(site);
  }
  scene.add(group);
}
renderPlaces();
let detailedHumans = 0;
let lookId = defaultLook().id;
Promise.all([hydrateResidents(pedestrians.map(p=>p.mesh)),prepareLooks()])
 .then(([n])=>{detailedHumans=n;if(applyLook(avatar,lookId))detailedHumans++;})
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
const walkVel = new THREE.Vector3();
let lookYaw = spawnHeading;
let lookPitch = 0.28;
let vy = 0;
let jumpQueued = false;
const playerLife = { health: 3, down: false, dead: false, downUntil: null };
let previousTime = performance.now();
let audioContext, toastTimer;
const toneNodes = new Map();
const voicePlayer = new Audio();
voicePlayer.volume = 0.9;
const actor = () => (walking ? avatar : player);
const playerBody = () => player.userData.body || "compact-suv";
function drivenKind() {
  return player.userData.kind === "armor" ? "armor" : "player-car";
}
function rideKind(mesh) {
  if (mesh.userData.kind === "armor") return "armor";
  if (mesh.userData.kind === "motorcycle") return "motorcycle";
  return "car";
}
function vehicleObstacles(except = null) {
  const meshes = [player, ...spawnedRides.map((ride) => ride.mesh)];
  const list = [];
  for (const mesh of meshes) {
    if (mesh === except) continue;
    list.push({
      x: mesh.position.x,
      z: mesh.position.z,
      radius: bodyRadius(rideKind(mesh)),
    });
  }
  return list;
}
function nearestVehicle(position, max = 7) {
  let best = null;
  for (const mesh of [player, ...spawnedRides.map((ride) => ride.mesh)]) {
    const distance = Math.hypot(mesh.position.x - position.x, mesh.position.z - position.z);
    if (distance <= max && (!best || distance < best.distance)) best = { mesh, distance };
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
  if (sound && !audioContext) audioContext = new AudioContext();
  if (sound) audioContext.resume();
  else {
    voicePlayer.pause();
    window.speechSynthesis?.cancel();
  }
}
function ensureTones() {
  if (!audioContext) return;
  for (const [body, tone] of Object.entries(VEHICLE_TONES)) {
    if (toneNodes.has(body)) continue;
    const osc = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    osc.type = tone.engineType;
    osc.frequency.value = tone.engineBase;
    filter.type = "lowpass";
    filter.frequency.value = tone.filter;
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    toneNodes.set(body, { osc, gain, tone });
  }
}
function playHorn(body, amount = 0.07) {
  const tone = VEHICLE_TONES[body];
  if (!tone || !audioContext || amount <= 0.001) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = tone.hornType;
  osc.frequency.value = tone.hornFreq;
  osc.connect(gain);
  gain.connect(audioContext.destination);
  const now = audioContext.currentTime;
  gain.gain.setValueAtTime(Math.min(0.08, amount), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + tone.hornSeconds);
  osc.start(now);
  osc.stop(now + tone.hornSeconds + 0.02);
}
const sirenNodes = new Map();
function ensureSirens() {
  if (!audioContext) return;
  for (const [kind, tone] of Object.entries(SIREN_TONES)) {
    if (sirenNodes.has(kind)) continue;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = tone.type;
    osc.frequency.value = tone.low;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    sirenNodes.set(kind, { osc, gain, tone });
  }
}
function updateSirens(listener) {
  if (!sound || !audioContext) {
    for (const node of sirenNodes.values()) node.gain.gain.value = 0;
    return;
  }
  ensureSirens();
  const best = new Map();
  for (const agent of traffic) {
    if (!agent.siren) continue;
    const d = Math.hypot(agent.x - listener.x, agent.z - listener.z);
    const gain = distanceGain(d, 78);
    const prev = best.get(agent.kind);
    if (!prev || gain > prev) best.set(agent.kind, gain);
  }
  const now = audioContext.currentTime;
  const sweep = performance.now() / 1000;
  for (const [kind, node] of sirenNodes) {
    const gain = best.get(kind) || 0;
    node.osc.frequency.setTargetAtTime(sirenFrequency(node.tone, sweep), now, 0.05);
    node.gain.gain.setTargetAtTime(Math.min(0.045, gain * 0.06), now, 0.08);
  }
}
function updateEngines(listener) {
  if (!sound || !audioContext) {
    for (const node of toneNodes.values()) node.gain.gain.value = 0;
    return;
  }
  ensureTones();
  const best = new Map();
  const hear = (body, gain, rate) => {
    const prev = best.get(body);
    if (!prev || gain > prev.gain) best.set(body, { gain, rate });
  };
  for (const agent of traffic) {
    const d = Math.hypot(agent.x - listener.x, agent.z - listener.z);
    hear(agent.body, distanceGain(d), agent.speed || 0);
  }
  if (!walking && Math.abs(speed) > 0.4)
    hear(playerBody(), 0.85, Math.abs(speed));
  for (const [body, node] of toneNodes) {
    const info = best.get(body) || { gain: 0, rate: 0 };
    node.gain.gain.setTargetAtTime(
      Math.min(0.03, info.gain * 0.04),
      audioContext.currentTime,
      0.08,
    );
    node.osc.frequency.setTargetAtTime(
      node.tone.engineBase + info.rate * node.tone.engineSlide,
      audioContext.currentTime,
      0.08,
    );
  }
}
function honk() {
  if (walking) {
    toast("The horn is in the car.");
    return;
  }
  if (!sound) {
    toast("Turn sound on to hear the horn and engine.");
    return;
  }
  playHorn(playerBody(), 0.07);
}
let talkIndex = 0,
  dialogueTimer;
function talk() {
  const here = actor().position;
  const found = nearestReply(
    pedestrians.map((ped) => ({
      ped,
      x: ped.x,
      z: ped.z,
      dead: ped.dead,
      down: ped.down,
    })),
    here.x,
    here.z,
  );
  if (!found) {
    toast("Get within 22 metres of a pedestrian to talk.");
    return;
  }
  const neighbour = found.person.ped;
  neighbour.yaw = faceYaw(neighbour.x, neighbour.z, here.x, here.z);
  neighbour.mesh.rotation.y = neighbour.yaw;
  neighbour.replyUntil = elapsed + 4.5;
  const lang = $("language").value,
    clipIndex = talkIndex++ % 3,
    text = lines[lang][clipIndex];
  $("dialogue").replaceChildren();
  const label = document.createElement("small");
  label.textContent = `${neighbour.mesh.userData.name || "NEIGHBOUR"} REPLIES`;
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
  player = player;
  player.position.set(city.spawn[0], 0, city.spawn[1]);
  speed = 0;
  yaw = spawnHeading;
  lookYaw = spawnHeading;
  lookPitch = 0.28;
  vy = 0;
  jumpQueued = false;
  walkVel.set(0, 0, 0);
  Object.assign(playerLife, refillHealth(playerLife));
  avatar.rotation.x = 0;
  walking = false;
  avatar.visible = false;
  avatar.position.y = 0;
  player.rotation.y = spawnHeading;
  paintHealth();
  toast("Back in Deccan. The evening is yours.");
}
function carChoices() {
  const cars = [];
  const add = (mesh, x, z, carSpeed, carYaw, agent) => {
    if (!mesh || mesh.userData.kind !== "car") return;
    cars.push({
      id: mesh.uuid,
      kind: "car",
      x,
      z,
      speed: carSpeed || 0,
      yaw: carYaw || 0,
      mesh,
      agent,
    });
  };
  if (walking) add(player, player.position.x, player.position.z, 0, player.rotation.y);
  for (const mesh of parkedCars)
    add(mesh, mesh.position.x, mesh.position.z, 0, mesh.rotation.y);
  for (const agent of traffic) {
    if (agent.kind !== "car") continue;
    add(agent.mesh, agent.x, agent.z, agent.speed, agent.yaw || agent.mesh.rotation.y, agent);
  }
  return cars;
}
function takeCar(choice) {
  const mesh = choice.mesh;
  if (mesh !== player && !parkedCars.includes(player)) parkedCars.push(player);
  for (let i = parkedCars.length - 1; i >= 0; i--)
    if (parkedCars[i] === mesh) parkedCars.splice(i, 1);
  if (choice.agent) {
    const index = traffic.indexOf(choice.agent);
    if (index >= 0) traffic.splice(index, 1);
  }
  player = mesh;
  yaw = choice.yaw;
  speed = choice.agent ? choice.speed : 0;
  player.rotation.y = yaw;
  walking = false;
  avatar.visible = false;
  avatar.position.y = 0;
  vy = 0;
  walkVel.set(0, 0, 0);
}
function vehicleSolids(except) {
  const bodies = [];
  for (const agent of traffic) {
    if (agent.mesh === except) continue;
    bodies.push({
      x: agent.x,
      z: agent.z,
      radius: bodyRadius(agent.kind),
    });
  }
  for (const mesh of parkedCars) {
    if (mesh === except) continue;
    bodies.push({
      x: mesh.position.x,
      z: mesh.position.z,
      radius: bodyRadius(mesh.userData.kind || "car"),
    });
  }
  if (player !== except)
    bodies.push({
      x: player.position.x,
      z: player.position.z,
      radius: bodyRadius(player.userData.kind || "car"),
    });
  return bodies;
}
function toggleWalk() {
  if (!walking) {
    if (Math.abs(speed) > 1) {
      toast("Stop the car before getting out.");
      return;
    }
    const spot = player.position
      .clone()
      .add(new THREE.Vector3(Math.cos(yaw) * 3, 0, -Math.sin(yaw) * 3));
    if (collides(spot.x, spot.z, 0.4)) {
      toast("There is no room to exit here.");
      return;
    }
    walking = true;
    lookYaw = yaw;
    lookPitch = 0.28;
    vy = 0;
    jumpQueued = false;
    walkVel.set(0, 0, 0);
    avatar.position.copy(spot);
    avatar.position.y = 0;
    avatar.rotation.y = yaw;
    avatar.visible = true;
    avatar.userData.walk?.(0, 0);
    speed = 0;
    toast("On foot. E enters any car within 7 metres. V changes who you are.");
    engageLook();
    return;
  }
  const cars = carChoices();
  const choice = nearestCar(
    { x: avatar.position.x, z: avatar.position.z },
    cars,
  );
  if (!choice) {
    toast("No car within 7 metres.");
    return;
  }
  takeCar(cars.find((car) => car.id === choice.id));
  releaseLook();
  toast(`In the ${player.userData.label || "car"}. Space brakes.`);
}
function switchLook() {
  if (playerLife.dead) return;
  lookId = cycleLook(lookId);
  const look = lookById(lookId);
  applyLook(avatar, lookId);
  avatar.userData.look = look.id;
  avatar.userData.name = look.name;
  if (playerLife.down) layMesh(avatar);
  toast(`${look.label}. ${look.name}.`);
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
function layMesh(mesh) {
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = 0.2;
  mesh.userData.walk?.(0, 0);
}
function standMesh(mesh) {
  mesh.rotation.x = 0;
  mesh.position.y = 0;
}
const bloodMarks = [];
function leaveBlood(x, z) {
  const group = new THREE.Group();
  group.name = "blood";
  group.position.set(x, 0.25, z);
  const blob = (rx, rz, ox, oz, color, opacity) => {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 14),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(rx, rz, 1);
    mesh.position.set(ox, 0, oz);
    group.add(mesh);
  };
  blob(0.9, 0.58, 0, 0, 0x8d1c28, 0.94);
  blob(0.42, 0.28, 0.48, 0.22, 0xb4333c, 0.86);
  scene.add(group);
  bloodMarks.push({ x, z, mesh: group });
}
function settlePerson(person, next, now) {
  if (!next?.changed) return;
  const stain = deathStain(person, next);
  if (stain) leaveBlood(stain.x, stain.z);
  person.health = next.health ?? 0;
  person.down = true;
  person.dead = Boolean(next.dead);
  if (Number.isFinite(next.x)) person.x = next.x;
  if (Number.isFinite(next.z)) person.z = next.z;
  person.downUntil = person.dead ? Infinity : now + 4;
  layMesh(person.mesh);
  person.mesh.position.set(person.x, 0.2, person.z);
}
function hitPlayer(impact, dirX, dirZ) {
  if (!walking || playerLife.down) return;
  const next = applyImpact(
    {
      health: playerLife.health,
      down: false,
      dead: false,
      x: avatar.position.x,
      z: avatar.position.z,
    },
    impact,
    dirX,
    dirZ,
    { survive: true },
  );
  if (!next.changed) return;
  playerLife.health = next.health;
  playerLife.down = true;
  playerLife.dead = Boolean(next.dead);
  playerLife.downUntil = next.dead ? Infinity : elapsed + 4;
  avatar.position.x = next.x;
  avatar.position.z = next.z;
  layMesh(avatar);
  paintHealth();
  toast(next.dead ? "You went down." : "You were knocked down.");
}
function paintHealth() {
  const el = $("health");
  if (!el) return;
  const hp = playerLife.health;
  el.replaceChildren();
  const label = document.createElement("span");
  label.textContent = healthLabel(hp);
  el.append(label);
  for (let i = 1; i <= 3; i += 1) {
    const pip = document.createElement("i");
    if (i <= hp) pip.className = "on";
    el.append(pip);
  }
  const weapon = $("weapon");
  if (weapon) weapon.textContent = selectedWeapon(loadout).name.toUpperCase();
}
function showHeld() {
  if (heldMesh) {
    avatar.remove(heldMesh);
    heldMesh = null;
  }
  const weapon = selectedWeapon(loadout);
  if (weapon.id !== "fists") {
    heldMesh = makeStreetWeapon(weapon.id);
    heldMesh.position.set(0.34, 1.02, 0.12);
    heldMesh.rotation.y = 0.6;
    avatar.add(heldMesh);
  }
  paintHealth();
}
function chooseSlot(slot) {
  const next = selectSlot(loadout, slot);
  if (!next.ok) {
    toast(next.weapon ? `No ${next.weapon.name.toLowerCase()} yet.` : "Empty slot.");
    return false;
  }
  loadout = next;
  showHeld();
  toast(next.weapon.name);
  return true;
}
function takeOrSwing() {
  if (!walking || playerLife.dead || playerLife.down) {
    toast(playerLife.dead ? "You can't get up." : "Get out of the car first.");
    return;
  }
  const drop = weaponDrops.find(
    (item) =>
      !item.taken &&
      !loadout.owned.includes(item.id) &&
      Math.hypot(item.x - avatar.position.x, item.z - avatar.position.z) < 1.6,
  );
  if (drop) {
    loadout = grantWeapon(loadout, drop.id);
    drop.taken = true;
    drop.mesh.visible = false;
    showHeld();
    toast(`Picked up a ${selectedWeapon(loadout).name.toLowerCase()}. Number keys switch weapons.`);
    return;
  }
  swingWeapon();
}
function swingWeapon() {
  attack = 1;
  const weapon = selectedWeapon(loadout);
  const fx = -Math.sin(avatar.rotation.y);
  const fz = -Math.cos(avatar.rotation.y);
  for (const ped of pedestrians) {
    if (ped.dead) continue;
    const dx = ped.x - avatar.position.x;
    const dz = ped.z - avatar.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    const hit = strikeHit({
      weapon,
      distance,
      facingDot: (dx * fx + dz * fz) / distance,
    });
    if (!hit.hit) continue;
    const next = applyStrike(
      { health: ped.health ?? 3, down: ped.down, dead: ped.dead, x: ped.x, z: ped.z },
      hit,
    );
    settlePerson(ped, next, elapsed);
    toast(
      next.dead
        ? `${ped.mesh.userData.name} went down.`
        : weapon.id === "fists"
          ? `Punched ${ped.mesh.userData.name}.`
          : `Hit ${ped.mesh.userData.name}.`,
    );
    return true;
  }
  toast(weapon.id === "fists" ? "Punched and missed." : "Swung and missed.");
  return false;
}
function spawnRide(kind) {
  const here = actor().position;
  const facing = walking ? lookYaw : yaw;
  const side = spawnedRides.length % 2 === 0 ? 1 : -1;
  const distance = 5.5 + Math.floor(spawnedRides.length / 2) * 3.6;
  const spot = parkBeside(here.x, here.z, facing, { distance, side });
  const mesh =
    kind === "armor" ? makeArmoredCarrier() : makeVehicle("compact-suv", 0xc96b4a);
  mesh.position.set(spot.x, 0, spot.z);
  mesh.rotation.y = spot.yaw;
  scene.add(mesh);
  parkedCars.push(mesh);
  spawnedRides.push({ mesh, kind, x: spot.x, z: spot.z });
  return { kind, x: spot.x, z: spot.z };
}
function applyCheat(text) {
  const parsed = readCheat(text);
  if (!parsed) {
    toast("Unknown cheat.");
    return false;
  }
  if (parsed.effect === "weapon") {
    loadout = grantWeapon(loadout, nextStreetWeapon(loadout));
    showHeld();
    toast(`${selectedWeapon(loadout).name} ready. Number keys switch weapons.`);
  } else if (parsed.effect === "armor") {
    spawnRide("armor");
    toast("Kavach carrier parked beside you. Walk up to it and press E.");
  } else if (parsed.effect === "car") {
    spawnRide("car");
    toast("A car is parked beside you. Walk up to it and press E.");
  } else if (parsed.effect === "health") {
    Object.assign(playerLife, refillHealth(playerLife));
    if (walking) standMesh(avatar);
    paintHealth();
    toast("Health refilled.");
  }
  return parsed.effect;
}
let cheatOpen = false;
function openCheat() {
  if (!active || $("instructions").open) return;
  cheatOpen = true;
  keys.clear();
  $("cheat-box").hidden = false;
  $("cheat-code").value = "";
  $("cheat-code").focus();
  requestAnimationFrame(() => {
    if (cheatOpen) $("cheat-code").value = "";
  });
}
function closeCheat() {
  cheatOpen = false;
  $("cheat-box").hidden = true;
  $("cheat-code").blur();
  $("world").focus();
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
  if (key === "e" && !playerLife.dead) toggleWalk();
  if (key === "v") switchLook();
  if (key === "f") {
    if (job && ["pickup", "delivery"].includes(job.phase)) interactJob();
    else takeOrSwing();
  }
  if (key >= "1" && key <= "4") chooseSlot(Number(key));
  if (key === "j") startJob();
  if (key === "c") {
    view = (view + 1) % 3;
    toast(["Chase camera", "Close camera", "Overhead camera"][view]);
  }
  if (key === "h") honk();
  if (key === "t") talk();
  if (key === " " && walking && !blocksDriving(mapView) && avatar.position.y <= 0.05)
    jumpQueued = true;
}
window.addEventListener("keydown", (e) => {
  if (e.code === "Backquote" || e.key === "`" || e.key === "~") {
    e.preventDefault();
    if (cheatOpen) closeCheat();
    else openCheat();
    return;
  }
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
$("cheat-box").addEventListener("submit", (e) => {
  e.preventDefault();
  const value = $("cheat-code").value;
  $("cheat-code").value = "";
  applyCheat(value);
  closeCheat();
});
$("cheat-code").addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.code === "Backquote" || e.key === "`" || e.key === "~") {
    e.preventDefault();
    e.stopPropagation();
    closeCheat();
    return;
  }
  e.stopPropagation();
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
  $("world").focus();
  toast("WASD drives · E enters a nearby car · V switches girl, boy, man");
};
function releaseLook() {
  if (document.pointerLockElement) document.exitPointerLock();
}
function engageLook() {
  if (!walking || paused || !active || mapView.size === "max") return;
  const canvas = $("world");
  if (document.pointerLockElement === canvas) return;
  const pending = canvas.requestPointerLock?.();
  if (pending && typeof pending.catch === "function") pending.catch(() => {});
}
window.addEventListener("mousemove", (event) => {
  const overMap =
    mapView.pointerOver === true ||
    Boolean(event.target?.closest?.("#map-panel"));
  if (
    !active ||
    !footLookActive({
      walking,
      paused,
      overMap,
      draggingMap: mapDrag !== null,
    })
  )
    return;
  if (!event.movementX && !event.movementY) return;
  const next = orbitLook(lookYaw, lookPitch, event.movementX, event.movementY);
  lookYaw = next.yaw;
  lookPitch = next.pitch;
});
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  releaseLook();
}, true);
$("world").addEventListener("pointerdown", (event) => {
  if (!active || paused || event.button !== 0) return;
  if (event.target?.closest?.("#map-panel")) return;
  $("world").focus();
  if (walking) engageLook();
});
$("audio").onclick = enableSound;
$("photo").onclick = () => {
  const oldPixelRatio = renderer.getPixelRatio(),
    size = new THREE.Vector2();
  renderer.getSize(size);
  const aspect = camera.aspect;
  try {
    renderer.setPixelRatio(1);
    composer.setPixelRatio(1);
    renderer.setSize(3840, 2160, false);
    composer.setSize(3840, 2160);
    camera.aspect = 3840 / 2160;
    camera.updateProjectionMatrix();
    composer.render();
    const link = document.createElement("a");
    link.download = "pune-4k.png";
    link.href = renderer.domElement.toDataURL("image/png");
    link.click();
    toast("Saved 3840 × 2160 scene photo.");
  } finally {
    renderer.setPixelRatio(oldPixelRatio);
    composer.setPixelRatio(oldPixelRatio);
    renderer.setSize(size.x, size.y, false);
    composer.setSize(size.x, size.y);
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
  scene.background.set(night ? 0x526675 : 0xd4d2bc);
  scene.fog.color.copy(scene.background);
  sky.material.uniforms.horizon.value.set(night ? 0x3c525c : 0xcfcbb6);
  sky.material.uniforms.top.value.set(night ? 0x6d8796 : 0xf6f3e6);
  sun.intensity = night ? 0.35 : 2.5;
  hemi.intensity = night ? 0.85 : 1.85;
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
const mapView = createMapView();
try {
  const savedLayers = JSON.parse(localStorage.getItem("pune-map-layers") || "{}");
  Object.assign(mapLayers, savedLayers);
  mapView.zoom = clampZoom(Number(localStorage.getItem("pune-map-zoom")) || 1);
  mapView.size = createMapView({
    size: localStorage.getItem("pune-map-size") || "dock",
  }).size;
} catch {}
for (const name of Object.keys(mapLayers)) {
  const box = $(`layer-${name}`);
  if (box) box.checked = mapLayers[name] !== false;
}
function saveMap() {
  try {
    localStorage.setItem("pune-map-layers", JSON.stringify(mapLayers));
    localStorage.setItem("pune-map-zoom", String(mapView.zoom));
    localStorage.setItem("pune-map-size", mapView.size);
  } catch {}
}
function resizeMap() {
  if (mapView.size === "min") return;
  const rect = mapCanvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(280, Math.floor(rect.width * dpr));
  const height = Math.max(160, Math.floor(rect.height * dpr));
  if (mapCanvas.width !== width || mapCanvas.height !== height) {
    mapCanvas.width = width;
    mapCanvas.height = height;
  }
}
function syncMapHover() {
  mapView.pointerOver =
    mapView.size === "max" &&
    ($("map-panel").matches(":hover") || mapDrag !== null);
}
function applyMapSize() {
  const panel = $("map-panel");
  const labels = sizeLabels(mapView.size);
  panel.classList.toggle("is-min", mapView.size === "min");
  panel.classList.toggle("is-max", mapView.size === "max");
  $("map-size").textContent = labels.expand;
  $("map-min").textContent = labels.min;
  $("map-recenter").hidden = mapView.size !== "max";
  syncMapHover();
  requestAnimationFrame(resizeMap);
}
function bitmapPointer(dx, dy) {
  const rect = mapCanvas.getBoundingClientRect();
  const sx = rect.width ? mapCanvas.width / rect.width : 1;
  const sy = rect.height ? mapCanvas.height / rect.height : 1;
  return {
    dx: dx * sx,
    dy: dy * sy,
    scale: mapScale(mapView.size, mapView.zoom, mapCanvas.width || rect.width),
  };
}
let mapDrag = null;
function endMapDrag(event) {
  if (!mapDrag || (event && event.pointerId !== mapDrag.id)) return;
  mapDrag = null;
  mapCanvas.classList.remove("is-panning");
  syncMapHover();
}
mapCanvas.addEventListener("pointerdown", (event) => {
  if (mapView.size !== "max" || event.button !== 0) return;
  event.stopPropagation();
  mapCanvas.setPointerCapture(event.pointerId);
  mapDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  mapCanvas.classList.add("is-panning");
  syncMapHover();
});
mapCanvas.addEventListener("pointermove", (event) => {
  if (!mapDrag || event.pointerId !== mapDrag.id) return;
  const dx = event.clientX - mapDrag.x;
  const dy = event.clientY - mapDrag.y;
  if (!mapDrag.moved && Math.hypot(dx, dy) < 3) return;
  mapDrag.moved = true;
  mapDrag.x = event.clientX;
  mapDrag.y = event.clientY;
  const scaled = bitmapPointer(dx, dy);
  const p = actor().position;
  panByPixels(mapView, scaled.dx, scaled.dy, scaled.scale, p.x, p.z);
});
mapCanvas.addEventListener("pointerup", endMapDrag);
mapCanvas.addEventListener("pointercancel", endMapDrag);
mapCanvas.addEventListener("lostpointercapture", endMapDrag);
$("map-panel").addEventListener("pointerenter", syncMapHover);
$("map-panel").addEventListener("pointerleave", () => {
  if (!mapDrag) mapView.pointerOver = false;
});
$("map-panel").addEventListener(
  "wheel",
  (event) => {
    if (mapView.size === "min") return;
    event.preventDefault();
    const rect = mapCanvas.getBoundingClientRect();
    const scale = mapScale(
      mapView.size,
      mapView.zoom,
      mapCanvas.width || rect.width,
    );
    const perX = rect.width ? mapCanvas.width / rect.width : 1;
    const perY = rect.height ? mapCanvas.height / rect.height : 1;
    zoomBy(mapView, wheelZoomFactor(event.deltaY), {
      offsetX: (event.clientX - rect.left - rect.width / 2) * perX,
      offsetY: (event.clientY - rect.top - rect.height / 2) * perY,
      scale,
    });
    saveMap();
  },
  { passive: false },
);
$("map-zoom-in").onclick = () => {
  zoomBy(mapView, 1.25);
  saveMap();
};
$("map-zoom-out").onclick = () => {
  zoomBy(mapView, 1 / 1.25);
  saveMap();
};
$("map-size").onclick = () => {
  toggleExpand(mapView);
  applyMapSize();
  saveMap();
  if (mapView.size === "max") releaseLook();
  else if (walking) engageLook();
};
$("map-min").onclick = () => {
  toggleMin(mapView);
  applyMapSize();
  saveMap();
};
$("map-recenter").onclick = () => {
  const p = actor().position;
  recenter(mapView, p.x, p.z);
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
if (typeof ResizeObserver !== "undefined")
  new ResizeObserver(() => resizeMap()).observe(mapCanvas);
function drawMap() {
  if (mapView.size === "min") return;
  const w = mapCanvas.width;
  const h = mapCanvas.height;
  const pos = actor().position;
  map.setTransform(1, 0, 0, 1, 0, 0);
  map.fillStyle = "#163b33";
  map.fillRect(0, 0, w, h);
  const scale = mapScale(mapView.size, mapView.zoom, w);
  const center = viewCenter(mapView, pos.x, pos.z);
  const ox = w / 2 - center.x * scale;
  const oz = h / 2 - center.z * scale;
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
      if (Math.abs(p0[0] - center.x) > reach || Math.abs(p0[1] - center.z) > reach)
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
    const drawnRoads = new Set();
    const viewMinX = center.x - reach;
    const viewMaxX = center.x + reach;
    const viewMinZ = center.z - reach;
    const viewMaxZ = center.z + reach;
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
      if (mapView.size !== "max") continue;
      const title = roadTitle(r);
      if (!title) continue;
      const mid = r.points[Math.floor(r.points.length / 2)];
      if (!mid || !visible(mid[0], mid[1])) continue;
      if (drawnRoads.has(title)) continue;
      drawnRoads.add(title);
      if (drawnRoads.size > 10) continue;
      map.fillStyle = "#f6f3e6";
      map.font = `${Math.max(11, w / 52)}px sans-serif`;
      map.fillText(title, sx(mid[0]) + 4, sy(mid[1]) - 4);
    }
  }
  if (mapLayers.traffic) {
    for (const t of traffic) {
      const x = t.mesh.position.x;
      const z = t.mesh.position.z;
      if (!visible(x, z)) continue;
      map.save();
      map.translate(sx(x), sy(z));
      map.rotate(-t.mesh.rotation.y);
      map.fillStyle = serviceMapColor(t.kind);
      map.fillRect(-3.5, -2, 7, 4);
      map.restore();
    }
  }
  for (const mesh of parkedCars) {
    const x = mesh.position.x;
    const z = mesh.position.z;
    if (!visible(x, z)) continue;
    map.save();
    map.translate(sx(x), sy(z));
    map.rotate(-mesh.rotation.y);
    map.fillStyle = "#f4f7f2";
    map.fillRect(-3.5, -2, 7, 4);
    map.restore();
  }
  if (walking) {
    map.save();
    map.translate(sx(player.position.x), sy(player.position.z));
    map.fillStyle = "#c4b48a";
    map.fillRect(-4, -2.5, 8, 5);
    map.restore();
  }
  if (mapLayers.people) {
    for (const person of pedestrians) {
      const x = person.mesh.position.x;
      const z = person.mesh.position.z;
      if (!visible(x, z)) continue;
      map.fillStyle = personMapColor(person.service);
      map.beginPath();
      map.arc(sx(x), sy(z), 2.4, 0, Math.PI * 2);
      map.fill();
    }
  }
  if (mapLayers.places) {
    for (const place of city.places || []) {
      map.fillStyle =
        place.kind === "fuel"
          ? "#e07a3d"
          : place.kind === "gym"
            ? "#7eb6d6"
            : place.kind === "school"
              ? "#e6c15a"
              : place.kind === "college"
                ? "#d08a4c"
                : place.kind === "store"
                  ? "#f4efe4"
                  : "#67b36a";
      map.fillRect(sx(place.point[0]) - 4, sy(place.point[1]) - 4, 8, 8);
      if (mapView.size === "max") {
        map.fillStyle = "#f6f3e6";
        map.font = `${Math.max(11, w / 48)}px sans-serif`;
        map.fillText(place.name, sx(place.point[0]) + 8, sy(place.point[1]) - 6);
      }
    }
    city.stops.forEach((stop, index) => {
      const current = index === Math.min(targetIndex, city.stops.length - 1);
      map.fillStyle = current ? "#edbd6d" : "#8d7350";
      map.beginPath();
      map.arc(sx(stop.point[0]), sy(stop.point[1]), current ? 6 : 4, 0, Math.PI * 2);
      map.fill();
      if (mapView.size === "max" || current) {
        map.fillStyle = "#f6f3e6";
        map.font = `${Math.max(11, w / 48)}px sans-serif`;
        map.fillText(stop.name, sx(stop.point[0]) + 8, sy(stop.point[1]) - 6);
      }
    });
  }
  map.fillStyle = "rgba(246, 243, 230, 0.85)";
  map.font = `${Math.max(12, w / 40)}px sans-serif`;
  map.fillText("N", w / 2 - 4, 18);
  map.save();
  map.translate(sx(pos.x), sy(pos.z));
  map.rotate(walking ? -lookYaw : -yaw);
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
    const drive = !blocksDriving(mapView);
    const p = actor().position;
    if (walking) {
      if (playerLife.down && resumeWalking(playerLife, elapsed)) {
        playerLife.down = false;
        playerLife.downUntil = null;
        standMesh(avatar);
      }
      const mobile = resumeWalking(playerLife, elapsed);
      const forward = mobile && drive
        ? (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
          (keys.has("s") || keys.has("arrowdown") ? 1 : 0)
        : 0;
      const strafe = mobile && drive
        ? (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
          (keys.has("a") || keys.has("arrowleft") ? 1 : 0)
        : 0;
      const sprint = drive && keys.has("shift");
      const top = forward || strafe ? footPace(sprint) : 0;
      let wishX = -Math.sin(lookYaw) * forward + Math.cos(lookYaw) * strafe;
      let wishZ = -Math.cos(lookYaw) * forward - Math.sin(lookYaw) * strafe;
      const wish = Math.hypot(wishX, wishZ);
      if (wish > 1e-5) {
        wishX = (wishX / wish) * top;
        wishZ = (wishZ / wish) * top;
      } else {
        wishX = 0;
        wishZ = 0;
      }
      const blend = 1 - Math.exp(-dt * 12);
      walkVel.x += (wishX - walkVel.x) * blend;
      walkVel.z += (wishZ - walkVel.z) * blend;
      if (!forward && !strafe) walkVel.multiplyScalar(Math.exp(-dt * 16));
      const hop = beginJump({ queued: mobile && jumpQueued, y: p.y, vy });
      vy = hop.vy;
      jumpQueued = hop.queued;
      vy -= 24 * dt;
      let nextY = p.y + vy * dt;
      if (nextY <= 0) {
        nextY = 0;
        vy = 0;
      }
      const nx = p.x + walkVel.x * dt;
      const nz = p.z + walkVel.z * dt;
      speed = Math.hypot(walkVel.x, walkVel.z);
      const blocked =
        !mobile ||
        collides(nx, nz, 0.4) ||
        blocksMove(nx, nz, 0.45, [
          ...vehicleSolids(null),
          ...pedestrians.map((ped) => ({ x: ped.x, z: ped.z, radius: 0.45 })),
          ...vehicleObstacles(),
        ]);
      if (!blocked) {
        p.x = nx;
        p.z = nz;
        distanceTravelled += speed * dt;
      } else {
        walkVel.set(0, 0, 0);
        speed = 0;
      }
      p.y = nextY;
      if (speed > 0.25) {
        const face = Math.atan2(-walkVel.x, -walkVel.z);
        const delta = Math.atan2(
          Math.sin(face - avatar.rotation.y),
          Math.cos(face - avatar.rotation.y),
        );
        avatar.rotation.y += delta * (1 - Math.exp(-dt * 10));
      }
      avatar.userData.walk?.(dt, speed);
    } else {
      const accel = drive
        ? (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
          (keys.has("s") || keys.has("arrowdown") ? 1 : 0)
        : 0;
      const steering = drive
        ? (keys.has("a") || keys.has("arrowleft") ? 1 : 0) -
          (keys.has("d") || keys.has("arrowright") ? 1 : 0)
        : 0;
      speed += accel * 12 * dt;
      speed *= Math.exp(-dt * (drive && keys.has(" ") ? 5 : accel ? 0.13 : 0.7));
      speed = THREE.MathUtils.clamp(speed, -9, 38);
      if (Math.abs(speed) > 0.15)
        yaw +=
          steering * dt * Math.min(1.2, Math.abs(speed) * 0.12) * Math.sign(speed || 1);
      const nx = p.x - Math.sin(yaw) * speed * dt,
        nz = p.z - Math.cos(yaw) * speed * dt;
      const hitTraffic = blocksMove(
        nx,
        nz,
        bodyRadius(drivenKind()),
        vehicleSolids(player),
      );
      const victim = pedestrians.find(
        (t) =>
          Math.hypot(nx - t.x, nz - t.z) < bodyRadius(drivenKind()) + bodyRadius("person"),
      );
      if (victim && !victim.down && Math.abs(speed) >= 1.5) {
        const dx = nx - p.x,
          dz = nz - p.z,
          len = Math.hypot(dx, dz) || 1;
        const impact = crashFromImpact(speed);
        settlePerson(
          victim,
          applyImpact(
            {
              health: victim.health ?? 3,
              down: false,
              dead: false,
              x: victim.x,
              z: victim.z,
            },
            impact,
            dx / len,
            dz / len,
          ),
          elapsed,
        );
        speed *= impact.retain;
      }
      if (!collides(nx, nz, 1.4) && !hitTraffic && !victim) {
        p.set(nx, 0, nz);
        distanceTravelled += Math.abs(speed) * dt;
      } else if (!hitTraffic && !victim) speed = -speed * 0.15;
      else speed = 0;
      player.rotation.y = yaw;
      if (player.userData.wheels)
        for (const wheel of player.userData.wheels) wheel.rotation.x -= speed * dt * 2.4;
      emitSmoke(player, Math.abs(speed), dt, player.userData);
    }
    const limit = city.source === "illustrative" ? 900 : 6500;
    if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
      reset();
      toast("You reached the edge of this city patch.");
    }
    for (const agent of traffic) {
      if (!agent.points) continue;
      const probe = advanceAlong(agent, dt);
      const radius = bodyRadius(agent.kind);
      const gate = passage({
        x: probe.x,
        z: probe.z,
        kind: agent.kind,
        people: pedestrians,
        bodies: [
          ...vehicleSolids(agent.mesh),
          walking
            ? { x: avatar.position.x, z: avatar.position.z, radius: 0.45 }
            : { x: player.position.x, z: player.position.z, radius: bodyRadius("player-car") },
        ],
      });
      const victim = gate.hit;
      const playerHit =
        walking &&
        !playerLife.down &&
        Math.hypot(probe.x - avatar.position.x, probe.z - avatar.position.z) <
          radius + 0.45;
      if (victim && !victim.down) {
        const dx = probe.x - agent.x,
          dz = probe.z - agent.z,
          len = Math.hypot(dx, dz) || 1;
        const impact = crashFromImpact(agent.speed);
        settlePerson(
          victim,
          applyImpact(
            {
              health: victim.health ?? 3,
              down: false,
              dead: false,
              x: victim.x,
              z: victim.z,
            },
            impact,
            dx / len,
            dz / len,
          ),
          elapsed,
        );
        agent.speed *= impact.retain;
      } else if (playerHit) {
        const dx = probe.x - agent.x,
          dz = probe.z - agent.z,
          len = Math.hypot(dx, dz) || 1;
        const impact = crashFromImpact(agent.speed);
        hitPlayer(impact, dx / len, dz / len);
        agent.speed *= impact.retain;
      } else if (gate.clear) {
        agent.x = probe.x;
        agent.z = probe.z;
        agent.index = probe.index;
        agent.yaw = probe.yaw;
        agent.mesh.position.set(agent.x, 0, agent.z);
        agent.mesh.rotation.y = agent.yaw || 0;
        if (agent.mesh.userData.wheels)
          for (const wheel of agent.mesh.userData.wheels)
            wheel.rotation.x -= agent.speed * dt * 2.4;
        emitSmoke(agent.mesh, agent.speed, dt, agent);
        if (probe.arrived) beginTrip(agent, agent.endNode);
      }
      agent.hornIn = (agent.hornIn || 0) - dt;
      if (sound && !agent.siren) {
        const near = Math.hypot(agent.x - p.x, agent.z - p.z);
        if (agent.hornIn <= 0 && near < 26) {
          playHorn(agent.body, distanceGain(near) * 0.07);
          agent.hornIn = 5 + agent.rng() * 7;
        }
      }
    }
    for (const ped of pedestrians) {
      if (ped.down && resumeWalking(ped, elapsed)) {
        ped.down = false;
        ped.downUntil = null;
        standMesh(ped.mesh);
      }
      if (!resumeWalking(ped, elapsed)) {
        ped.mesh.position.set(ped.x || 0, 0.2, ped.z || 0);
        ped.mesh.userData.walk?.(0, 0);
        continue;
      }
      if (ped.replyUntil && elapsed < ped.replyUntil) {
        ped.mesh.position.set(ped.x || 0, 0, ped.z || 0);
        ped.mesh.rotation.y = ped.yaw || 0;
        ped.mesh.userData.walk?.(0, 0);
        continue;
      }
      if (ped.service === "junkie") applyWander(ped, dt);
      if (ped.points) {
        const probe = advanceAlong(ped, dt);
        const bodies = vehicleSolids(null);
        for (const other of pedestrians) {
          if (other !== ped) bodies.push({ x: other.x, z: other.z, radius: 0.45 });
        }
        bodies.push({
          x: actor().position.x,
          z: actor().position.z,
          radius: walking ? 0.45 : bodyRadius("player-car"),
        });
        if (!blocksMove(probe.x, probe.z, 0.45, bodies)) {
          ped.x = probe.x;
          ped.z = probe.z;
          ped.index = probe.index;
          ped.yaw = probe.yaw;
          if (probe.arrived) beginTrip(ped, ped.endNode);
        }
      }
      ped.mesh.position.set(ped.x || 0, 0, ped.z || 0);
      ped.mesh.rotation.y = ped.yaw || 0;
      ped.mesh.userData.walk?.(dt, ped.speed || 1.2);
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
  updateEngines(actor().position);
  updateSirens(actor().position);
  const sirenTime = performance.now() / 1000;
  for (const agent of traffic) {
    const lamps = agent.mesh.userData.beacons;
    if (!lamps?.length) continue;
    const lit = beaconLit(agent.siren?.rate || 1, sirenTime + (agent.phase || 0));
    for (const lamp of lamps) lamp.material.emissiveIntensity = lit ? 1.6 : 0.05;
  }
  tickSmoke(dt);
  const p = actor().position;
  if (Math.hypot(p.x - buildingCenter.x, p.z - buildingCenter.y) > 300)
    renderBuildings(p.x, p.z);
  if (active && walking) {
    const rig = thirdPersonRig({ walking: true, view });
    const orbit = rig.overhead ? 0.9 : lookPitch;
    const cosP = Math.cos(orbit);
    desiredCamera.set(
      p.x + Math.sin(lookYaw) * rig.back * cosP,
      p.y + 1.45 + Math.sin(orbit) * rig.back,
      p.z + Math.cos(lookYaw) * rig.back * cosP,
    );
    look.set(
      p.x - Math.sin(lookYaw) * 2.2,
      p.y + 1.35,
      p.z - Math.cos(lookYaw) * 2.2,
    );
  } else if (active) {
    const rig = thirdPersonRig({ walking: false, view });
    desiredCamera.set(
      p.x + Math.sin(yaw) * rig.back,
      p.y + rig.height,
      p.z + Math.cos(yaw) * rig.back,
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
  if (attack > 0) {
    attack = Math.max(0, attack - dt * 3.4);
    if (heldMesh) heldMesh.rotation.x = -attack * 1.35;
    const punching = selectedWeapon(loadout).id === "fists" && attack > 0;
    fist.visible = punching;
    fist.position.z = 0.22 + attack * 0.55;
  }
  if (frame++ % 4 === 0) {
    drawMap();
    $("speed").textContent = String(Math.round(Math.abs(speed) * 3.6)).padStart(
      2,
      "0",
    );
    $("speed-bar").style.width =
      Math.min(100, (Math.abs(speed) / 38) * 100) + "%";
    $("gear").textContent = speed < -0.2 ? "R" : speed > 0.2 ? "D" : "N";
    const who = lookById(lookId).label.toUpperCase();
    $("mode").textContent = walking
      ? playerLife.down
        ? `${who} · DOWN`
        : keys.has("shift")
          ? `${who} · RUN`
          : `${who} · WALK`
      : player.userData.label || "COMPACT SUV";
    paintHealth();
    const nearest = city.stops.reduce((a, b) =>
      Math.hypot(p.x - a.point[0], p.z - a.point[1]) <
      Math.hypot(p.x - b.point[0], p.z - b.point[1])
        ? a
        : b,
    );
    const roadName = roadUnder(p.x, p.z, roadSegments);
    const nearPlace = (city.places || []).find(
      (place) =>
        place.name &&
        Math.hypot(p.x - place.point[0], p.z - place.point[1]) < 45,
    );
    $("district").textContent = nearPlace?.name || roadName || nearest.name;
    if (city.source === "OpenStreetMap")
      document.querySelector(".location small").textContent =
        `${(origin.lat - p.z / 111320).toFixed(4)}° N · ${(origin.lon + p.x / 105500).toFixed(4)}° E`;
  }
  swayCanopies(detailGroup, performance.now() * 0.001);
  composer.render();
}
camera.position.set(150, 65, 230);
animate();
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
// Read-only diagnostics for smoke tests and performance inspection.
const cheatHelp = $("cheat-help");
if (cheatHelp) {
  const labels = {
    weapon: "street weapon",
    armor: "armored carrier",
    car: "parked car",
    health: "refill health",
  };
  cheatHelp.textContent = Object.entries(CHEAT_WORDS)
    .map(([word, effect]) => `${word} (${labels[effect]})`)
    .join(" · ");
}
paintHealth();
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
      lookYaw,
      lookPitch,
      y: avatar.position.y,
      jumpQueued,
      running: walking && keys.has("shift"),
      motorcycles: traffic.filter((t) => t.kind === "motorcycle").length,
      cars: traffic.filter((t) => t.kind === "car").length,
      officers: pedestrians.filter((ped) => ped.service === "police").length,
      junkies: pedestrians.filter((ped) => ped.service === "junkie").length,
      policeCars: traffic.filter((t) => t.kind === "police").length,
      ambulances: traffic.filter((t) => t.kind === "ambulance").length,
      fireEngines: traffic.filter((t) => t.kind === "fire").length,
      places: (city.places || []).map((place) => ({
        name: place.name,
        kind: place.kind,
      })),
      infill: city.infill || 0,
      surveyed: city.surveyed || city.buildings.length,
      playerDown: playerLife.down,
      playerDead: playerLife.dead,
      playerHealth: playerLife.health,
      look: lookId,
      lookName: lookById(lookId).name,
      lookLabel: lookById(lookId).label,
      blood: bloodMarks.map((mark) => ({ x: mark.x, z: mark.z })),
      held: selectedWeapon(loadout).id,
      owned: [...loadout.owned],
      spawned: spawnedRides.map((ride) => ({
        kind: ride.kind,
        x: ride.mesh.position.x,
        z: ride.mesh.position.z,
      })),
      healthText: $("health")?.innerText || "",
      downPeople: pedestrians.filter((ped) => ped.down).length,
      deadPeople: pedestrians.filter((ped) => ped.dead).length,
      mapSize: mapView.size,
      mapFollow: mapView.follow,
      mapFocusX: mapView.focusX,
      mapFocusZ: mapView.focusZ,
      mapZoom: mapView.zoom,
    };
  },
  debug: {
    armCrash() {
      const car = traffic.find((agent) => agent.kind === "car" && agent.points);
      const ped = pedestrians.find((person) => !person.down);
      const dx = -Math.sin(car.yaw || 0),
        dz = -Math.cos(car.yaw || 0);
      ped.x = car.x + dx * 0.7;
      ped.z = car.z + dz * 0.7;
      ped.health = 3;
      ped.down = false;
      ped.dead = false;
      ped.downUntil = null;
      standMesh(ped.mesh);
      ped.mesh.position.set(ped.x, 0, ped.z);
      car.speed = 14;
      return { name: ped.mesh.userData.name, x: ped.x, z: ped.z, speed: car.speed };
    },
    armPlayer() {
      const car = traffic.find((agent) => agent.kind === "car" && agent.points);
      const dx = -Math.sin(car.yaw || 0),
        dz = -Math.cos(car.yaw || 0);
      walking = true;
      avatar.visible = true;
      playerLife.health = 3;
      playerLife.down = false;
      playerLife.dead = false;
      playerLife.downUntil = null;
      standMesh(avatar);
      avatar.position.set(car.x + dx * 0.7, 0, car.z + dz * 0.7);
      car.speed = 14;
      return { speed: car.speed };
    },
    person(name) {
      const ped = pedestrians.find((person) => person.mesh.userData.name === name);
      return ped
        ? {
            down: ped.down,
            dead: ped.dead,
            health: ped.health,
            y: ped.mesh.position.y,
            rotationX: ped.mesh.rotation.x,
          }
        : null;
    },
    grab(id = "pipe") {
      walking = true;
      avatar.visible = true;
      playerLife.down = false;
      playerLife.dead = false;
      loadout = grantWeapon(loadout, id);
      showHeld();
      const drop = weaponDrops.find((item) => item.id === id);
      if (drop) {
        drop.taken = true;
        drop.mesh.visible = false;
      }
      return selectedWeapon(loadout).id;
    },
    cheat(text) {
      return applyCheat(text);
    },
    focus(name) {
      const ped = pedestrians.find((person) => person.mesh.userData.name === name);
      if (!ped) return false;
      walking = true;
      avatar.visible = true;
      avatar.position.set(ped.x + 2.4, 0, ped.z + 3.2);
      lookYaw = Math.atan2(-(ped.x - avatar.position.x), -(ped.z - avatar.position.z));
      lookPitch = 0.42;
      return true;
    },
    body() {
      let skinned = 0;
      const paints = [];
      avatar.updateMatrixWorld(true);
      avatar.traverse((object) => {
        if (object.isSkinnedMesh) skinned += 1;
        if (!object.isMesh || !object.material) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials)
          paints.push(`${material.name}:${material.color?.getHexString?.() || ""}`);
      });
      const size = new THREE.Box3().setFromObject(avatar).getSize(new THREE.Vector3());
      return { skinned, paints, height: size.y, look: lookId, name: avatar.userData.name };
    },
    cars() {
      return carChoices().map((car) => ({
        x: car.x,
        z: car.z,
        label: car.mesh.userData.label,
        speed: car.speed,
        owned: car.mesh === player,
      }));
    },
    aim(yaw, pitch) {
      lookYaw = yaw;
      lookPitch = pitch;
      return { lookYaw, lookPitch };
    },
    stand(x, z) {
      walking = true;
      avatar.visible = true;
      playerLife.down = false;
      playerLife.dead = false;
      standMesh(avatar);
      avatar.position.set(x, 0, z);
      return { x, z, walking };
    },
    moveBody(name, x, z) {
      const ped = pedestrians.find((person) => person.mesh.userData.name === name);
      if (!ped) return null;
      ped.x = x;
      ped.z = z;
      ped.mesh.position.x = x;
      ped.mesh.position.z = z;
      return {
        x: ped.mesh.position.x,
        z: ped.mesh.position.z,
        blood: bloodMarks.map((mark) => ({ x: mark.x, z: mark.z })),
      };
    },
    swingFront() {
      const ped = pedestrians.find((person) => !person.down);
      const fx = -Math.sin(avatar.rotation.y);
      const fz = -Math.cos(avatar.rotation.y);
      ped.x = avatar.position.x + fx * 1.1;
      ped.z = avatar.position.z + fz * 1.1;
      ped.health = 3;
      ped.down = false;
      ped.dead = false;
      ped.downUntil = null;
      standMesh(ped.mesh);
      ped.mesh.position.set(ped.x, 0, ped.z);
      const hit = swingWeapon();
      return {
        hit,
        name: ped.mesh.userData.name,
        down: ped.down,
        dead: ped.dead,
        health: ped.health,
      };
    },
  },
};
