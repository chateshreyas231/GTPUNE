import * as THREE from "three";
import { streetTalk } from "./dialogue.js";

export const GOLDEN_HOUR = 17.7;
export const BLUE_HOUR = 19.35;
export const HOURS_PER_SECOND = 24 / 360;

const STOPS = [
  stop(0, 0x101822, 0x070b14, 0x9bb4d0, 0.05, 0.28, 0x1a2740, 0x14160f, 0.74, 1, 1, 0.0018),
  stop(5.4, 0x182232, 0x101820, 0xc4b09a, 0.08, 0.32, 0x243044, 0x1a1c14, 0.76, 1, 1, 0.0018),
  stop(6.15, 0x5d7384, 0x31485c, 0xf0c2a0, 0.55, 0.7, 0x8aa0b0, 0x3a4038, 0.9, 0.45, 0.35, 0.0015),
  stop(7.2, 0xe2b56e, 0x7f9eb8, 0xffc07a, 2.4, 1.6, 0xf0d8b0, 0x676956, 1.05, 0, 0, 0.0013),
  stop(9, 0xb7d4ea, 0x3d7ec4, 0xfff6e4, 3.2, 2.15, 0xe7f2fb, 0x6d7358, 1.05, 0, 0, 0.00105),
  stop(15.8, 0xb5d3e8, 0x4a88c4, 0xfff3dc, 3.15, 2.1, 0xe7f0f8, 0x6a7058, 1.05, 0, 0, 0.00105),
  stop(16.6, 0xd8c48a, 0x8eabc4, 0xffd0a0, 3.35, 2.2, 0xe7ecde, 0x676956, 1.08, 0, 0, 0.0012),
  stop(17.7, 0xc6c8ac, 0x8ea4b8, 0xffd59b, 3.5, 2.3, 0xe7ecde, 0x676956, 1.1, 0, 0, 0.0013),
  stop(18.5, 0x6a7e8c, 0x355066, 0xf0b48a, 0.9, 1.35, 0xe7ecde, 0x676956, 1.05, 0.4, 0.35, 0.00145),
  stop(19.35, 0x526675, 0x243646, 0xd7c4b0, 0.4, 1, 0xe7ecde, 0x676956, 1.1, 0.75, 0.7, 0.0015),
  stop(21, 0x15202e, 0x0a1018, 0x9bb4d0, 0.08, 0.35, 0x1c2a40, 0x14160f, 0.76, 1, 1, 0.0018),
  stop(24, 0x101822, 0x070b14, 0x9bb4d0, 0.05, 0.28, 0x1a2740, 0x14160f, 0.74, 1, 1, 0.0018),
];

function stop(h, sky, zenith, sunColor, sunIntensity, hemi, hemiSky, hemiGround, exposure, lamps, windows, fogDensity) {
  return { h, sky, zenith, sunColor, sunIntensity, hemi, hemiSky, hemiGround, exposure, lamps, windows, fogDensity };
}

