import * as THREE from "three";
import { segmentDistance, streetHeight } from "./city.js";

// Shared shapes. Each placed copy is cloned before it is merged.
const leafGeo = new THREE.SphereGeometry(1, 7, 5);
const trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 4.1, 6);
const wheelGeo = new THREE.TorusGeometry(0.34, 0.035, 5, 10);
const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 6);
const potGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.32, 7);

// Slow canopy wind. The same numbers drive the vertex shader and leafSway().
const WIND = {
  base: 0.35,
  lift: 0.65,
  low: 0.4,
  high: 3.5,
  gustAmp: 0.28,
  rustleAmp: 0.045,
  gustZ: 0.14,
  rustleZ: 0.03,
};
export const windTime = { value: 0 };

function windMask(y) {
  const t = Math.min(1, Math.max(0, (y - WIND.low) / (WIND.high - WIND.low)));
  const smooth = t * t * (3 - 2 * t);
  return WIND.base + WIND.lift * smooth;
}

export function leafSway(x, y, z, time) {
  const mask = windMask(y);
  const gust = Math.sin(time * 0.65 + x * 0.15 + z * 0.12);
  const rustle = Math.sin(time * 2.3 + x * 2.8 + y * 1.9 + z * 2.4);
  return {
    x: (gust * WIND.gustAmp + rustle * WIND.rustleAmp) * mask,
    z: (Math.cos(time * 0.5 + z * 0.15) * WIND.gustZ + rustle * WIND.rustleZ) * mask,
  };
}

const windChunk = `
float puneT = clamp((transformed.y - ${WIND.low}) / ${WIND.high - WIND.low}, 0.0, 1.0);
float puneS = puneT * puneT * (3.0 - 2.0 * puneT);
float puneH = ${WIND.base} + ${WIND.lift} * puneS;
float puneGust = sin(uWind * 0.65 + transformed.x * 0.15 + transformed.z * 0.12);
float puneRustle = sin(uWind * 2.3 + transformed.x * 2.8 + transformed.y * 1.9 + transformed.z * 2.4);
transformed.x += (puneGust * ${WIND.gustAmp} + puneRustle * ${WIND.rustleAmp}) * puneH;
transformed.z += (cos(uWind * 0.5 + transformed.z * 0.15) * ${WIND.gustZ} + puneRustle * ${WIND.rustleZ}) * puneH;`;

