import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const HOUSE_MODELS = [
  "timber-wada",
  "green-wada",
  "ornate-wada",
  "courtyard-wada",
  "basalt-blue-house",
  "tiled-bungalow",
  "garden-bungalow",
  "modern-villa",
  "brick-villa",
  "weathered-house",
];
const library = new Map();
const loader = new GLTFLoader();
export async function prepareHouseAssets() {
  await Promise.all(
    HOUSE_MODELS.map(async (id) => {
      const gltf = await loader.loadAsync(`/assets/pune-originals/${id}.glb`);
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      library.set(id, {
        scene: gltf.scene,
        size: bounds.getSize(new THREE.Vector3()),
        center: bounds.getCenter(new THREE.Vector3()),
        minY: bounds.min.y,
      });
    }),
  );
}
function inside(x, z, points) {
  let value = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      value = !value;
  }
  return value;
}

// Keep the supplied footprint and measured height. Reject irregular/oversize sites.
export function housePlacement(building, roads = []) {
  if (building.shop || building.amenity || building.name || building.infill)
    return null;
  if (
    ![
      undefined,
      "yes",
      "house",
      "residential",
      "detached",
      "terrace",
      "semidetached_house",
    ].includes(building.kind)
  )
    return null;
  if (!(building.height >= 5 && building.height <= 17)) return null;
  const pts = building.points;
  if (!Array.isArray(pts) || pts.length < 4) return null;
  let longest = 0,
    u;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length > longest) {
      longest = length;
      u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    }
  }
  if (!u) return null;
  let v = [-u[1], u[0]];
  const us = pts.map((p) => p[0] * u[0] + p[1] * u[1]),
    vs = pts.map((p) => p[0] * v[0] + p[1] * v[1]);
  const cu = (Math.min(...us) + Math.max(...us)) / 2,
    cv = (Math.min(...vs) + Math.max(...vs)) / 2;
  const x = cu * u[0] + cv * v[0],
    z = cu * u[1] + cv * v[1];
  let width = Math.max(...us) - Math.min(...us),
    depth = Math.max(...vs) - Math.min(...vs);
  if (width < 5 || width > 25 || depth < 4 || depth > 25) return null;
  // Sample every perimeter edge, including concave sites, before admitting a model.
  let fit = 0;
  for (const factor of [0.97, 0.9, 0.82, 0.74]) {
    let valid = true;
    for (let edge = 0; edge < 4 && valid; edge++)
      for (let k = 0; k <= 12; k++) {
        const t = k / 12,
          corners = [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ],
          a = corners[edge],
          b = corners[(edge + 1) % 4];
        const du = ((a[0] + (b[0] - a[0]) * t) * width * factor) / 2,
          dv = ((a[1] + (b[1] - a[1]) * t) * depth * factor) / 2;
        if (
          !inside(x + du * u[0] + dv * v[0], z + du * u[1] + dv * v[1], pts)
        ) {
          valid = false;
          break;
        }
      }
    if (valid) {
      fit = factor;
      break;
    }
  }
  if (!fit) return null;
  let nearest = Infinity,
    target;
  for (const road of roads) {
    const dx = road.b[0] - road.a[0],
      dz = road.b[1] - road.a[1],
      t = Math.max(
        0,
        Math.min(
          1,
          ((x - road.a[0]) * dx + (z - road.a[1]) * dz) /
            (dx * dx + dz * dz || 1),
        ),
      );
    const q = [road.a[0] + dx * t, road.a[1] + dz * t],
      d = Math.hypot(x - q[0], z - q[1]);
    if (d < nearest) {
      nearest = d;
      target = q;
    }
  }
  if (nearest > 65) return null;
  if ((target[0] - x) * v[0] + (target[1] - z) * v[1] < 0) v = v.map((n) => -n);
  return {
    x,
    z,
    width: width * fit,
    depth: depth * fit,
    height: building.height,
    yaw: Math.atan2(v[0], v[1]),
  };
}
export function createHouse(building, roads) {
  const placement = housePlacement(building, roads);
  if (!placement || library.size !== HOUSE_MODELS.length) return null;
  const candidates = [...library].filter(([, a]) => {
    const sy = placement.height / a.size.y,
      sx = placement.width / a.size.x,
      sz = placement.depth / a.size.z;
    return (
      sy > 0.68 &&
      sy < 1.6 &&
      sx > 0.55 &&
      sx < 2.1 &&
      sz > 0.55 &&
      sz < 2.1 &&
      sx / sz > 0.6 &&
      sx / sz < 1.7
    );
  });
  if (!candidates.length) return null;
  const seed = Math.abs(
    Number(building.id) || Math.round(placement.x * 17 + placement.z * 31),
  );
  const [id, asset] = candidates[seed % candidates.length];
  const model = asset.scene.clone(true);
  model.position.set(-asset.center.x, -asset.minY, -asset.center.z);
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const root = new THREE.Group();
  root.add(model);
  root.scale.set(
    placement.width / asset.size.x,
    placement.height / asset.size.y,
    placement.depth / asset.size.z,
  );
  root.position.set(placement.x, 0, placement.z);
  root.rotation.y = placement.yaw;
  root.userData = {
    houseAsset: id,
    footprintId: building.id ?? null,
    height: building.height,
    heightSource: building.heightSource,
  };
  return root;
}