function mixColor(a, b, t) {
  const channel = (shift) => {
    const from = (a >> shift) & 255;
    const to = (b >> shift) & 255;
    return Math.round(from + (to - from) * t);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function wrapHour(hour) {
  const wrapped = hour % 24;
  return wrapped < 0 ? wrapped + 24 : wrapped;
}

export function advanceHour(hour, dt, cycling) {
  const wrapped = wrapHour(hour);
  if (!cycling || !(dt > 0)) return wrapped;
  return wrapHour(wrapped + dt * HOURS_PER_SECOND);
}

export function formatClock(hour) {
  const total = Math.round(wrapHour(hour) * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function phaseForHour(hour) {
  const h = wrapHour(hour);
  if (h >= 21 || h < 5.4) return "night";
  if (h < 6.5 || (h >= 18.4 && h < 21)) return "blue";
  if (h < 8.2 || (h >= 16.4 && h < 18.4)) return "golden";
  return "day";
}

function bodyDirection(hour) {
  const h = wrapHour(hour);
  const y = Math.sin(((h - 6) / 24) * Math.PI * 2);
  const horiz = Math.sqrt(Math.max(0, 1 - y * y));
  const az = ((12 - h) / 24) * Math.PI * 2;
  return { x: horiz * Math.sin(az), y, z: horiz * Math.cos(az) };
}

function sampleStops(hour) {
  const h = wrapHour(hour);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (h > b.h && i < STOPS.length - 2) continue;
    const t = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h || 1)));
    if (t <= 0.0001) return { ...a };
    if (t >= 0.9999) return { ...b };
    return {
      sky: mixColor(a.sky, b.sky, t),
      zenith: mixColor(a.zenith, b.zenith, t),
      sunColor: mixColor(a.sunColor, b.sunColor, t),
      sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
      hemi: a.hemi + (b.hemi - a.hemi) * t,
      hemiSky: mixColor(a.hemiSky, b.hemiSky, t),
      hemiGround: mixColor(a.hemiGround, b.hemiGround, t),
      exposure: a.exposure + (b.exposure - a.exposure) * t,
      lamps: a.lamps + (b.lamps - a.lamps) * t,
      windows: a.windows + (b.windows - a.windows) * t,
      fogDensity: a.fogDensity + (b.fogDensity - a.fogDensity) * t,
    };
  }
  return { ...STOPS[0] };
}

export function skyForHour(hour, rain = false) {
  const phase = phaseForHour(hour);
  const sample = sampleStops(hour);
  const sun = bodyDirection(hour);
  const moon = bodyDirection(wrapHour(hour) + 12);
  const sky = {
    hour: wrapHour(hour),
    phase,
    rain: false,
    ...sample,
    sun,
    moon,
    sunVisible: sun.y > -0.02 && phase !== "night",
    moonVisible: moon.y > 0.08 && (phase === "night" || phase === "blue"),
  };
  if (rain) {
    sky.rain = true;
    sky.sky = mixColor(sky.sky, 0x667068, 0.52);
    sky.zenith = mixColor(sky.zenith, 0x555e58, 0.5);
    sky.sunIntensity *= 0.42;
    sky.hemi *= 0.7;
    sky.exposure *= 0.86;
    sky.fogDensity += 0.00115;
  }
  return sky;
}

export function phaseLabel(phase) {
  return { day: "DAYLIGHT", golden: "GOLDEN HOUR", blue: "BLUE HOUR", night: "NIGHT" }[phase] || "DAYLIGHT";
}

const PLANT_KINDS = ["tree", "tree", "shrub", "tree", "pot", "shrub"];
export function plantVariant(index) {
  const n = Math.abs(index | 0);
  return {
    kind: PLANT_KINDS[n % PLANT_KINDS.length],
    scale: 0.68 + ((n * 17) % 70) / 100,
    tint: n % 4,
  };
}

const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
const shrubGeo = new THREE.DodecahedronGeometry(0.55, 0);
const potGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.38, 7);
const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 1, 6);

export function addPlant(parent, mats, x, z, index) {
  const variant = plantVariant(index);
  const s = variant.scale;
  const leaf = mats.leaf[variant.tint % mats.leaf.length];
  const shrub = mats.shrub[variant.tint % mats.shrub.length];
  const pot = mats.pot[variant.tint % mats.pot.length];
  const put = (geo, mat, y, sx, sy, sz, ox = 0, oz = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + ox, y, z + oz);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  };
  if (variant.kind === "pot") {
    put(potGeo, pot, 0.2 * s, s, s, s);
    put(shrubGeo, shrub, 0.55 * s, 0.75 * s, 0.6 * s, 0.75 * s);
    return variant;
  }
  if (variant.kind === "shrub") {
    put(shrubGeo, shrub, 0.42 * s, 1.35 * s, 0.85 * s, 1.15 * s);
    put(shrubGeo, leaf, 0.68 * s, 0.95 * s, 0.7 * s, 0.85 * s, 0.38 * s, 0.12);
    return variant;
  }
  put(trunkGeo, mats.trunk, 0.9 * s, s, 1.85 * s, s);
  put(canopyGeo, leaf, 2.35 * s, 1.55 * s, 1.75 * s, 1.4 * s);
  if (variant.tint % 2 === 0)
    put(canopyGeo, shrub, 2.8 * s, 1.05 * s, 0.9 * s, 1 * s, 0.45 * s, 0.15);
  return variant;
}

