import * as THREE from "three";
import { segmentDistance } from "./city.js";

// Original street dressing for the prototype. Placement follows road edges and
// OSM footprints already in the map. It is not a copy of a filmed shopfront.
export function streetDetails(
  cx,
  cz,
  roads,
  blocked,
  buildings = [],
  look = {},
) {
  const root = new THREE.Group();
  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x61513a, roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3d6434, roughness: 0.95 }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x5d7c3e, roughness: 0.95 }),
    blossom: new THREE.MeshStandardMaterial({ color: 0xa24b3a, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x6d7370,
      metalness: 0.55,
      roughness: 0.45,
    }),
    wire: new THREE.MeshStandardMaterial({ color: 0x2a2c2a, roughness: 0.8 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xb7b1a2, roughness: 1 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.7 }),
    wheel: new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.85 }),
    bin: new THREE.MeshStandardMaterial({ color: 0x2c4a3c, roughness: 0.8 }),
    post: new THREE.MeshStandardMaterial({ color: 0x8e2c2c, roughness: 0.7 }),
    rail: new THREE.MeshStandardMaterial({ color: 0xe0a516, roughness: 0.6 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xc4b59a, roughness: 1 }),
  };
  const cloths = [0x8d3a32, 0xc47a2c, 0x2f6a4a, 0x2c4f86, 0xe4d3a4].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
  );
  const bodies = [0x1c1e22, 0xb4332c, 0xd8d4cc, 0x2f5f9e, 0x8c6a32, 0xe8e4dc].map(
    (color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2 }),
  );
  const signMats = (look.signs || []).map(
    (map) =>
      new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.04 }),
  );
  const boardMat =
    signMats[0] ||
    new THREE.MeshStandardMaterial({ color: 0x7a302c, roughness: 0.6 });
  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.12, 8);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 4.2, 7);
  const leafGeo = new THREE.SphereGeometry(1, 7, 5);
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const free = (x, z, pad = 0.35) =>
    !blocked(x, z, pad) &&
    !roads.some(
      (q) => segmentDistance(x, z, q.a, q.b) < q.width / 2 + 0.12,
    );
  function spawn(x, y, z, ry, build) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = ry;
    build(group);
    group.updateMatrixWorld(true);
    for (const child of group.children) {
      if (!child.isMesh) continue;
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(child.matrixWorld);
      if (
        child.geometry !== wheelGeo &&
        child.geometry !== trunkGeo &&
        child.geometry !== leafGeo
      )
        child.geometry.dispose();
      const mesh = new THREE.Mesh(geometry, child.material);
      mesh.castShadow = mesh.receiveShadow = true;
      root.add(mesh);
    }
  }
  const box = (group, w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    group.add(mesh);
  };

  const near = roads.filter(
    (r) => r.length > 16 && segmentDistance(cx, cz, r.a, r.b) < 120,
  );
  let scooters = 0;
  let trees = 0;
  const poles = [];
  for (const r of near) {
    const dx = (r.b[0] - r.a[0]) / r.length,
      dz = (r.b[1] - r.a[1]) / r.length;
    for (let t = 6; t < r.length; t += 14) {
      for (const side of [-1, 1]) {
        const outwardX = dz * side,
          outwardZ = -dx * side,
          inwardX = -outwardX,
          inwardZ = -outwardZ;
        const kerb = r.width / 2 + 0.45;
        if (scooters < 64 && (Math.floor(t / 14) + (side > 0 ? 1 : 0)) % 3 !== 0)
          for (let k = 0; k < 4 && scooters < 64; k++) {
            const tt = t + k * 0.92;
            const x0 = r.a[0] + dx * tt + outwardX * kerb,
              z0 = r.a[1] + dz * tt + outwardZ * kerb;
            let x = x0,
              z = z0,
              parked = false;
            for (const pull of [0, 0.85, 1.6, 2.3]) {
              const px = x0 + inwardX * pull,
                pz = z0 + inwardZ * pull;
              if (segmentDistance(px, pz, r.a, r.b) < 2.3) continue;
              if (blocked(px, pz, 0.15)) continue;
              if (
                roads.some(
                  (q) =>
                    q !== r &&
                    segmentDistance(px, pz, q.a, q.b) < q.width / 2 + 0.05,
                )
              )
                continue;
              x = px;
              z = pz;
              parked = true;
              break;
            }
            if (!parked) continue;
            const ry = Math.atan2(inwardX, inwardZ);
            const body = bodies[scooters % bodies.length];
            spawn(x, 0, z, ry, (g) => {
              box(g, 0.42, 0.28, 1.05, body, 0, 0.52, 0.02);
              box(g, 0.32, 0.08, 0.42, mats.seat, 0, 0.72, -0.08);
              box(g, 0.1, 0.42, 0.1, mats.metal, 0, 0.72, 0.58);
              box(g, 0.52, 0.04, 0.04, mats.metal, 0, 0.94, 0.6);
              box(g, 0.08, 0.1, 0.12, mats.metal, -0.28, 0.98, 0.62);
              box(g, 0.08, 0.1, 0.12, mats.metal, 0.28, 0.98, 0.62);
              const front = new THREE.Mesh(wheelGeo, mats.wheel);
              front.rotation.z = Math.PI / 2;
              front.position.set(0, 0.24, 0.52);
              g.add(front);
              const rear = new THREE.Mesh(wheelGeo, mats.wheel);
              rear.rotation.z = Math.PI / 2;
              rear.position.set(0, 0.24, -0.42);
              g.add(rear);
            });
            scooters++;
          }
        if (trees < 22 && t % 28 < 14) {
          const x = r.a[0] + dx * (t + 3) + outwardX * (r.width / 2 + 2.55),
            z = r.a[1] + dz * (t + 3) + outwardZ * (r.width / 2 + 2.55);
          if (free(x, z, 0.15)) {
            const bloom = hash(trees + 4) > 0.72;
            spawn(x, 0, z, 0, (g) => {
              const trunk = new THREE.Mesh(trunkGeo, mats.wood);
              trunk.position.y = 2.1;
              g.add(trunk);
              for (let n = 0; n < 5; n++) {
                const leaf = new THREE.Mesh(
                  leafGeo,
                  bloom && n === 0 ? mats.blossom : n % 2 ? mats.leaf : mats.leaf2,
                );
                leaf.position.set(
                  inwardX * (1.3 + (n % 2)) + (n - 2) * 0.45,
                  4.5 + (n % 3) * 0.55,
                  inwardZ * (1.3 + (n % 2)) + ((n % 3) - 1) * 0.4,
                );
                leaf.scale.set(2.5, 1.15, 2.3);
                g.add(leaf);
              }
            });
            trees++;
          }
        }
        if (poles.length < 26 && side === 1 && t % 28 < 14) {
          const x = r.a[0] + dx * t + outwardX * (r.width / 2 + 2.05),
            z = r.a[1] + dz * t + outwardZ * (r.width / 2 + 2.05);
          if (free(x, z, 0.15)) {
            spawn(x, 0, z, Math.atan2(inwardX, inwardZ), (g) => {
              box(g, 0.12, 7.1, 0.12, mats.metal, 0, 3.55, 0);
              box(g, 0.08, 0.08, 1.7, mats.metal, 0, 6.9, 0.85);
              box(g, 0.28, 0.12, 0.5, mats.concrete, 0, 6.55, 1.55);
              if (poles.length % 3 === 0)
                box(g, 0.46, 0.46, 0.05, mats.post, 0, 3.3, 0.2);
            });
            poles.push({ x, z });
          }
        }
      }
    }
    if (hash(r.length + r.a[0]) > 0.62) {
      const x = r.a[0] + dx * Math.min(18, r.length * 0.4) + dz * (r.width / 2 + 0.55),
        z = r.a[1] + dz * Math.min(18, r.length * 0.4) - dx * (r.width / 2 + 0.55);
      if (free(x, z, 0.2)) {
        const ry = Math.atan2(dx, dz);
        spawn(x, 0, z, ry, (g) => {
          box(g, 0.08, 0.08, 7, mats.rail, 0, 0.85, 0);
          box(g, 0.08, 0.08, 7, mats.rail, 0, 0.45, 0);
          for (const zed of [-3, 0, 3])
            box(g, 0.08, 0.9, 0.08, mats.rail, 0, 0.45, zed);
        });
      }
    }
  }
  for (let i = 1; i < poles.length; i++) {
    const a = poles[i - 1],
      b = poles[i],
      span = Math.hypot(b.x - a.x, b.z - a.z);
    if (span < 8 || span > 34) continue;
    for (const drop of [0, 0.35]) {
      const mx = (a.x + b.x) / 2,
        mz = (a.z + b.z) / 2;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.03, span),
        mats.wire,
      );
      mesh.position.set(mx, 7.15 - drop, mz);
      mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      mesh.castShadow = true;
      root.add(mesh);
    }
  }

  const nearRoads = near;
  const fronts = buildings
    .map((b) => ({
      b,
      d: Math.hypot((b.minX + b.maxX) / 2 - cx, (b.minZ + b.maxZ) / 2 - cz),
    }))
    .filter((item) => item.d < 115)
    .sort((a, b) => a.d - b.d);
  let dressed = 0;
  for (const { b } of fronts) {
    if (dressed >= 28) break;
    const pts = b.points;
    for (let i = 0; i < pts.length && dressed < 28; i++) {
      const a = pts[i],
        c = pts[(i + 1) % pts.length],
        ex = c[0] - a[0],
        ez = c[1] - a[1],
        len = Math.hypot(ex, ez);
      if (len < 6) continue;
      const mx = (a[0] + c[0]) / 2,
        mz = (a[1] + c[1]) / 2;
      let road,
        best = Infinity,
        qx = mx,
        qz = mz;
      for (const r of nearRoads) {
        const dx = r.b[0] - r.a[0],
          dz = r.b[1] - r.a[1],
          t = Math.max(
            0,
            Math.min(
              1,
              ((mx - r.a[0]) * dx + (mz - r.a[1]) * dz) / (dx * dx + dz * dz || 1),
            ),
          ),
          px = r.a[0] + dx * t,
          pz = r.a[1] + dz * t,
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
      if (gap < -1.4 || gap > 7.5) continue;
      let nx = qx - mx,
        nz = qz - mz;
      const nd = Math.hypot(nx, nz) || 1;
      nx /= nd;
      nz /= nd;
      const edx = ex / len,
        edz = ez / len;
      let ry = Math.atan2(-edz, edx);
      if (Math.sin(ry) * nx + Math.cos(ry) * nz < 0) ry += Math.PI;
      const depth = Math.min(1.4, Math.max(0.85, gap + 1.05));
      const cloth = cloths[dressed % cloths.length];
      const sign = signMats.length
        ? signMats[dressed % signMats.length]
        : boardMat;
      const width = Math.min(len * 0.82, 12);
      spawn(mx, 0, mz, ry, (g) => {
        box(g, width, 0.07, depth, cloth, 0, 3.02, depth * 0.42);
        box(g, width, 0.22, 0.05, cloth, 0, 2.84, depth * 0.82);
        box(g, width * 0.72, 0.58, 0.1, sign, 0, 3.62, 0.28);
        box(g, 0.08, 1.05, 0.5, cloth, width * 0.34, 4.15, 0.7);
        if (b.height > 6) {
          box(g, width * 0.6, 0.08, 0.82, mats.concrete, 0, 6.45, 0.36);
          box(g, width * 0.6, 0.42, 0.05, mats.metal, 0, 6.72, 0.72);
          box(g, 0.62, 0.36, 0.28, mats.metal, width * 0.22, 5.35, 0.16);
        }
        if (b.height > 9.2) {
          box(g, width * 0.5, 0.08, 0.7, mats.concrete, 0, 9.55, 0.3);
          box(g, width * 0.5, 0.4, 0.05, mats.metal, 0, 9.8, 0.6);
        }
      });
      dressed++;
    }
  }

  const road = near.find((r) => segmentDistance(cx, cz, r.a, r.b) < 50);
  if (road) {
    const dx = (road.b[0] - road.a[0]) / road.length,
      dz = (road.b[1] - road.a[1]) / road.length,
      x = (road.a[0] + road.b[0]) / 2 + dz * (road.width / 2 + 2.1),
      z = (road.a[1] + road.b[1]) / 2 - dx * (road.width / 2 + 2.1);
    if (free(x, z, 0.8)) {
      spawn(x, 0, z, road.angle || Math.atan2(dx, dz), (g) => {
        box(g, 2.2, 1.05, 0.9, mats.wood, 0, 0.55, 0);
        box(g, 2.6, 0.08, 1.5, cloths[0], 0, 2.15, 0);
        box(g, 0.06, 2.15, 0.06, mats.metal, -1.05, 1.05, 0);
        box(g, 0.06, 2.15, 0.06, mats.metal, 1.05, 1.05, 0);
        const pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 0.28, 10),
          mats.metal,
        );
        pot.position.set(0.35, 1.2, 0);
        g.add(pot);
      });
    }
  }
  for (let n = 0; n < 8; n++) {
    const r = near[n % Math.max(1, near.length)];
    if (!r) break;
    const dx = (r.b[0] - r.a[0]) / r.length,
      dz = (r.b[1] - r.a[1]) / r.length,
      t = 10 + ((n * 17) % Math.max(12, Math.floor(r.length - 12))),
      side = n % 2 ? 1 : -1,
      x = r.a[0] + dx * t + dz * (r.width / 2 + 1.9) * side,
      z = r.a[1] + dz * t - dx * (r.width / 2 + 1.9) * side;
    if (!free(x, z, 0.3)) continue;
    spawn(x, 0, z, 0, (g) => {
      if (n % 2 === 0) {
        const bin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.24, 0.75, 8),
          mats.bin,
        );
        bin.position.y = 0.38;
        g.add(bin);
      } else box(g, 0.42, 0.95, 0.42, mats.post, 0, 0.48, 0);
    });
  }
  wheelGeo.dispose();
  trunkGeo.dispose();
  leafGeo.dispose();
  return root;
}
