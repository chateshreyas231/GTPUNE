import * as THREE from "three";
import { project } from "./city.js";

export const PLACE_MARKS = {
  fuel: { color: "#e07a3d", shape: "diamond" },
  gym: { color: "#5aa7c4", shape: "square" },
  ground: { color: "#7dce6a", shape: "rect" },
};

const NEIGHBOURHOODS = [
  { area: "FC", lat: 18.5238, lon: 73.8404 },
  { area: "Deccan", lat: 18.5174, lon: 73.8396 },
  { area: "Kothrud", lat: 18.5082, lon: 73.8088 },
];

const mats = new Map();
function mat(color, roughness = 0.7, metalness = 0.05) {
  const key = `${color}:${roughness}:${metalness}`;
  if (!mats.has(key))
    mats.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    );
  return mats.get(key);
}
function box(group, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
function signMaterial(text) {
  if (typeof document === "undefined") return mat(0xf4efe2, 0.6, 0);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4efe2";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#1c2b28";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 46;
  ctx.font = `700 ${size}px sans-serif`;
  while (size > 18 && ctx.measureText(text).width > 480) {
    size -= 2;
    ctx.font = `700 ${size}px sans-serif`;
  }
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture });
}

export function placeKind(tags = {}) {
  if (tags.amenity === "fuel") return "fuel";
  if (
    tags.amenity === "gym" ||
    tags.leisure === "fitness_centre" ||
    tags.leisure === "fitness_station"
  )
    return "gym";
  if (["pitch", "playground", "track"].includes(tags.leisure)) return "ground";
  if (tags.sport) return "ground";
  return null;
}

function areaLabel(lat, lon) {
  if (lon < 73.825) return "Kothrud";
  if (lat >= 18.52) return "FC";
  return "Deccan";
}

function centroid(element) {
  if (Array.isArray(element.geometry) && element.geometry.length) {
    let lat = 0;
    let lon = 0;
    for (const point of element.geometry) {
      lat += point.lat;
      lon += point.lon;
    }
    return {
      lat: lat / element.geometry.length,
      lon: lon / element.geometry.length,
    };
  }
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon))
    return { lat: element.lat, lon: element.lon };
  return null;
}

function besideFootprint(element, kind) {
  const geometry = Array.isArray(element.geometry) ? element.geometry : [];
  const points = geometry.length
    ? geometry.map((point) => project(point.lat, point.lon))
    : Number.isFinite(element.lat)
      ? [project(element.lat, element.lon)]
      : [];
  if (!points.length) return null;
  let cx = 0;
  let cz = 0;
  let maxX = -Infinity;
  for (const point of points) {
    cx += point[0];
    cz += point[1];
    maxX = Math.max(maxX, point[0]);
  }
  cx /= points.length;
  cz /= points.length;
  if (points.length < 3) return [cx, cz];
  const pad = kind === "ground" ? 18 : kind === "fuel" ? 10 : 6;
  return [maxX + pad, cz];
}

export function placesFromElements(elements = []) {
  const places = [];
  for (const element of elements) {
    const tags = element.tags || {};
    const kind = placeKind(tags);
    if (!kind) continue;
    const center = centroid(element);
    const point = besideFootprint(element, kind);
    if (!center || !point) continue;
    const noun = kind === "fuel" ? "Fuel" : kind === "gym" ? "Gym" : "Ground";
    const named = typeof tags.name === "string" ? tags.name.trim() : "";
    places.push({
      kind,
      name: named || `${areaLabel(center.lat, center.lon)} ${noun}`,
      lat: center.lat,
      lon: center.lon,
      point,
      open: ["pitch", "playground", "track"].includes(tags.leisure),
      source: "osm",
    });
  }
  return places;
}

export function supplementPlaces(places) {
  const out = places.slice();
  for (const kind of ["fuel", "gym", "ground"]) {
    const count =
      kind === "ground"
        ? out.filter((place) => place.kind === "ground" && place.open).length
        : out.filter((place) => place.kind === kind).length;
    if (count >= 2) continue;
    const noun = kind === "fuel" ? "Fuel" : kind === "gym" ? "Gym" : "Ground";
    for (const area of NEIGHBOURHOODS)
      out.push({
        kind,
        name: `${area.area} ${noun}`,
        lat: area.lat,
        lon: area.lon,
        point: project(area.lat, area.lon),
        open: kind === "ground",
        source: "neighbourhood",
      });
  }
  return out;
}

function buildFuel(group, name) {
  const parts = new Set(["canopy", "pump"]);
  box(group, 16, 0.08, 10, mat(0x6e7370, 0.9, 0.05), 0, 0.28, 0);
  for (const x of [-6, 6])
    for (const z of [-3.5, 3.5])
      box(group, 0.28, 3.3, 0.28, mat(0x5c6562), x, 1.95, z);
  box(group, 14.4, 0.28, 9.2, mat(0xd07a3a), 0, 3.7, 0);
  for (const x of [-2.2, 2.2]) {
    box(group, 0.7, 1.35, 0.45, mat(0xf4f1e8), x, 0.95, 0);
    box(group, 0.12, 0.8, 0.12, mat(0x222422), x + 0.46, 1.05, 0);
  }
  box(group, 4.4, 0.9, 0.08, signMaterial(name), 0, 4.35, 0);
  group.userData.parts = [...parts];
}

function buildGym(group, name) {
  box(group, 8.2, 4.2, 0.45, mat(0xc8bfae), 0, 2.3, 0);
  box(group, 1.4, 2.2, 0.16, mat(0x2d3332), 0, 1.2, 0.28);
  box(group, 2.1, 1.15, 0.1, mat(0x8fb8c4), -2.3, 2.7, 0.28);
  box(group, 2.1, 1.15, 0.1, mat(0x8fb8c4), 2.3, 2.7, 0.28);
  box(group, 3.6, 0.7, 0.1, signMaterial(name), 0, 3.7, 0.32);
  group.userData.parts = ["front"];
}

function buildGround(group, name) {
  const parts = new Set(["marking", "goal"]);
  const line = mat(0xf4f7f2, 0.8, 0);
  box(group, 28, 0.08, 16, mat(0x3f7d45, 0.95, 0), 0, 0.24, 0);
  box(group, 0.14, 0.02, 15.2, line, 0, 0.29, 0);
  box(group, 26.4, 0.02, 0.14, line, 0, 0.29, 0);
  box(group, 28, 0.02, 0.14, line, 0, 0.29, 7.7);
  box(group, 28, 0.02, 0.14, line, 0, 0.29, -7.7);
  box(group, 0.14, 0.02, 16, line, 13.7, 0.29, 0);
  box(group, 0.14, 0.02, 16, line, -13.7, 0.29, 0);
  for (const x of [-13.2, 13.2]) {
    box(group, 0.1, 1.7, 0.1, line, x, 1.05, -2.2);
    box(group, 0.1, 1.7, 0.1, line, x, 1.05, 2.2);
    box(group, 0.1, 0.1, 4.5, line, x, 1.85, 0);
  }
  box(group, 3.4, 0.5, 0.08, signMaterial(name), 0, 2.3, -8.4);
  group.userData.parts = [...parts];
}

export function makePlace(place) {
  const group = new THREE.Group();
  if (place.kind === "fuel") buildFuel(group, place.name);
  else if (place.kind === "gym") buildGym(group, place.name);
  else buildGround(group, place.name);
  group.userData.kind = place.kind;
  group.userData.name = place.name;
  group.position.set(place.point[0], 0, place.point[1]);
  return group;
}
