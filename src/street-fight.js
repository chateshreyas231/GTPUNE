// Player loadout, replies, and original cheat words. No imported weapon or vehicle data.

import { pickupWeapon, STREET_WEAPONS } from "./harm.js";

export const MAX_HEALTH = 3;

export const FISTS = { id: "fists", name: "Fists", reach: 1.15, damage: 1 };

// 1 fists, then the street weapons in STREET_WEAPONS order.
export function weaponBySlot(slot) {
  const index = Number(slot);
  if (index === 1) return FISTS;
  return STREET_WEAPONS[index - 2] || null;
}

export function emptyLoadout() {
  return { owned: ["fists"], selected: "fists" };
}

export function selectedWeapon(loadout) {
  if (!loadout || loadout.selected === "fists") return FISTS;
  return pickupWeapon(loadout.selected) || FISTS;
}

export function grantWeapon(loadout, id) {
  const current = loadout || emptyLoadout();
  const weapon = id === "fists" ? FISTS : pickupWeapon(id);
  if (!weapon) {
    return { owned: [...current.owned], selected: current.selected, granted: null };
  }
  const owned = current.owned.includes(weapon.id)
    ? [...current.owned]
    : [...current.owned, weapon.id];
  return { owned, selected: weapon.id, granted: weapon };
}

export function nextStreetWeapon(loadout) {
  const owned = new Set((loadout || emptyLoadout()).owned);
  return STREET_WEAPONS.find((weapon) => !owned.has(weapon.id))?.id || STREET_WEAPONS[0].id;
}

export function selectSlot(loadout, slot) {
  const current = loadout || emptyLoadout();
  const weapon = weaponBySlot(slot);
  if (!weapon) {
    return {
      owned: [...current.owned],
      selected: current.selected,
      ok: false,
      reason: "empty",
      weapon: null,
    };
  }
  if (!current.owned.includes(weapon.id)) {
    return {
      owned: [...current.owned],
      selected: current.selected,
      ok: false,
      reason: "missing",
      weapon,
    };
  }
  return { owned: [...current.owned], selected: weapon.id, ok: true, weapon };
}

export function healthLabel(health, max = MAX_HEALTH) {
  const hp = Math.max(0, Math.min(max, Math.round(Number(health) || 0)));
  return `HEALTH ${hp}/${max}`;
}

export function refillHealth(life, max = MAX_HEALTH) {
  return { ...(life || {}), health: max, down: false, dead: false, downUntil: null };
}

// Original words for this game. They are not codes from another title.
export const CHEAT_WORDS = {
  LOHAKATHI: "weapon",
  KAVACHVAN: "armor",
  NAVINMOTAR: "car",
  JEEVANBHAR: "health",
};

export function readCheat(text) {
  const code = String(text ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const effect = CHEAT_WORDS[code];
  if (!effect) return null;
  return { code, effect };
}

export function nearestReply(people, x, z, reach = 22) {
  let best = null;
  for (const person of people || []) {
    if (!person || person.dead || person.down) continue;
    const distance = Math.hypot((person.x || 0) - x, (person.z || 0) - z);
    if (distance > reach) continue;
    if (!best || distance < best.distance) best = { person, distance };
  }
  return best;
}

// Same yaw convention as driving: forward is (-sin yaw, -cos yaw).
export function faceYaw(fromX, fromZ, toX, toZ) {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

// Park to the right (side 1) or left (side -1) of a facing yaw.
export function parkBeside(x, z, yaw, { distance = 5.5, side = 1 } = {}) {
  const rx = Math.cos(yaw) * side;
  const rz = -Math.sin(yaw) * side;
  return { x: x + rx * distance, z: z + rz * distance, yaw };
}
