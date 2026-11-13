import * as THREE from "three";
import { segmentDistance } from "./city.js";

// Original meshes on the OSM survey. The extract has no tree nodes, and shop
// nodes in FC / Deccan / Kothrud are 1 / 0 / 0. Mapchannels returned no
// countable frames, so these repeats are invented (see docs/MEASUREMENTS.md):
// awning depth 1.2 m, shop bay 4.5 m, tree spacing 14 m, 5 leaf clumps.
export const AWNING_DEPTH_M = 1.2;
export const SHOP_BAY_M = 4.5;
export const TREE_SPACING_M = 14;
export const LEAF_CLUMPS = 5;

export function swayCanopies(root, time) {
  const trees = root?.userData?.trees;
  if (!trees) return;
  for (const tree of trees)
    for (const clump of tree.userData.clumps) {
      const { phase, amp, baseY } = clump.userData;
      clump.rotation.z = Math.sin(time * 1.35 + phase) * amp;
      clump.rotation.x = Math.cos(time * 0.85 + phase * 1.7) * amp * 0.65;
      clump.position.y = baseY + Math.sin(time * 1.1 + phase) * 0.08;
    }
}

export function streetDetails(cx, cz, roads, blocked, buildings = []) {
  const root = new THREE.Group();
  root.userData.trees = [];
  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x61513a, roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3d6434, roughness: 0.95 }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x5d7c3e, roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x515653,
      metalness: 0.65,
      roughness: 0.5,
    }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xa44b33, roughness: 1 }),
    cloth2: new THREE.MeshStandardMaterial({ color: 0x2f5a45, roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xaaa28e, roughness: 1 }),
    shop: new THREE.MeshStandardMaterial({ color: 0x6d4038, roughness: 0.85 }),
    shop2: new THREE.MeshStandardMaterial({ color: 0x243c44, roughness: 0.8 }),
    sign: new THREE.MeshStandardMaterial({ color: 0xf3e6c4, roughness: 0.7 }),
  };
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 4.2, 7);
  const clumpGeo = new THREE.SphereGeometry(1, 7, 5);
  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const box = (w, h, d, mat, x, y, z) =>
    add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const nearRoads = roads.filter(
    (r) => r.length > 12 && segmentDistance(cx, cz, r.a, r.b) < 150,
  );

  let trees = 0;
  for (const r of nearRoads) {
    if (r.length < 20) continue;
    const dx = (r.b[0] - r.a[0]) / r.length,
      dz = (r.b[1] - r.a[1]) / r.length;
    const sidewalk = r.sidewalk ?? 1.6;
    let onRoad = 0;
    for (
      let t = TREE_SPACING_M * 0.5;
      t < r.length && trees < 42 && onRoad < 8;
      t += TREE_SPACING_M
    ) {
      for (const side of [-1, 1]) {
        if (trees >= 42) break;
        let x;
        let z;
        let placed = false;
        for (const extra of [0, 1.6]) {
          const offset = r.width / 2 + sidewalk * 0.75 + extra;
          x = r.a[0] + dx * t + dz * offset * side;
          z = r.a[1] + dz * t - dx * offset * side;
          if (
            blocked(x, z, 0.4) ||
            nearRoads.some(
              (q) => segmentDistance(x, z, q.a, q.b) < q.width / 2 + 0.2,
            )
          )
            continue;
          placed = true;
          break;
        }
        if (!placed) continue;
        const tree = new THREE.Group();
        tree.position.set(x, 0, z);
        const trunk = new THREE.Mesh(trunkGeo, mats.wood);
        trunk.position.y = 2.1;
        trunk.castShadow = true;
        tree.add(trunk);
        const clumps = [];
        const inward = -side;
        for (let n = 0; n < LEAF_CLUMPS; n++) {
          const clump = new THREE.Mesh(clumpGeo, n % 2 ? mats.leaf : mats.leaf2);
          const baseY = 4.15 + (n % 3) * 0.42;
          clump.position.set(
            dz * inward * (0.7 + (n % 2) * 0.85) + (n - 2) * 0.35,
            baseY,
            -dx * inward * (0.7 + (n % 2) * 0.85) + ((n % 3) - 1) * 0.32,
          );
          clump.scale.set(1.7, 1.05, 1.55);
          clump.userData.phase = trees * 0.7 + n * 1.2;
          clump.userData.amp = 0.06 + (n % 3) * 0.025;
          clump.userData.baseY = baseY;
          clump.castShadow = true;
          tree.add(clump);
          clumps.push(clump);
        }
        tree.userData.clumps = clumps;
        root.add(tree);
        root.userData.trees.push(tree);
        trees++;
        onRoad++;
      }
    }
  }

  let shops = 0;
  const fronts = buildings
    .map((b) => ({
      b,
      d: Math.hypot(
        ((b.minX ?? 0) + (b.maxX ?? 0)) / 2 - cx,
        ((b.minZ ?? 0) + (b.maxZ ?? 0)) / 2 - cz,
      ),
    }))
    .filter((item) => item.d < 100)
    .sort((a, b) => a.d - b.d);
  for (const { b } of fronts) {
    if (shops >= 36) break;
    const pts = b.points || [];
    for (let i = 0; i < pts.length && shops < 36; i++) {
      const a = pts[i],
        c = pts[(i + 1) % pts.length],
        ex = c[0] - a[0],
        ez = c[1] - a[1],
        len = Math.hypot(ex, ez);
      if (len < 4) continue;
      const mx = (a[0] + c[0]) / 2,
        mz = (a[1] + c[1]) / 2;
      let road,
        best = Infinity,
        qx = mx,
        qz = mz;
      for (const r of nearRoads) {
        const rdx = r.b[0] - r.a[0],
          rdz = r.b[1] - r.a[1],
          t = Math.max(
            0,
            Math.min(
              1,
              ((mx - r.a[0]) * rdx + (mz - r.a[1]) * rdz) /
                (rdx * rdx + rdz * rdz || 1),
            ),
          ),
          px = r.a[0] + rdx * t,
          pz = r.a[1] + rdz * t,
          dist = Math.hypot(px - mx, pz - mz);
        if (dist < best) {
          best = dist;
          road = r;
          qx = px;
          qz = pz;
        }
      }
      if (!road) continue;
      const gap = best - road.width / 2;
      if (gap < 0.2 || gap > 7.5) continue;
      let nx = qx - mx,
        nz = qz - mz;
      const nd = Math.hypot(nx, nz) || 1;
      nx /= nd;
      nz /= nd;
      const edx = ex / len,
        edz = ez / len;
      let ry = Math.atan2(edx, edz);
      if (edz * nx + -edx * nz < 0) ry += Math.PI;
      const bays = Math.max(1, Math.round(len / SHOP_BAY_M));
      const bay = len / bays;
      const awningY = Math.min(3.05, Math.max(2.2, (b.height || 9) - 0.3));
      const frontH = Math.min(2.35, awningY - 0.35);
      for (let k = 0; k < bays && shops < 36; k++) {
        const u = (k + 0.5) / bays,
          wx = a[0] + ex * u,
          wz = a[1] + ez * u,
          cloth = shops % 2 ? mats.cloth : mats.cloth2,
          front = shops % 2 ? mats.shop : mats.shop2,
          sx = wx + nx * 0.1,
          sz = wz + nz * 0.1;
        const frontMesh = box(0.14, frontH, bay * 0.86, front, sx, frontH / 2 + 0.05, sz);
        frontMesh.rotation.y = ry;
        const awning = box(
          AWNING_DEPTH_M,
          0.07,
          bay * 0.9,
          cloth,
          wx + nx * (AWNING_DEPTH_M * 0.5),
          awningY,
          wz + nz * (AWNING_DEPTH_M * 0.5),
        );
        awning.rotation.y = ry;
        const board = box(
          0.06,
          0.36,
          Math.min(bay * 0.62, 2.4),
          mats.sign,
          sx + nx * 0.08,
          awningY - 0.32,
          sz + nz * 0.08,
        );
        board.rotation.y = ry;
        shops++;
      }
    }
  }

  const road = nearRoads.find(
    (r) => r.length > 25 && segmentDistance(cx, cz, r.a, r.b) < 60,
  );
  if (road) {
    const dx = (road.b[0] - road.a[0]) / road.length,
      dz = (road.b[1] - road.a[1]) / road.length,
      sidewalk = road.sidewalk ?? 1.6,
      x = (road.a[0] + road.b[0]) / 2 + dz * (road.width / 2 + sidewalk),
      z = (road.a[1] + road.b[1]) / 2 - dx * (road.width / 2 + sidewalk);
    if (!blocked(x, z, 1)) {
      box(2.4, 1.1, 1, mats.wood, x, 0.6, z);
      box(3, 0.12, 1.6, mats.cloth, x, 2.4, z);
      for (const side of [-1.1, 1.1])
        box(0.06, 2.4, 0.06, mats.metal, x + side, 1.2, z);
      add(
        new THREE.CylinderGeometry(0.28, 0.28, 0.35, 12),
        mats.metal,
        x + 0.4,
        1.3,
        z,
      );
    }
  }
  return root;
}