const CRITTER_KINDS = ["dog", "dog", "dog", "dog", "crow", "crow", "pigeon", "pigeon", "crow", "pigeon", "dog", "crow"];
export function seedCritters(points) {
  const sites = points?.length ? points : [{ x: 0, z: 0 }];
  return CRITTER_KINDS.map((kind, i) => {
    const site = sites[i % sites.length];
    return {
      kind,
      homeX: site.x,
      homeZ: site.z,
      x: site.x,
      z: site.z,
      y: kind === "dog" ? 0 : 0.08,
      heading: (i * 1.7) % (Math.PI * 2),
      phase: i * 0.37,
      speed: kind === "dog" ? 0.9 : 0.45,
      moving: false,
      peck: 0,
    };
  });
}

export function tickCritter(c, dt, time) {
  const leash = 6.2;
  const dx = c.x - c.homeX;
  const dz = c.z - c.homeZ;
  const dist = Math.hypot(dx, dz);
  if (dist > leash) c.heading = Math.atan2(c.homeX - c.x, c.homeZ - c.z);
  else c.heading += Math.sin(time * 0.85 + c.phase) * dt * 1.6;
  if (c.kind === "dog") {
    c.moving = Math.sin(time * 0.5 + c.phase) > -0.25;
    const step = c.moving ? c.speed * 1.35 * dt : 0;
    c.x += Math.sin(c.heading) * step;
    c.z += Math.cos(c.heading) * step;
    c.y = 0;
    c.peck = 0;
    return c;
  }
  const flying = c.kind === "crow" && Math.sin(time * 0.35 + c.phase) > 0.72;
  const hopPhase = (time * 1.6 + c.phase) % 1;
  const hopping = hopPhase > 0.78;
  c.moving = flying || hopping;
  if (flying) {
    c.y = 1.3 + Math.sin(time * 4 + c.phase) * 0.35;
    c.x += Math.sin(c.heading) * 2.1 * dt;
    c.z += Math.cos(c.heading) * 2.1 * dt;
    c.peck = 0;
  } else {
    c.y = 0.06 + (hopping ? Math.sin(((hopPhase - 0.78) / 0.22) * Math.PI) * 0.42 : 0);
    if (hopping) {
      c.x += Math.sin(c.heading) * 0.85 * dt;
      c.z += Math.cos(c.heading) * 0.85 * dt;
    }
    c.peck = Math.max(0, Math.sin(time * 6.5 + c.phase));
  }
  return c;
}

export function shouldYield(x, z, player, others, playerRadius = 7, gap = 4.2) {
  if (Math.hypot(x - player.x, z - player.z) < playerRadius) return true;
  return (others || []).some((other) => Math.hypot(x - other.x, z - other.z) < gap);
}

export function vehiclePose(road, t, direction, lane) {
  const dx = (road.b[0] - road.a[0]) / road.length;
  const dz = (road.b[1] - road.a[1]) / road.length;
  const f = direction === 1 ? t : 1 - t;
  const side = lane * road.width * direction;
  return {
    x: road.a[0] + dx * road.length * f + dz * side,
    z: road.a[1] + dz * road.length * f - dx * side,
    yaw: road.angle + (direction === 1 ? Math.PI : 0),
  };
}

