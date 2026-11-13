// In-game overlap, crashes, and street weapons. Geometry and tones stay original.

export function bodyRadius(kind) {
  if (kind === "motorcycle") return 0.8;
  if (kind === "car" || kind === "player-car") return kind === "player-car" ? 1.35 : 1.25;
  return 0.45;
}

export function blocksMove(x, z, radius, bodies) {
  for (const body of bodies) {
    if (Math.hypot(x - body.x, z - body.z) < radius + body.radius) return true;
  }
  return false;
}

// A moving vehicle that reaches a person knocks them down. A hard hit kills.
export function crashFromImpact(speed) {
  const v = Math.abs(Number(speed) || 0);
  if (v < 1.5) return { knocked: false, dead: false, retain: 0.25, shove: 0 };
  return {
    knocked: true,
    dead: v >= 8,
    retain: 0.04,
    shove: Math.min(1.6, v * 0.15),
  };
}

export function applyImpact(person, impact, dirX = 0, dirZ = 0) {
  const current = person || {};
  if (!impact?.knocked || current.dead)
    return { ...current, changed: false };
  const health = Math.max(0, (current.health ?? 3) - (impact.dead ? 3 : 1));
  const dead = Boolean(impact.dead) || health <= 0;
  return {
    ...current,
    health,
    down: true,
    dead,
    x: (current.x || 0) + dirX * (impact.shove || 0),
    z: (current.z || 0) + dirZ * (impact.shove || 0),
    changed: true,
  };
}

export function canWalk(person) {
  return Boolean(person) && !person.dead && !person.down;
}

// Dead people stay down. A knock-down can get up only after downUntil.
export function resumeWalking(person, now) {
  if (!person || person.dead) return false;
  if (person.down && (person.downUntil == null || now < person.downUntil))
    return false;
  return true;
}

export const STREET_WEAPONS = [
  { id: "pipe", name: "Pipe", reach: 1.8, damage: 3 },
  { id: "stick", name: "Stick", reach: 1.55, damage: 1 },
  { id: "stone", name: "Stone", reach: 1.2, damage: 3 },
];

export function pickupWeapon(id) {
  return STREET_WEAPONS.find((weapon) => weapon.id === id) || null;
}

export function strikeHit({ weapon, distance, facingDot }) {
  if (!weapon) return { hit: false, damage: 0 };
  const reach = weapon.reach ?? 1.5;
  if (!(distance <= reach) || !(facingDot >= 0.4))
    return { hit: false, damage: 0 };
  return { hit: true, damage: weapon.damage ?? 1 };
}

export function applyStrike(person, hit) {
  const current = person || {};
  if (!hit?.hit || current.dead) return { ...current, changed: false };
  const health = Math.max(0, (current.health ?? 3) - hit.damage);
  const dead = health <= 0;
  return {
    ...current,
    health,
    down: true,
    dead,
    changed: true,
  };
}
