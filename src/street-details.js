import * as THREE from "three";
import { segmentDistance } from "./city.js";
// Original street props. Placement is illustrative; no real shop facade is claimed.
export function streetDetails(cx, cz, roads, blocked) {
  const root = new THREE.Group();
  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x61513a }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x405f35, roughness: 0.95 }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x627d42, roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x515653,
      metalness: 0.65,
      roughness: 0.5,
    }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xa44b33, roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xaaa28e, roughness: 1 }),
    clay: new THREE.MeshStandardMaterial({ color: 0xa15b3c, roughness: 0.9 }),
    lamp: new THREE.MeshStandardMaterial({
      color: 0xffe2b0,
      emissive: 0xffc56a,
      emissiveIntensity: 0,
      roughness: 0.35,
    }),
  };
  const lights = [];
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z) =>
    add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  let placed = 0;
  for (const r of roads) {
    if (r.length < 30 || segmentDistance(cx, cz, r.a, r.b) > 180) continue;
    const dx = (r.b[0] - r.a[0]) / r.length,
      dz = (r.b[1] - r.a[1]) / r.length;
    for (let t = 14; t < r.length && placed < 65; t += 28) {
      for (const side of [-1, 1]) {
        const x = r.a[0] + dx * t + dz * (r.width / 2 + 2.3) * side,
          z = r.a[1] + dz * t - dx * (r.width / 2 + 2.3) * side;
        if (
          blocked(x, z, 0.8) ||
          roads.some((q) => segmentDistance(x, z, q.a, q.b) < q.width / 2 + 0.3)
        )
          continue;
        const seed = placed++;
        const scale = 0.7 + (seed % 6) * 0.11;
        if (seed % 5 === 3) {
          add(new THREE.CylinderGeometry(0.28, 0.22, 0.42, 8), mats.clay, x, 0.22, z);
          const sprout = add(
            new THREE.SphereGeometry(0.32, 7, 5),
            seed % 2 ? mats.leaf : mats.leaf2,
            x,
            0.55,
            z,
          );
          sprout.scale.set(scale, scale * 0.8, scale);
        } else if (seed % 5 === 2) {
          const shrub = add(
            new THREE.SphereGeometry(0.55, 7, 5),
            mats.leaf2,
            x,
            0.5,
            z,
          );
          shrub.scale.set(1.5 * scale, 0.85 * scale, 1.2 * scale);
          const shrub2 = add(
            new THREE.SphereGeometry(0.4, 7, 5),
            mats.leaf,
            x + 0.55,
            0.4,
            z + 0.2,
          );
          shrub2.scale.set(scale, scale * 0.75, scale);
        } else {
          box(1.8 * scale, 0.4, 1.8 * scale, mats.concrete, x, 0.2, z);
          add(
            new THREE.CylinderGeometry(0.16 * scale, 0.26 * scale, 4.2 * scale, 7),
            mats.wood,
            x,
            2.2 * scale,
            z,
          );
          for (let n = 0; n < 6; n++) {
            const angle = n * 2.4 + seed,
              rr = (n % 3) * 0.9 * scale;
            const leaf = add(
              new THREE.SphereGeometry(1, 7, 5),
              n % 2 ? mats.leaf : mats.leaf2,
              x + Math.cos(angle) * rr,
              (4.2 + (n % 3) * 0.65) * scale,
              z + Math.sin(angle) * rr,
            );
            leaf.scale.set(1.8 * scale, 1.25 * scale, 1.55 * scale);
          }
        }
        if (seed % 4 === 1) {
          const pot = add(
            new THREE.CylinderGeometry(0.22, 0.18, 0.36, 7),
            seed % 2 ? mats.clay : mats.concrete,
            x + 1.3,
            0.18,
            z + 0.4,
          );
          pot.scale.setScalar(0.85 + (seed % 3) * 0.12);
          add(
            new THREE.SphereGeometry(0.22, 6, 5),
            mats.leaf,
            x + 1.3,
            0.48,
            z + 0.4,
          ).scale.setScalar(0.8 + (seed % 3) * 0.15);
        }
        if (seed % 6 === 0) {
          box(0.1, 6, 0.1, mats.metal, x + 2, 3, z);
          box(1.2, 0.12, 0.5, mats.metal, x + 2.4, 6, z);
          const head = add(new THREE.SphereGeometry(0.18, 8, 6), mats.lamp, x + 2.4, 5.7, z);
          head.castShadow = false;
          if (lights.length < 5) {
            const light = new THREE.PointLight(0xffd2a1, 0, 16, 2);
            light.position.set(x + 2.4, 5.5, z);
            root.add(light);
            lights.push(light);
          }
        }
        if (seed % 5 === 0) {
          const bench = box(2, 0.15, 0.65, mats.wood, x + 2, 0.6, z + 1);
          bench.rotation.y = r.angle;
          box(0.12, 0.6, 0.45, mats.metal, x + 1.3, 0.3, z + 1);
          box(0.12, 0.6, 0.45, mats.metal, x + 2.7, 0.3, z + 1);
        }
      }
    }
  }
  // A small original tea cart, placed only if there is room beside the road.
  const road = roads.find(
    (r) => r.length > 25 && segmentDistance(cx, cz, r.a, r.b) < 60,
  );
  if (road) {
    const dx = (road.b[0] - road.a[0]) / road.length,
      dz = (road.b[1] - road.a[1]) / road.length,
      x = (road.a[0] + road.b[0]) / 2 + dz * (road.width / 2 + 2),
      z = (road.a[1] + road.b[1]) / 2 - dx * (road.width / 2 + 2);
    if (!blocked(x, z, 1)) {
      box(2.4, 1.1, 1, mats.wood, x, 0.6, z);
      box(3, 0.12, 1.6, mats.cloth, x, 2.4, z);
      for (const a of [-1.1, 1.1])
        box(0.06, 2.4, 0.06, mats.metal, x + a, 1.2, z);
      add(
        new THREE.CylinderGeometry(0.28, 0.28, 0.35, 12),
        mats.metal,
        x + 0.4,
        1.3,
        z,
      );
    }
  }
  root.userData.glow = { lamp: mats.lamp, lights };
  return root;
}