export function stepRoadAgent(agent, dt, options) {
  const lane = options.lane ?? 0.22;
  let t = agent.t + (dt * agent.speed) / agent.road.length;
  let road = agent.road;
  let direction = agent.direction;
  if (t > 1) {
    const endpoint = direction === 1 ? road.b : road.a;
    const exits = (options.adjacency.get(options.nodeKey(endpoint)) || []).filter(
      (segment) => segment !== road,
    );
    if (exits.length) {
      road = exits[Math.abs(Math.floor(options.pick || 0)) % exits.length];
      direction = options.nodeKey(road.a) === options.nodeKey(endpoint) ? 1 : -1;
    } else direction *= -1;
    t = 0;
  }
  const pose = vehiclePose(road, t, direction, lane);
  if (
    shouldYield(pose.x, pose.z, options.player, options.others, options.playerRadius, options.gap)
  ) {
    return {
      ...agent,
      held: true,
      pose: vehiclePose(agent.road, agent.t, agent.direction, lane),
    };
  }
  return { ...agent, t, road, direction, held: false, pose };
}

export function sidewalkSites(roads, limit, inset = 2.4, step = 38, center) {
  const sites = [];
  for (const road of roads) {
    if (!road || road.length < 18) continue;
    const dx = (road.b[0] - road.a[0]) / road.length;
    const dz = (road.b[1] - road.a[1]) / road.length;
    const stride = center ? Math.max(step, road.length / 8) : step;
    for (let t = 10; t < road.length; t += stride) {
      for (const side of center ? [-1, 1] : [sites.length % 2 === 0 ? 1 : -1]) {
        sites.push({
          x: road.a[0] + dx * t + dz * (road.width / 2 + inset) * side,
          z: road.a[1] + dz * t - dx * (road.width / 2 + inset) * side,
          yaw: road.angle || Math.atan2(dx, dz),
        });
        if (!center && sites.length >= limit) return sites;
      }
    }
  }
  if (center) {
    sites.sort(
      (a, b) =>
        Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b.x - center.x, b.z - center.z),
    );
  }
  return sites.slice(0, limit);
}

const BIKE_COLORS = [0x314556, 0xb94b3a, 0x1e6a45, 0xd1b15a, 0x4c3b6e];
export function parkedBikeSpots(roads, limit = 18, center) {
  return sidewalkSites(roads, limit, 1.7, 34, center).map((spot, i) => ({
    ...spot,
    color: BIKE_COLORS[i % BIKE_COLORS.length],
    yaw: spot.yaw + (i % 2 ? 0.5 : -0.35),
  }));
}

export const GROUP_SLOTS = [
  [4, 2],
  [10, 3],
  [16, 2],
  [28, 2],
  [34, 3],
  [46, 2],
  [58, 3],
  [64, 2],
];

export function claimGroups(people) {
  const groups = [];
  for (const [start, size] of GROUP_SLOTS) {
    if (start + size > people.length) continue;
    const members = people.slice(start, start + size);
    let x = 0;
    let z = 0;
    for (const person of members) {
      x += person.start.x;
      z += person.start.z;
    }
    x /= size;
    z /= size;
    const group = { members, x, z, line: groups.length };
    members.forEach((person, index) => {
      const angle = (index / size) * Math.PI * 2 + 0.4;
      person.group = group;
      person.slot = index;
      person.start.x = x + Math.cos(angle) * 0.9;
      person.start.z = z + Math.sin(angle) * 0.9;
      if (person.mesh?.position) {
        person.mesh.position.x = person.start.x;
        person.mesh.position.z = person.start.z;
      }
    });
    groups.push(group);
  }
  return groups;
}

export function faceYaw(x, z, tx, tz) {
  return Math.atan2(tx - x, tz - z) + Math.PI;
}

export function nearbyTalk({ groups, x, z, lang, time, playerTalking, range = 14 }) {
  if (playerTalking || !groups?.length) return null;
  let best = null;
  let bestD = range;
  for (const group of groups) {
    const d = Math.hypot(x - group.x, z - group.z);
    if (d < bestD) {
      best = group;
      bestD = d;
    }
  }
  if (!best) return null;
  const pack = streetTalk[lang] || streetTalk["en-IN"];
  const pair = pack[Math.abs(best.line) % pack.length];
  const who = Math.floor(Math.max(0, time) / 3.4) % 2;
  return { text: pair[who], who, distance: bestD };
}