export function attachLeafWind(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>${windChunk}`);
  };
  material.customProgramCacheKey = () => "pune-leaf-wind";
  return material;
}

function bake(parent, group) {
  group.updateMatrixWorld(true);
  for (const child of group.children) {
    if (!child.isMesh) continue;
    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    const mesh = new THREE.Mesh(geometry, child.material);
    mesh.name = child.name;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
  }
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function plantTree(parent, x, z, scale = 1, mats, seed = 0, planter = false) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  const trunk = new THREE.Mesh(trunkGeo, mats.wood);
  trunk.name = "trunk";
  trunk.position.y = 2.05;
  g.add(trunk);
  if (planter && (mats.planter || mats.concrete)) {
    const base = new THREE.Mesh(potGeo, mats.planter || mats.concrete);
    base.name = "planter";
    base.position.y = 0.16;
    base.scale.set(1.6, 0.75, 1.6);
    g.add(base);
  }
  const clumps = [
    [0, 5.05, 0, 1.05, 0.82],
    [1.35, 3.75, 0.2, 1.42, 0.95],
    [-1.28, 3.9, 0.45, 1.32, 0.9],
    [0.25, 4.05, -1.32, 1.36, 0.88],
    [-0.2, 4.45, 1.22, 1.18, 0.78],
  ];
  clumps.forEach(([x0, y0, z0, sx, sy], n) => {
    const leaf = new THREE.Mesh(leafGeo, n % 2 ? mats.leaf : mats.leaf2 || mats.leaf);
    leaf.name = "leaf";
    leaf.position.set(x0 + Math.cos(seed + n) * 0.12, y0, z0 + Math.sin(seed + n) * 0.12);
    leaf.scale.set(sx, sy, sx * 0.92);
    g.add(leaf);
  });
  bake(parent, g);
}

// Original street props. Placement follows the road already in the map.
export function streetDetails(cx, cz, roads, blocked, buildings = []) {
  const root = new THREE.Group();
  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x61513a, roughness: 0.9 }),
    leaf: attachLeafWind(
      new THREE.MeshStandardMaterial({ color: 0x3d6434, roughness: 0.95 }),
    ),
    leaf2: attachLeafWind(
      new THREE.MeshStandardMaterial({ color: 0x5d7c3e, roughness: 0.95 }),
    ),
    metal: new THREE.MeshStandardMaterial({
      color: 0x515653,
      metalness: 0.65,
      roughness: 0.5,
    }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xa44b33, roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xaaa28e, roughness: 1 }),
    shop: new THREE.MeshStandardMaterial({ color: 0xd9cbb6, roughness: 0.92 }),
    opening: new THREE.MeshStandardMaterial({ color: 0x14282c, roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x1c3338,
      roughness: 0.18,
      metalness: 0.12,
    }),
    frame: new THREE.MeshStandardMaterial({ color: 0x5c5146, roughness: 0.8 }),
    cornice: new THREE.MeshStandardMaterial({ color: 0xb7aa96, roughness: 0.9 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x4a514e, metalness: 0.4, roughness: 0.55 }),
    clay: new THREE.MeshStandardMaterial({ color: 0x8d4d32, roughness: 0.9 }),
    wheel: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 }),
  };
  const cloths = [0x8d3a32, 0xc47a2c, 0x2f6a4a, 0x243c66, 0xd8c7a4].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92 }),
  );
  const bikeColors = [0x1c1e22, 0xb4332c, 0xd8d4cc, 0x2f5f9e, 0xc47a2c].map(
    (color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 }),
  );
  const box = (group, w, h, d, mat, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const free = (x, z, pad = 0.35) =>
    !blocked(x, z, pad) &&
    !roads.some((q) => segmentDistance(x, z, q.a, q.b) < q.width / 2 + 0.25);

  let slot = 0;
  let trees = 0;
  let bicycles = 0;
  let pots = 0;
  let shrubs = 0;
  for (const r of roads) {
    if (r.length < 24 || segmentDistance(cx, cz, r.a, r.b) > 150) continue;
    const dx = (r.b[0] - r.a[0]) / r.length,
      dz = (r.b[1] - r.a[1]) / r.length;
    for (let t = 12; t < r.length; t += 18) {
      for (const side of [-1, 1]) {
        const kind = slot++ % 5;
        const edge = r.width / 2;
        const x = r.a[0] + dx * t + dz * (edge + 2.15) * side;
        const z = r.a[1] + dz * t - dx * (edge + 2.15) * side;
        if (!free(x, z, 0.4)) continue;
        const scale = 0.78 + hash(slot + x + z) * 0.7;
        if (kind === 0 && bicycles < 8) {
          const bx = r.a[0] + dx * t + dz * (edge + 1.25) * side;
          const bz = r.a[1] + dz * t - dx * (edge + 1.25) * side;
          if (free(bx, bz, 0.3)) {
            parkBicycle(root, bx, bz, Math.atan2(dx, dz), bikeColors[bicycles % bikeColors.length], mats);
            bicycles++;
          }
        } else if (kind === 1 && pots < 14) {
          potPlant(root, x, z, 0.85 + hash(slot) * 0.5, mats);
          pots++;
        } else if (kind === 2 && shrubs < 12) {
          shrub(root, x, z, 0.9 + hash(slot + 3) * 0.55, mats);
          shrubs++;
        } else if (trees < 18) {
          plantTree(root, x, z, scale, mats, hash(slot) * 6.2, true);
          trees++;
          if (trees % 3 === 0) {
            const lampX = x + dz * 1.4;
            const lampZ = z - dx * 1.4;
            if (free(lampX, lampZ, 0.2)) {
              const lamp = new THREE.Group();
              lamp.position.set(lampX, 0, lampZ);
              box(lamp, 0.1, 6, 0.1, mats.metal, 0, 3, 0);
              box(lamp, 1.15, 0.1, 0.42, mats.metal, dz * 0.4, 5.9, -dx * 0.4);
              bake(root, lamp);
            }
          }
          if (trees % 4 === 0) {
            const bench = new THREE.Group();
            bench.position.set(x + dx * 1.8, 0, z + dz * 1.8);
            bench.rotation.y = Math.atan2(dx, dz);
            box(bench, 1.7, 0.12, 0.5, mats.wood, 0, 0.52, 0);
            box(bench, 0.1, 0.5, 0.4, mats.metal, -0.7, 0.25, 0);
            box(bench, 0.1, 0.5, 0.4, mats.metal, 0.7, 0.25, 0);
            bake(root, bench);
          }
        }
      }
    }
  }

  const dressed = dressFronts(root, cx, cz, roads, buildings, mats, cloths, box);
  root.userData.counts = { trees, bicycles, pots, shrubs, dressed };

  const road = roads.find(
    (r) => r.length > 25 && segmentDistance(cx, cz, r.a, r.b) < 60,
  );
  if (road) {
    const dx = (road.b[0] - road.a[0]) / road.length,
      dz = (road.b[1] - road.a[1]) / road.length,
      x = (road.a[0] + road.b[0]) / 2 + dz * (road.width / 2 + 2),
      z = (road.a[1] + road.b[1]) / 2 - dx * (road.width / 2 + 2);
    if (!blocked(x, z, 1)) {
      const cart = new THREE.Group();
      cart.position.set(x, 0, z);
      cart.rotation.y = Math.atan2(dx, dz);
      box(cart, 2.4, 1.1, 1, mats.wood, 0, 0.55, 0);
      box(cart, 3, 0.12, 1.6, mats.cloth, 0, 2.3, 0);
      box(cart, 0.06, 2.3, 0.06, mats.metal, -1.1, 1.15, 0);
      box(cart, 0.06, 2.3, 0.06, mats.metal, 1.1, 1.15, 0);
      const urn = new THREE.Mesh(potGeo, mats.metal);
      urn.position.set(0.4, 1.25, 0);
      cart.add(urn);
      bake(root, cart);
    }
  }
  return root;
}

function parkBicycle(parent, x, z, ry, frame, mats) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  for (const zed of [-0.52, 0.52]) {
    const wheel = new THREE.Mesh(wheelGeo, mats.wheel);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, 0.34, zed);
    g.add(wheel);
    const hub = new THREE.Mesh(hubGeo, mats.metal);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(0, 0.34, zed);
    g.add(hub);
  }
  const tube = boxMesh(g, 0.05, 0.05, 0.85, frame, 0, 0.62, 0);
  tube.name = "bicycle";
  boxMesh(g, 0.04, 0.36, 0.04, frame, 0, 0.5, -0.28);
  boxMesh(g, 0.04, 0.4, 0.04, frame, 0, 0.5, 0.42);
  boxMesh(g, 0.32, 0.03, 0.03, mats.metal, 0, 0.74, 0.46);
  boxMesh(g, 0.12, 0.04, 0.18, mats.wood, 0, 0.7, -0.32);
  bake(parent, g);
}

function potPlant(parent, x, z, scale, mats) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  const pot = new THREE.Mesh(potGeo, mats.clay);
  pot.name = "pot";
  pot.position.y = 0.16;
  g.add(pot);
  for (let n = 0; n < 3; n++) {
    const leaf = new THREE.Mesh(leafGeo, n % 2 ? mats.leaf : mats.leaf2);
    leaf.name = "leaf";
    leaf.position.set((n - 1) * 0.16, 0.48 + (n % 2) * 0.12, (n % 2) * 0.08);
    leaf.scale.set(0.32, 0.24, 0.28);
    g.add(leaf);
  }
  bake(parent, g);
}

function shrub(parent, x, z, scale, mats) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  for (let n = 0; n < 3; n++) {
    const leaf = new THREE.Mesh(leafGeo, n % 2 ? mats.leaf : mats.leaf2);
    leaf.name = "shrub";
    leaf.position.set((n - 1) * 0.28, 0.32 + (n % 2) * 0.12, (n % 2) * 0.1);
    leaf.scale.set(0.46, 0.32, 0.4);
    g.add(leaf);
  }
  bake(parent, g);
}

function boxMesh(group, w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addWindow(group, mats, x, y) {
  const glass = boxMesh(group, 0.72, 1.12, 0.05, mats.glass, x, y, 0.04);
  glass.name = "window";
  boxMesh(group, 0.92, 0.08, 0.14, mats.frame, x, y + 0.6, 0.1).name = "window";
  boxMesh(group, 0.98, 0.08, 0.18, mats.frame, x, y - 0.58, 0.11).name = "window";
  boxMesh(group, 0.07, 1.16, 0.12, mats.frame, x - 0.4, y, 0.09).name = "window";
  boxMesh(group, 0.07, 1.16, 0.12, mats.frame, x + 0.4, y, 0.09).name = "window";
}

function dressFronts(root, cx, cz, roads, buildings, mats, cloths, box) {
  const near = roads.filter((r) => r.length > 8 && segmentDistance(cx, cz, r.a, r.b) < 160);
  const fronts = buildings
    .map((b) => ({
      b,
      d: Math.hypot((b.minX + b.maxX) / 2 - cx, (b.minZ + b.maxZ) / 2 - cz),
    }))
    .filter((item) => item.d < 150 && item.b.points?.length >= 4)
    .sort((a, b) => a.d - b.d);
  let dressed = 0;
  for (const { b } of fronts) {
    if (dressed >= 22) break;
    const pts = b.points;
    let chosen = null;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        c = pts[(i + 1) % pts.length],
        len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 5) continue;
      const mx = (a[0] + c[0]) / 2,
        mz = (a[1] + c[1]) / 2;
      let roadGap = Infinity,
        qx = mx,
        qz = mz;
      for (const r of near) {
        const dx = r.b[0] - r.a[0],
          dz = r.b[1] - r.a[1],
          denom = dx * dx + dz * dz || 1,
          t = Math.max(0, Math.min(1, ((mx - r.a[0]) * dx + (mz - r.a[1]) * dz) / denom)),
          px = r.a[0] + dx * t,
          pz = r.a[1] + dz * t,
          dist = Math.hypot(px - mx, pz - mz),
          clearance = dist - r.width / 2;
        if (clearance < roadGap) {
          roadGap = clearance;
          qx = px;
          qz = pz;
        }
      }
      if (roadGap < 0.35 || roadGap > 14) continue;
      if (!chosen || roadGap < chosen.gap) chosen = { len, mx, mz, gap: roadGap, qx, qz };
    }
    if (!chosen) continue;
    let nx = chosen.qx - chosen.mx,
      nz = chosen.qz - chosen.mz;
    const nd = Math.hypot(nx, nz) || 1;
    nx /= nd;
    nz /= nd;
    const g = new THREE.Group();
    g.position.set(chosen.mx, 0, chosen.mz);
    g.rotation.y = Math.atan2(nx, nz);
    const height = streetHeight(b.height, b.color);
    const width = Math.min(Math.max(4.2, chosen.len * 0.78), 10);
    box(g, width, 3.05, 0.28, mats.shop, 0, 1.52, 0.14).name = "shop";
    box(g, width * 0.72, 2.05, 0.08, mats.opening, 0, 1.28, 0.28).name = "shop";
    const awning = box(
      g,
      width * 0.96,
      0.07,
      1.15,
      cloths[dressed % cloths.length],
      0,
      3.12,
      0.82,
    );
    awning.name = "awning";
    awning.rotation.x = 0.32;
    box(g, width * 1.02, 0.14, 0.46, mats.cornice, 0, 3.18, 0.24).name = "cornice";
    const floors = Math.max(0, Math.min(3, Math.floor((height - 3.4) / 3.05)));
    const cols = Math.max(2, Math.min(4, Math.floor(width / 2.05)));
    for (let f = 0; f < floors; f++) {
      const y = 4.75 + f * 3.05;
      if (y + 0.7 > height - 0.25) break;
      for (let c = 0; c < cols; c++)
        addWindow(g, mats, (c - (cols - 1) / 2) * (width / cols), y);
    }
    if (height > 8.4) {
      box(g, width * 0.62, 0.08, 0.72, mats.concrete, 0, 6.35, 0.4).name = "balcony";
      box(g, width * 0.62, 0.36, 0.05, mats.rail, 0, 6.58, 0.72).name = "balcony";
      box(g, 0.05, 0.4, 0.7, mats.rail, width * 0.3, 6.55, 0.4).name = "balcony";
      box(g, 0.05, 0.4, 0.7, mats.rail, -width * 0.3, 6.55, 0.4).name = "balcony";
    }
    if (height > 7.2)
      box(g, width * 1.05, 0.16, 0.5, mats.cornice, 0, height - 0.2, 0.18).name = "cornice";
    bake(root, g);
    dressed++;
  }
  return dressed;
}
