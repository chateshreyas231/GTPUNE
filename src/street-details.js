import * as THREE from "three";
import { segmentDistance } from "./city.js";
// Original street props. Placement is illustrative; no real shop facade is claimed.
export function streetDetails(cx, cz, roads, blocked) {
  const root = new THREE.Group();
  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x6a5340, roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3d6234, roughness: 0.95 }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x6d8c45, roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x4e5554,
      metalness: 0.55,
      roughness: 0.45,
    }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xc4bba8, roughness: 1 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.7 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.85 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x3e4446, roughness: 0.5 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xf4f0e4, roughness: 0.9 }),
  };
  const awningMats = [0xb24a3a, 0x2f6a56, 0x3d6484, 0xd08a3a, 0x8d3d4a].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.88 }),
  );
  const bikeMats = [0x1d2430, 0x8c3030, 0x24506a, 0xc8c4bc, 0x243c32].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.35,
      }),
  );
  const wheel = new THREE.CylinderGeometry(0.16, 0.16, 0.07, 8);
  wheel.rotateZ(Math.PI / 2);
  const add = (geo, mat, x, y, z, yaw = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const box = (w, h, d, mat, x, y, z, yaw = 0) =>
    add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, yaw);
  let trees = 0,
    shops = 0,
    bikes = 0,
    balconies = 0,
    brollies = 0;
  for (const r of roads) {
    if (r.length < 24 || segmentDistance(cx, cz, r.a, r.b) > 165) continue;
    const dx = (r.b[0] - r.a[0]) / r.length,
      dz = (r.b[1] - r.a[1]) / r.length,
      yaw = r.angle,
      cos = Math.cos(yaw),
      sin = Math.sin(yaw);
    const at = (along, lateral) => [
      r.a[0] + dx * along + cos * lateral,
      r.a[1] + dz * along - sin * lateral,
    ];
    const shift = (x, z, lx, lz) => [
      x + cos * lx + sin * lz,
      z - sin * lx + cos * lz,
    ];
    const inJunction = (x, z) =>
      roads.some(
        (q) => q !== r && segmentDistance(x, z, q.a, q.b) < q.width / 2 + 0.35,
      );
    const spot = (along, side, extras) => {
      for (const extra of extras) {
        const [x, z] = at(along, side * (r.width / 2 + extra));
        if (!blocked(x, z, extra < 0 ? 0.12 : 0.35) && !inJunction(x, z))
          return { x, z, extra };
      }
      return null;
    };
    for (let t = 12; t < r.length; t += 18) {
      for (const side of [-1, 1]) {
        const treeSpot = spot(t, side, [2.2, 1.15, 0.35]);
        if (trees < 32 && t % 36 < 18 && treeSpot) {
          const { x: tx, z: tz } = treeSpot;
          trees++;
          box(1.45, 0.28, 1.45, mats.concrete, tx, 0.16, tz, yaw);
          add(
            new THREE.CylinderGeometry(0.16, 0.28, 4.8, 7),
            mats.wood,
            tx,
            2.55,
            tz,
          );
          for (let n = 0; n < 6; n++) {
            const ang = n * 1.2 + side,
              reach = 1.2 + (n % 3) * 0.9;
            const leaf = add(
              new THREE.SphereGeometry(1, 7, 5),
              n % 2 ? mats.leaf : mats.leaf2,
              tx + Math.cos(ang) * reach,
              5.2 + (n % 3) * 0.42,
              tz + Math.sin(ang) * reach,
            );
            leaf.scale.set(2.35, 1.1, 2.05);
          }
        }
        const shopSpot = spot(t + 8, side, [2.6, 1.5, 0.45, -0.35]);
        if (shops < 28 && shopSpot) {
          const { x: sx, z: sz, extra } = shopSpot;
          const cloth = awningMats[shops % awningMats.length];
          const out = extra > 0.2 ? -side : side;
          shops++;
          for (const end of [-1.35, 1.35]) {
            const [px, pz] = shift(sx, sz, 0, end);
            box(0.22, 2.65, 0.22, mats.concrete, px, 1.35, pz, yaw);
          }
          const [fx, fz] = shift(sx, sz, out * 0.15, 0);
          box(0.36, 0.42, 2.9, cloth, fx, 2.72, fz, yaw);
          const [ax, az] = shift(sx, sz, out * 0.85, 0);
          box(1.55, 0.07, 2.85, cloth, ax, 2.58, az, yaw);
          const [vx, vz] = shift(sx, sz, out * 1.55, 0);
          box(0.08, 0.28, 2.85, cloth, vx, 2.4, vz, yaw);
          if (balconies < 22) {
            balconies++;
            for (const floor of [4.7, 7.55]) {
              const [bx, bz] = shift(sx, sz, out * 0.55, 0);
              box(0.9, 0.1, 2.5, mats.concrete, bx, floor, bz, yaw);
              box(0.04, 0.45, 2.5, mats.rail, bx, floor + 0.32, bz, yaw);
              for (const end of [-1.05, 0, 1.05]) {
                const [rx, rz] = shift(bx, bz, 0, end);
                box(0.04, 0.45, 0.04, mats.rail, rx, floor + 0.28, rz, yaw);
              }
            }
          }
          if (brollies < 8 && shops % 4 === 0) {
            brollies++;
            const [ux, uz] = shift(sx, sz, out * 1.7, 1.1);
            if (!blocked(ux, uz, 0.2) && !inJunction(ux, uz)) {
              add(
                new THREE.CylinderGeometry(0.04, 0.04, 2.1, 6),
                mats.metal,
                ux,
                1.05,
                uz,
              );
              const shade = add(
                new THREE.ConeGeometry(0.85, 0.28, 8),
                shops % 2 ? mats.cloth : cloth,
                ux,
                2.15,
                uz,
              );
              shade.scale.set(1, 1, 1);
            }
          }
        }
        const park = spot(t + 3, side, [-1.15, -0.65, 0.85]);
        if (bikes < 36 && park && t % 36 >= 18) {
          const paint = bikeMats[bikes % bikeMats.length];
          for (let n = 0; n < 3 && bikes < 36; n++) {
            const parked = spot(t + 3 + n * 1.15, side, [-1.15, -0.65, 0.85]);
            if (!parked) continue;
            const { x: bx, z: bz } = parked;
            bikes++;
            const face = yaw + (side > 0 ? 0 : Math.PI);
            const part = (lx, lz) => {
              const c = Math.cos(face),
                s = Math.sin(face);
              return [bx + c * lx + s * lz, bz - s * lx + c * lz];
            };
            box(0.28, 0.22, 1.02, paint, bx, 0.58, bz, face);
            const [seatX, seatZ] = part(0, -0.06);
            box(0.24, 0.07, 0.36, mats.seat, seatX, 0.74, seatZ, face);
            const [stemX, stemZ] = part(0, 0.42);
            box(0.05, 0.32, 0.05, mats.metal, stemX, 0.9, stemZ, face);
            box(0.34, 0.035, 0.05, mats.metal, stemX, 1.05, stemZ, face);
            const [rearX, rearZ] = part(0, -0.4);
            const [frontX, frontZ] = part(0, 0.44);
            add(wheel, mats.tyre, rearX, 0.18, rearZ, face);
            add(wheel, mats.tyre, frontX, 0.18, frontZ, face);
          }
        }
      }
    }
  }
  const road = roads.find(
    (r) => r.length > 25 && segmentDistance(cx, cz, r.a, r.b) < 60,
  );
  if (road) {
    const dx = (road.b[0] - road.a[0]) / road.length,
      dz = (road.b[1] - road.a[1]) / road.length,
      x = (road.a[0] + road.b[0]) / 2 + dz * (road.width / 2 + 2),
      z = (road.a[1] + road.b[1]) / 2 - dx * (road.width / 2 + 2);
    if (!blocked(x, z, 1)) {
      box(1.05, 1.05, 2.2, mats.wood, x, 0.55, z, road.angle);
      box(1.7, 0.08, 2.8, awningMats[0], x, 2.15, z, road.angle);
      for (const end of [-1.15, 1.15]) {
        const cos = Math.cos(road.angle),
          sin = Math.sin(road.angle);
        box(
          0.05,
          2.1,
          0.05,
          mats.metal,
          x + sin * end,
          1.05,
          z + cos * end,
          road.angle,
        );
      }
    }
  }
  return root;
}