export function windowSpots(buildings, cx, cz, limit = 36) {
  const ranked = buildings
    .map((building) => ({
      building,
      d: Math.hypot((building.minX + building.maxX) / 2 - cx, (building.minZ + building.maxZ) / 2 - cz),
    }))
    .filter((entry) => entry.d < 140 && entry.building.height > 6 && entry.building.points?.length >= 3)
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);
  const spots = [];
  for (const { building } of ranked) {
    const edge = outwardEdge(building);
    if (!edge) continue;
    const cols = Math.min(4, Math.max(2, Math.floor(edge.len / 4)));
    const rows = Math.min(3, Math.max(1, Math.floor(building.height / 4)));
    for (let row = 0; row < rows && spots.length < limit; row++) {
      for (let col = 0; col < cols && spots.length < limit; col++) {
        const u = (col + 0.5) / cols;
        spots.push({
          x: edge.a[0] + (edge.b[0] - edge.a[0]) * u + edge.nx * 0.35,
          y: 2.2 + row * 3.1,
          z: edge.a[1] + (edge.b[1] - edge.a[1]) * u + edge.nz * 0.35,
          yaw: Math.atan2(edge.nx, edge.nz),
        });
      }
    }
  }
  return spots;
}

function outwardEdge(building) {
  const pts = building.points;
  let cx = 0;
  let cz = 0;
  for (const point of pts) {
    cx += point[0];
    cz += point[1];
  }
  cx /= pts.length;
  cz /= pts.length;
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 8 || (best && len <= best.len)) continue;
    let nx = (b[1] - a[1]) / len;
    let nz = -(b[0] - a[0]) / len;
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    if ((cx - mx) * nx + (cz - mz) * nz > 0) {
      nx = -nx;
      nz = -nz;
    }
    best = { a, b, len, nx, nz };
  }
  return best;
}

function paintDisc(draw) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeSunSprite() {
  const map = paintDisc((ctx) => {
    const glow = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    glow.addColorStop(0, "rgba(255,248,220,1)");
    glow.addColorStop(0.35, "rgba(255,214,120,0.95)");
    glow.addColorStop(1, "rgba(255,180,70,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 128, 128);
  });
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false }),
  );
  sprite.scale.set(180, 180, 1);
  return sprite;
}

export function makeMoonSprite() {
  const map = paintDisc((ctx) => {
    ctx.fillStyle = "#f3f0e4";
    ctx.beginPath();
    ctx.arc(64, 64, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d5d0c2";
    for (const [x, y, r] of [
      [50, 54, 7],
      [74, 70, 5],
      [60, 78, 4],
      [78, 48, 3],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false }),
  );
  sprite.scale.set(84, 84, 1);
  return sprite;
}

function part(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function makeDog(index) {
  const coat = [0x8d5a34, 0xc4a36c, 0x2a241f, 0xb7b3a6][index % 4];
  const fur = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.86 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x241c16, roughness: 0.7 });
  const group = new THREE.Group();
  part(group, new THREE.BoxGeometry(0.72, 0.28, 0.26), fur, 0, 0.38, 0);
  const head = part(group, new THREE.BoxGeometry(0.24, 0.2, 0.2), fur, 0, 0.5, -0.28);
  part(head, new THREE.BoxGeometry(0.1, 0.08, 0.12), dark, 0, -0.02, -0.12);
  part(group, new THREE.BoxGeometry(0.08, 0.1, 0.05), fur, -0.07, 0.62, -0.3);
  part(group, new THREE.BoxGeometry(0.08, 0.1, 0.05), fur, 0.07, 0.62, -0.3);
  const legs = [];
  for (const [x, z] of [
    [-0.18, -0.2],
    [0.18, -0.2],
    [-0.18, 0.2],
    [0.18, 0.2],
  ]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.28, z);
    group.add(leg);
    part(leg, new THREE.BoxGeometry(0.08, 0.24, 0.08), fur, 0, -0.1, 0);
    legs.push(leg);
  }
  const tail = part(group, new THREE.BoxGeometry(0.06, 0.06, 0.28), fur, 0, 0.48, 0.32);
  group.userData.pose = (time, critter) => {
    tail.rotation.x = -0.6 + Math.sin(time * 8 + critter.phase) * 0.45;
    legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(time * 7 + i * Math.PI) * (critter.moving ? 0.45 : 0.04);
    });
  };
  return group;
}

