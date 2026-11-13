import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// User-defined fleet classes; all civilian cars are authored in Blender.
export const SUPERCARS = {
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
export const NORMAL_CARS = {
  "pune-electric": { label: "Pune Electric", color: 0x737c8d, cheat: "CITYEV" },
  "deccan-coupe": {
    label: "Deccan Coupe",
    color: 0xd6d8dd,
    cheat: "SILVERCOUPE",
  },
  "pune-classic": {
    label: "Pune Classic",
    color: 0x7aadaf,
    cheat: "CLASSICBUG",
  },
  "ghat-roadster": {
    label: "Ghat Roadster",
    color: 0x7c8086,
    cheat: "ROADSTER",
  },
  "city-hatch": { label: "City Hatch", color: 0xf0a219, cheat: "CITYHATCH" },
};
for (const spec of Object.values(NORMAL_CARS)) spec.tier = "normal";
for (const spec of Object.values(SUPERCARS)) spec.tier = "super";
export const REFERENCE_CARS = { ...NORMAL_CARS, ...SUPERCARS };
export const TRANSPORT_VEHICLES = {
  "city-green-bus": {
    label: "Green City Bus",
    kind: "bus",
    cheat: "CITYBUS",
    length: 11.2,
  },
  "state-red-coach": {
    label: "State Express Coach",
    kind: "bus",
    cheat: "STATECOACH",
    length: 11.4,
  },
  "state-red-bus": {
    label: "Red State Bus",
    kind: "bus",
    cheat: "STATEBUS",
    length: 10.4,
  },
  "police-transport": {
    label: "Police Transport",
    kind: "police",
    cheat: "POLICEBUS",
    length: 8.5,
  },
  "police-patrol-suv": {
    label: "Police Patrol SUV",
    kind: "police",
    cheat: "PATROLSUV",
    length: 4.65,
  },
  "police-classic-jeep": {
    label: "Police Classic Jeep",
    kind: "police",
    cheat: "POLICEJEEP",
    length: 4.2,
  },
};
export const BLENDER_VEHICLES = { ...REFERENCE_CARS, ...TRANSPORT_VEHICLES };
// Compatibility for old saved/debug requests, without constructing the old cars.
export const LEGACY_CAR_REPLACEMENTS = {
  "compact-suv": "city-hatch",
  "boxy-offroader": "pune-classic",
  "tall-suv": "pune-electric",
  "police-sedan": "police-patrol-suv",
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
  if (!BLENDER_VEHICLES[body]) return root;
  // Node unit tests exercise the procedural fallback; network loading is browser-only.
  if (typeof document === "undefined") return root;
  const task = load(body)
    .then((gltf) => {
      const model = gltf.scene.clone(true);
      const wheels = [];
      const beacons = [];
      model.traverse((object) => {
        if (object.name.startsWith("wheel_")) wheels.push(object);
        if (!object.isMesh) return;
        if (object.name.startsWith("beacon_")) {
          object.material = object.material.clone();
          object.material.emissive.copy(object.material.color);
          beacons.push(object);
        }
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
      root.userData.beacons = beacons;
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
    Object.keys(BLENDER_VEHICLES).map((body) => load(body).then(() => body)),
  );
}

export function vehicleAssetStatus() {
  return { cached: cache.size, pending: pending.size };
}
