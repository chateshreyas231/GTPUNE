import * as THREE from "three";
import { segmentDistance } from "./city.js";

// Carriageway sits a little below the footpath. The kerb wall closes the step
// so the pavement meets the road instead of floating beside it.
export const ROAD_Y = 0.045;
export const WALK_Y = 0.12;

export const STALL_NAMES = [
  "Kaka Chi Chaha",
  "Misal Point",
  "Vada Pav Wala",
  "Bhajiya Cart",
  "Nariyal Pani",
  "Bhel Corner",
];

export const SHOP_NAMES = [
  "Sagar Kirana",
  "Om Footwear",
  "New Poona Stores",
  "Ganesh Laundry",
  "Shivaji Snacks",
  "Asha Stationery",
  "Pune Pan Shop",
  "Meera General",
];

const BANNED =
  /starbucks|mcdonald|domino|kfc|burger\s*king|dmart|reliance|chitale|kayani|ccd|cafe\s*coffee|subway|pizza\s*hut/i;

const pitMaterial = new THREE.MeshStandardMaterial({
  color: 0x1c1916,
  roughness: 1,
});
const rimMaterial = new THREE.MeshStandardMaterial({
  color: 0x4e4840,
  roughness: 1,
});

function cleanPoints(points) {
  const clean = [];
  for (const p of points || []) {
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    if (
      !clean.length ||
      Math.hypot(p[0] - clean.at(-1)[0], p[1] - clean.at(-1)[1]) > 0.2
    )
      clean.push(p);
  }
  return clean;
}

// Left of the direction of travel is positive. A negative distance offsets right.
export function offsetPolyline(points, distance) {
  const clean = cleanPoints(points);
  if (clean.length < 2) return [];
  const normals = [];
  for (let i = 1; i < clean.length; i++) {
    const dx = clean[i][0] - clean[i - 1][0];
    const dz = clean[i][1] - clean[i - 1][1];
    const len = Math.hypot(dx, dz) || 1;
    normals.push([dz / len, -dx / len]);
  }
  const out = [];
  for (let i = 0; i < clean.length; i++) {
    let nx;
    let nz;
    if (i === 0) {
      nx = normals[0][0];
      nz = normals[0][1];
    } else if (i === clean.length - 1) {
      nx = normals[i - 1][0];
      nz = normals[i - 1][1];
    } else {
      const n0 = normals[i - 1];
      const n1 = normals[i];
      nx = n0[0] + n1[0];
      nz = n0[1] + n1[1];
      const mag = Math.hypot(nx, nz);
      if (mag < 1e-4) {
        nx = n0[0];
        nz = n0[1];
      } else {
        nx /= mag;
        nz /= mag;
        const dot = nx * n0[0] + nz * n0[1];
        const scale = Math.min(2.5, 1 / Math.max(0.4, dot));
        nx *= scale;
        nz *= scale;
      }
    }
    out.push([clean[i][0] + nx * distance, clean[i][1] + nz * distance]);
  }
  return out;
}

export function sidewalkRibbons(points, width, sidewalk) {
  const half = Math.max(0.4, width / 2);
  const walk = Math.max(0.4, sidewalk);
  const left = offsetPolyline(points, half);
  const right = offsetPolyline(points, -half);
  return {
    carriage: { left, right },
    left: { inner: left, outer: offsetPolyline(points, half + walk) },
    right: { inner: right, outer: offsetPolyline(points, -(half + walk)) },
  };
}

