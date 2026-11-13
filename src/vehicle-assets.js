import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Original Blender designs, inspired by the five user-supplied photographs.
export const REFERENCE_CARS = {
  "deccan-supercar": {
    label: "Deccan Supercar",
    color: 0xd10616,
    cheat: "SUPERGT",
  },
  "heritage-gt": { label: "Heritage GT", color: 0xb8bfc7, cheat: "HERITAGEGT" },
  "sahyadri-suv": { label: "Sahyadri SUV", color: 0x7a8575, cheat: "SAHYADRI" },
  "deccan-muscle": {
    label: "Deccan Muscle",
    color: 0xdb0910,
    cheat: "MUSCLEGT",
  },
  "sunset-cabrio": { label: "Sunset Cabrio", color: 0xffa60c, cheat: "SUNSET" },
};
const loader = new GLTFLoader();
const cache = new Map();
const pending = new Map();

function load(body) {
  if (!cache.has(body)) {
    cache.set(body, loader.loadAsync(`/assets/pune-originals/${body}.glb`));
  }
  return cache.get(body);
}

export function attachVehicleAsset(root, body) {
  if (!REFERENCE_CARS[body]) return root;
  // Node unit tests exercise the procedural fallback; network loading is browser-only.
  if (typeof document === "undefined") return root;
  const task = load(body)
    .then((gltf) => {
      const model = gltf.scene.clone(true);
      const wheels = [];
      model.traverse((object) => {
        if (object.name.startsWith("wheel_")) wheels.push(object);
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });
      // Placeholder meshes are unique to this root. Cached GLB resources stay shared.
      const geometries = new Set(),
        materials = new Set();
      root.traverse((object) => {
        if (!object.isMesh) return;
        geometries.add(object.geometry);
        for (const material of [object.material].flat())
          materials.add(material);
      });
      root.clear();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      root.add(model);
      root.userData.wheels = wheels;
      root.userData.blenderAsset = body;
      root.userData.assetReady = true;
      pending.delete(root);
      return true;
    })
    .catch((error) => {
      root.userData.assetError = true;
      pending.delete(root);
      console.warn(`Vehicle asset fallback: ${body}`, error);
      return false;
    });
  pending.set(root, task);
  return root;
}

export async function prepareVehicleAssets() {
  return Promise.all(
    Object.keys(REFERENCE_CARS).map((body) => load(body).then(() => body)),
  );
}

export function vehicleAssetStatus() {
  return { cached: cache.size, pending: pending.size };
}
