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
  };
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
        box(1.8, 0.4, 1.8, mats.concrete, x, 0.2, z);
        add(
          new THREE.CylinderGeometry(0.18, 0.28, 4.4, 8),
          mats.wood,
          x,
          2.4,
          z,
        );
        for (let n = 0; n < 7; n++) {
          const angle = n * 2.4 + seed,
            rr = (n % 3) * 1.1;
          const leaf = add(
            new THREE.SphereGeometry(1, 8, 6),
            n % 2 ? mats.leaf : mats.leaf2,
            x + Math.cos(angle) * rr,
            4.7 + (n % 3) * 0.7,
            z + Math.sin(angle) * rr,
          );
          leaf.scale.set(2.1, 1.4, 1.8);
        }
        if (seed % 6 === 0) {
          box(0.1, 6, 0.1, mats.metal, x + 2, 3, z);
          box(1.2, 0.12, 0.5, mats.metal, x + 2.4, 6, z);
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
  return root;
}