export function makeBird(kind, index) {
  const crow = kind === "crow";
  const bodyColor = crow ? 0x1b1d20 : 0xa7ada8;
  const accent = crow ? 0x111214 : 0x6f8f84;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.8 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7 });
  const beakMat = new THREE.MeshStandardMaterial({ color: crow ? 0x2a2a28 : 0xc4553a, roughness: 0.6 });
  const group = new THREE.Group();
  part(group, new THREE.SphereGeometry(0.16, 8, 6), bodyMat, 0, 0.2, 0).scale.set(1, 0.75, 1.35);
  const head = part(group, new THREE.SphereGeometry(0.09, 8, 6), accentMat, 0, 0.3, -0.14);
  part(head, new THREE.ConeGeometry(0.03, 0.1, 5), beakMat, 0, 0, -0.1, Math.PI / 2, 0, 0);
  const wings = [-1, 1].map((side) =>
    part(group, new THREE.BoxGeometry(0.22, 0.03, 0.12), bodyMat, side * 0.16, 0.22, 0),
  );
  group.userData.pose = (time, critter) => {
    const flap = critter.y > 0.5 ? 0.9 : 0.18;
    wings.forEach((wing, i) => {
      wing.rotation.z = Math.sin(time * (critter.y > 0.5 ? 14 : 4) + critter.phase) * flap * (i ? -1 : 1);
    });
    head.rotation.x = (critter.peck || 0) * 0.9;
  };
  group.scale.setScalar(crow ? 1 : 0.86);
  return group;
}

export function makeBicycle(color = 0x314556) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22282a, roughness: 0.72 });
  const wheel = new THREE.TorusGeometry(0.34, 0.028, 6, 14);
  part(group, wheel, dark, 0, 0.34, -0.58);
  part(group, wheel, dark, 0, 0.34, 0.58);
  part(group, new THREE.CylinderGeometry(0.02, 0.02, 1.2, 5), metal, 0, 0.5, 0, Math.PI / 2.6, 0, 0);
  part(group, new THREE.CylinderGeometry(0.016, 0.016, 0.46, 4), metal, 0, 0.58, 0.58);
  part(group, new THREE.BoxGeometry(0.08, 0.05, 0.28), dark, 0, 0.74, -0.16);
  part(group, new THREE.BoxGeometry(0.36, 0.03, 0.04), metal, 0, 0.8, 0.62);
  return group;
}

export function makeScooter(color = 0xc4553a) {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x202426, roughness: 0.62 });
  const wheel = new THREE.TorusGeometry(0.28, 0.04, 6, 12);
  part(group, wheel, dark, 0, 0.28, -0.62);
  part(group, wheel, dark, 0, 0.28, 0.72);
  part(group, new THREE.BoxGeometry(0.32, 0.08, 0.95), body, 0, 0.38, 0.05);
  part(group, new THREE.BoxGeometry(0.36, 0.46, 0.22), body, 0, 0.64, 0.7);
  part(group, new THREE.BoxGeometry(0.24, 0.1, 0.36), dark, 0, 0.64, -0.22);
  part(group, new THREE.BoxGeometry(0.42, 0.03, 0.05), dark, 0, 0.92, 0.82);
  part(group, new THREE.BoxGeometry(0.16, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xffe1a8, emissive: 0xffd27a, emissiveIntensity: 0.4 }), 0, 0.58, 0.82);
  return group;
}