function facesUp(a, b, c) {
  return (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0.02;
}

export function ribbonPositions(left, right, y) {
  const data = [];
  const n = Math.min(left?.length || 0, right?.length || 0);
  for (let i = 0; i < n - 1; i++) {
    const a = left[i],
      c = left[i + 1],
      b = right[i],
      d = right[i + 1];
    if (facesUp(a, b, c))
      data.push(a[0], y, a[1], b[0], y, b[1], c[0], y, c[1]);
    if (facesUp(b, d, c))
      data.push(b[0], y, b[1], d[0], y, d[1], c[0], y, c[1]);
  }
  return data;
}

export function wallPositions(edge, y0, y1) {
  const data = [];
  for (let i = 0; i < (edge?.length || 0) - 1; i++) {
    const a = edge[i],
      b = edge[i + 1];
    data.push(
      a[0],
      y0,
      a[1],
      b[0],
      y0,
      b[1],
      a[0],
      y1,
      a[1],
      b[0],
      y0,
      b[1],
      b[0],
      y1,
      b[1],
      a[0],
      y1,
      a[1],
    );
  }
  return data;
}

export function runsNear(points, cx, cz, radius) {
  const source = points || [];
  const keep = source.map((p, i) => {
    if (Math.hypot(p[0] - cx, p[1] - cz) <= radius) return true;
    if (i > 0 && segmentDistance(cx, cz, source[i - 1], p) <= radius) return true;
    if (
      i + 1 < source.length &&
      segmentDistance(cx, cz, p, source[i + 1]) <= radius
    )
      return true;
    return false;
  });
  const runs = [];
  let run = [];
  for (let i = 0; i < source.length; i++) {
    if (keep[i]) run.push(source[i]);
    else if (run.length) {
      if (run.length >= 2) runs.push(run);
      run = [];
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

export function potholeMarks(points, width, spacing = 34) {
  const clean = cleanPoints(points);
  const marks = [];
  const half = Math.max(0.45, width / 2 - 0.75);
  let travelled = 0;
  let next = 12;
  for (let i = 1; i < clean.length; i++) {
    const ax = clean[i - 1][0],
      az = clean[i - 1][1],
      bx = clean[i][0],
      bz = clean[i][1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.3) continue;
    const dx = (bx - ax) / len,
      dz = (bz - az) / len,
      px = dz,
      pz = -dx;
    while (next < travelled + len && marks.length < 80) {
      const along = next - travelled;
      const side = marks.length % 2 ? 1 : -1;
      const lateral = side * half * (0.35 + (marks.length % 3) * 0.18);
      marks.push({
        x: ax + dx * along + px * lateral,
        z: az + dz * along + pz * lateral,
        yaw: Math.atan2(dx, dz),
        lateral,
        rx: 1.05 + (marks.length % 3) * 0.16,
        rz: 0.68 + (marks.length % 2) * 0.12,
      });
      next += spacing;
    }
    travelled += len;
  }
  return marks;
}

export function makePothole(mark = {}) {
  const g = new THREE.Group();
  g.name = "pothole";
  const pit = new THREE.Mesh(new THREE.CircleGeometry(0.46, 7), pitMaterial);
  pit.name = "pit";
  pit.rotation.x = -Math.PI / 2;
  pit.scale.set(mark.rx || 1.15, mark.rz || 0.72, 1);
  pit.position.y = 0.02;
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.5, 7), rimMaterial);
  rim.name = "rim";
  rim.rotation.x = -Math.PI / 2;
  rim.scale.copy(pit.scale);
  rim.position.y = 0.028;
  g.add(pit, rim);
  return g;
}

function pushSpot(spots, x, z, dx, dz, side, cx, cz, blocked) {
  const away = Math.hypot(x - cx, z - cz);
  if (away < 12 || away > 150) return;
  if (blocked(x, z)) return;
  let yaw = Math.atan2(dx, dz);
  if (side < 0) yaw += Math.PI;
  spots.push({ x, z, yaw, side });
}

function gatherSpots(segments, cx, cz, blocked) {
  const spots = [];
  for (const r of segments || []) {
    const sidewalk = r.sidewalk ?? 1.6;
    const lateral = (r.width || 7) / 2 + Math.min(sidewalk * 0.55, sidewalk - 0.3);
    if (r.points?.length >= 2) {
      const pts = r.points;
      let total = 0;
      let near = false;
      for (let i = 1; i < pts.length; i++) {
        total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (segmentDistance(cx, cz, pts[i - 1], pts[i]) < 160) near = true;
      }
      if (!near || total < 28) continue;
      let travelled = 0;
      let next = 16;
      for (let i = 1; i < pts.length && next < total - 10; i++) {
        const a = pts[i - 1],
          b = pts[i];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.3) continue;
        const dx = (b[0] - a[0]) / len,
          dz = (b[1] - a[1]) / len;
        while (next < travelled + len && next < total - 10) {
          const along = next - travelled;
          const x = a[0] + dx * along,
            z = a[1] + dz * along;
          for (const side of [1, -1])
            pushSpot(
              spots,
              x + dz * lateral * side,
              z - dx * lateral * side,
              dx,
              dz,
              side,
              cx,
              cz,
              blocked,
            );
          next += 22;
        }
        travelled += len;
      }
      continue;
    }
    if ((r.length || 0) < 28) continue;
    if (segmentDistance(cx, cz, r.a, r.b) > 160) continue;
    const dx = (r.b[0] - r.a[0]) / r.length,
      dz = (r.b[1] - r.a[1]) / r.length;
    for (const side of [1, -1])
      for (let t = 16; t < r.length - 10; t += 22)
        pushSpot(
          spots,
          r.a[0] + dx * t + dz * lateral * side,
          r.a[1] + dz * t - dx * lateral * side,
          dx,
          dz,
          side,
          cx,
          cz,
          blocked,
        );
  }
  return spots;
}

function buildingCenter(building) {
  if (
    Number.isFinite(building?.minX) &&
    Number.isFinite(building?.maxX) &&
    Number.isFinite(building?.minZ) &&
    Number.isFinite(building?.maxZ)
  )
    return [
      (building.minX + building.maxX) / 2,
      (building.minZ + building.maxZ) / 2,
    ];
  return null;
}

export function shopLabel(building, index) {
  const name = String(building?.name || "").trim();
  if (name && !BANNED.test(name)) return name;
  return SHOP_NAMES[Math.abs(index) % SHOP_NAMES.length];
}

function nearestShopName(buildings, x, z, index) {
  let best = null;
  let bestD = 42;
  for (const building of buildings || []) {
    const name = String(building?.name || "").trim();
    if (!name || BANNED.test(name)) continue;
    const centre = buildingCenter(building);
    if (!centre) continue;
    const dist = Math.hypot(centre[0] - x, centre[1] - z);
    if (dist < bestD) {
      bestD = dist;
      best = building;
    }
  }
  return shopLabel(best, index);
}

export function cornerPlans(
  segments,
  cx,
  cz,
  blocked = () => false,
  buildings = [],
) {
  let spots = gatherSpots(segments, cx, cz, blocked);
  if (spots.length < 11) {
    const extra = gatherSpots(segments, cx, cz, () => false);
    const seen = new Set(spots.map((s) => `${s.x.toFixed(1)}:${s.z.toFixed(1)}`));
    for (const spot of extra) {
      const key = `${spot.x.toFixed(1)}:${spot.z.toFixed(1)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      spots.push(spot);
    }
  }
  const construction = [];
  const stalls = [];
  const shops = [];
  spots.forEach((spot, index) => {
    const role = index % 5;
    if (role === 0 && construction.length < 3)
      construction.push({ ...spot, kind: "construction" });
    else if ((role === 1 || role === 2) && stalls.length < 4)
      stalls.push({
        ...spot,
        kind: "stall",
        name: STALL_NAMES[stalls.length % STALL_NAMES.length],
      });
    else if (shops.length < 4)
      shops.push({
        ...spot,
        kind: "shop",
        name: nearestShopName(buildings, spot.x, spot.z, shops.length),
      });
  });
  return { construction, stalls, shops };
}

function mat(color, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function addBox(parent, w, h, d, color, x, y, z, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

export function makeConstruction() {
  const g = new THREE.Group();
  g.name = "construction";
  const barrier = new THREE.Group();
  barrier.name = "barrier";
  for (const z of [-1.15, 0, 1.15]) {
    addBox(barrier, 0.08, 0.85, 0.08, 0xe07a2f, -0.55, 0.42, z - 0.5);
    addBox(barrier, 0.08, 0.85, 0.08, 0xe07a2f, -0.55, 0.42, z + 0.5);
    addBox(barrier, 0.05, 0.14, 1.05, 0xe07a2f, -0.55, 0.38, z);
    addBox(barrier, 0.05, 0.12, 1.05, 0xf4f1e8, -0.55, 0.68, z);
  }
  const sand = new THREE.Mesh(
    new THREE.ConeGeometry(0.72, 0.58, 8),
    mat(0xc6a15a, 1),
  );
  sand.name = "sand";
  sand.position.set(0.2, 0.29, 1.35);
  sand.castShadow = true;
  const scaffold = new THREE.Group();
  scaffold.name = "scaffold";
  for (const x of [0.15, 0.7])
    for (const z of [-0.55, 0.55]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 3.15, 6),
        mat(0x8a8478, 0.55),
      );
      pole.position.set(x, 1.57, z);
      pole.castShadow = true;
      scaffold.add(pole);
    }
  addBox(scaffold, 0.7, 0.06, 1.35, 0xa67c52, 0.42, 1.55, 0);
  addBox(scaffold, 0.7, 0.06, 1.35, 0xa67c52, 0.42, 2.75, 0);
  const brace = addBox(scaffold, 0.05, 0.05, 1.5, 0x8a8478, 0.42, 2.1, 0);
  brace.rotation.x = 0.7;
  g.add(barrier, sand, scaffold);
  return g;
}

function namedBoard(name, w, h, boardName) {
  let material;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f3e6c4";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#2a2118";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.length > 18 ? name.slice(0, 17) + "…" : name, 128, 34);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  } else material = mat(0xf3e6c4, 0.7);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), material);
  mesh.name = boardName;
  mesh.userData.label = name;
  return mesh;
}

export function makeFoodStall(plan = {}) {
  const g = new THREE.Group();
  g.name = "food-stall";
  const name = plan.name || STALL_NAMES[0];
  g.userData.name = name;
  const cloth = plan.name === "Misal Point" || plan.name === "Bhel Corner" ? 0xa33b32 : 0x2f5a45;
  addBox(g, 0.72, 0.86, 1.7, 0x7a5a3a, 0, 0.43, 0, "counter");
  addBox(g, 1.05, 0.07, 1.9, cloth, -0.1, 2.05, 0, "canopy");
  for (const z of [-0.8, 0.8]) {
    addBox(g, 0.05, 2.05, 0.05, 0x4d4338, -0.42, 1.02, z);
    addBox(g, 0.05, 2.05, 0.05, 0x4d4338, 0.42, 1.02, z);
  }
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.14, 0.22, 8),
    mat(0xd7d2cb, 0.45),
  );
  pot.position.set(0.15, 0.97, 0.05);
  g.add(pot);
  const sign = namedBoard(name, 1.15, 0.28, "stall-sign");
  sign.position.set(-0.15, 1.82, 0);
  g.add(sign);
  return g;
}

export function makeShopFront(plan = {}) {
  const g = new THREE.Group();
  g.name = "shop-front";
  const name = plan.name || SHOP_NAMES[0];
  g.userData.name = name;
  addBox(g, 0.16, 2.2, 2.3, 0x6d4038, 0.4, 1.1, 0, "shutter");
  addBox(g, 1.05, 0.07, 2.35, 0xc4892b, -0.15, 2.28, 0);
  addBox(g, 0.9, 0.08, 1.5, 0x8d6a45, -0.2, 0.85, 0);
  const sign = namedBoard(name, 1.5, 0.32, "shop-sign");
  sign.position.set(-0.1, 2.02, 0);
  g.add(sign);
  return g;
}

export function sellerPose(plan) {
  return {
    x: plan.x - Math.cos(plan.yaw) * 0.55,
    z: plan.z + Math.sin(plan.yaw) * 0.55,
    yaw: plan.yaw - Math.PI / 2,
  };
}

export function sellerIndex(stallIndex) {
  return [3, 4, 5, 11][Math.abs(stallIndex) % 4];
}

export function smokerSlots(total) {
  return [3, 8, 14, 21, 27].filter((i) => i > 0 && i < total).slice(0, 4);
}

export function makeCigarette() {
  const g = new THREE.Group();
  g.name = "cigarette";
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.075, 5),
    mat(0xf2efe6, 0.65),
  );
  stick.name = "cigarette-stick";
  stick.rotation.z = 1.15;
  stick.position.set(0.12, 1.45, -0.24);
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 5, 4),
    new THREE.MeshStandardMaterial({
      color: 0xd4552a,
      emissive: 0x7a220c,
      emissiveIntensity: 0.55,
      roughness: 0.5,
    }),
  );
  tip.name = "cigarette-tip";
  tip.position.set(0.16, 1.47, -0.28);
  g.add(stick, tip);
  return g;
}

export function makeSmokeWisp() {
  const g = new THREE.Group();
  g.name = "smoke-wisp";
  g.position.set(0.16, 1.48, -0.28);
  const puffs = [];
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 5, 4),
      new THREE.MeshBasicMaterial({
        color: 0xc5c5c5,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    puff.name = "wisp";
    g.add(puff);
    puffs.push(puff);
  }
  g.userData.puffs = puffs;
  return g;
}

export function tickWisp(wisp, time) {
  const puffs = wisp?.userData?.puffs;
  if (!puffs) return;
  for (let i = 0; i < puffs.length; i++) {
    const puff = puffs[i];
    const t = (time * 0.65 + i * 0.37) % 1;
    puff.position.y = 0.04 + t * 0.55;
    puff.position.x = Math.sin(time * 1.4 + i) * 0.03;
    puff.material.opacity = 0.26 * (1 - t);
    puff.scale.setScalar(0.4 + t * 0.9);
  }
}

export function smogGrade(night = false) {
  if (night)
    return {
      background: 0x526675,
      fog: 0x5a6864,
      density: 0.00255,
      horizon: 0x45564f,
      top: 0x6d8796,
    };
  return {
    background: 0xd4d2bc,
    fog: 0xc2b79a,
    density: 0.00215,
    horizon: 0xc4b496,
    top: 0xf6f3e6,
  };
}

export function isLightHaze(grade) {
  if (!grade || !(grade.density > 0)) return false;
  const r = (grade.fog >> 16) & 255;
  const g = (grade.fog >> 8) & 255;
  const b = grade.fog & 255;
  const nearWhite = r > 235 && g > 235 && b > 235;
  return grade.density > 0.0014 && grade.density < 0.0055 && !nearWhite;
}

export function exhaustPuff() {
  return {
    minSpeed: 0.8,
    wait: 0.12,
    life: 0.72,
    opacity: 0.55,
    scale: 0.52,
    rise: 1.15,
    grow: 1.7,
    color: 0xb5b5b5,
  };
}
