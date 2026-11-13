import { blocksMove, bodyRadius } from "./harm.js";
import { laneLateral } from "./routes.js";
import { SIREN_TONES } from "./vehicles.js";

export const CITY_SERVICES = {
  officers: 5,
  junkies: 3,
  policeCars: 3,
  ambulances: 2,
  fireEngines: 2,
};

export const ROUND_SPEED = 1.15;

export const OFFICERS = [
  { name: "Ramesh", service: "police", kind: "officer", gender: "man", garment: "shirt", height: 1.78, skin: 0xd4a87c, hair: 0x241c18, top: 0xc4a36a, bottom: 0x3e342c },
  { name: "Sunil", service: "police", kind: "officer", gender: "man", garment: "shirt", height: 1.74, skin: 0xc9a07a, hair: 0x2b2420, top: 0xc4a36a, bottom: 0x3a3228 },
  { name: "Gauri", service: "police", kind: "officer", gender: "woman", garment: "shirt", height: 1.64, skin: 0xe0bc96, hair: 0x1c1614, top: 0xc4a36a, bottom: 0x3e342c },
  { name: "Nitin", service: "police", kind: "officer", gender: "man", garment: "shirt", height: 1.8, skin: 0xd0a67e, hair: 0x3a3028, top: 0xb9975c, bottom: 0x342c24 },
  { name: "Seema", service: "police", kind: "officer", gender: "woman", garment: "shirt", height: 1.66, skin: 0xe4c0a0, hair: 0x241c18, top: 0xc4a36a, bottom: 0x3e342c },
];

export const WANDERERS = [
  { name: "Raju", service: "junkie", kind: "wanderer", gender: "man", garment: "shirt", height: 1.7, skin: 0xc89870, hair: 0x2a2018, top: 0x6d6458, bottom: 0x4a4038 },
  { name: "Salim", service: "junkie", kind: "wanderer", gender: "man", garment: "shirt", height: 1.73, skin: 0xd6b08a, hair: 0x1a1410, top: 0x5c5348, bottom: 0x3e3830 },
  { name: "Gopal", service: "junkie", kind: "wanderer", gender: "man", garment: "shirt", height: 1.68, skin: 0xd8b08a, hair: 0x3a3028, top: 0x7a6a58, bottom: 0x524838 },
];

export function officerProfile(index) {
  return OFFICERS[Math.abs(index) % OFFICERS.length];
}

export function junkieProfile(index) {
  return WANDERERS[Math.abs(index) % WANDERERS.length];
}

export function serviceFleet() {
  const bodies = [];
  for (let i = 0; i < CITY_SERVICES.policeCars; i++)
    bodies.push(["police-patrol-suv", "police-classic-jeep", "police-transport"][i % 3]);
  for (let i = 0; i < CITY_SERVICES.ambulances; i++) bodies.push("ambulance-van");
  for (let i = 0; i < CITY_SERVICES.fireEngines; i++) bodies.push("fire-engine");
  return bodies;
}

export function serviceSpeed(kind, index = 0) {
  if (kind === "police") return 7.1 + (index % 3) * 0.25;
  if (kind === "ambulance") return 7.4 + (index % 2) * 0.2;
  return 6.1 + (index % 2) * 0.15;
}

export function serviceLateral(segment, direction) {
  return laneLateral(segment, "car", direction);
}

// A smooth crossfade between two pitches. No sample, no copied yelp.
export function sirenFrequency(tone, time) {
  const spec = tone || SIREN_TONES.police;
  const phase = (Math.sin(time * Math.PI * 2 * spec.rate) + 1) / 2;
  return spec.low + (spec.high - spec.low) * phase;
}

export function beaconLit(rate, time) {
  return Math.sin(time * Math.PI * 2 * (rate || 1)) >= 0;
}

export function nextWander(state, dt) {
  const wait = (state.wait ?? 0) - dt;
  if (wait > 0) return { speed: state.speed ?? 0.5, wait, reverse: false };
  const roll = state.rng();
  const hold = 0.8 + state.rng() * 2.2;
  if (roll < 0.4) return { speed: 0, wait: hold, reverse: false };
  if (roll < 0.62) return { speed: 0.35 + state.rng() * 0.25, wait: hold, reverse: true };
  return { speed: 0.4 + state.rng() * 0.45, wait: hold, reverse: false };
}

export function applyWander(agent, dt) {
  const choice = nextWander(
    { speed: agent.speed, wait: agent.wait ?? 0, rng: agent.rng },
    dt,
  );
  agent.wait = choice.wait;
  agent.speed = choice.speed;
  if (choice.reverse && Array.isArray(agent.points) && agent.points.length > 1) {
    const walked = agent.points.slice(0, (agent.index || 0) + 1);
    if (walked.length >= 2) {
      agent.points = walked.reverse();
      agent.index = 0;
    }
  }
  return choice;
}

// Shared with ordinary traffic: a step that meets a person or another body does not proceed.
export function passage({ x, z, kind, people = [], bodies = [] }) {
  const radius = bodyRadius(kind);
  const personRadius = bodyRadius("person");
  const hit =
    people.find(
      (person) =>
        Math.hypot(x - person.x, z - person.z) <
        radius + (person.radius ?? personRadius),
    ) || null;
  const blocked = blocksMove(x, z, radius, bodies);
  return { hit, blocked, clear: !hit && !blocked };
}

export function serviceMapColor(kind) {
  if (kind === "police") return "#2f5f98";
  if (kind === "ambulance") return "#f7f1e8";
  if (kind === "fire") return "#b4332a";
  return "#f4f7f2";
}

export function personMapColor(service) {
  if (service === "police") return "#e2c27a";
  if (service === "junkie") return "#a89078";
  return "#7dcea0";
}
