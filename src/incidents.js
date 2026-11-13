export const INCIDENTS = [
  {
    id: "stalled-vehicle",
    notice: "A car has stalled in the lane.",
    duration: 46,
  },
  {
    id: "stall-crowd",
    notice: "A small crowd has gathered at a tea stall.",
    duration: 52,
    crowd: 6,
  },
  {
    id: "roadside-breakdown",
    notice: "A scooter has broken down at the side of the road.",
    duration: 48,
  },
];

export function createIncidentSchedule({
  rng = Math.random,
  firstDelay = 22,
  gap = 34,
  limit = 2,
} = {}) {
  return {
    rng,
    nextIn: firstDelay,
    gap,
    limit,
    active: new Set(),
    seen: new Set(),
  };
}

export function chooseIncident(schedule) {
  const open = INCIDENTS.filter((item) => !schedule.active.has(item.id));
  if (!open.length) return null;
  const unseen = open.filter((item) => !schedule.seen.has(item.id));
  if (unseen.length) return unseen[0];
  const index = Math.floor(schedule.rng() * open.length) % open.length;
  return open[index];
}

export function tickSchedule(schedule, dt, { playing = true } = {}) {
  if (!playing) return null;
  schedule.nextIn -= Math.max(0, Number(dt) || 0);
  if (schedule.nextIn > 0) return null;
  if (schedule.active.size >= schedule.limit) {
    schedule.nextIn = 5;
    return null;
  }
  const pick = chooseIncident(schedule);
  if (!pick) {
    schedule.nextIn = 5;
    return null;
  }
  schedule.active.add(pick.id);
  schedule.seen.add(pick.id);
  schedule.nextIn = schedule.gap + schedule.rng() * 12;
  return pick;
}

export function releaseIncident(schedule, id) {
  schedule.active.delete(id);
}

// Prefer a point ahead of the facing direction, still on a surveyed segment.
export function pickIncidentSite(roads, x, z, yaw, options = {}) {
  const min = options.min ?? 22;
  const max = options.max ?? 78;
  const reach = options.reach ?? 46;
  const aimX = x - Math.sin(yaw) * reach;
  const aimZ = z - Math.cos(yaw) * reach;
  let best = null;
  for (const segment of roads || []) {
    if (!segment || !(segment.length >= 16)) continue;
    const dx = segment.b[0] - segment.a[0];
    const dz = segment.b[1] - segment.a[1];
    const len2 = dx * dx + dz * dz || 1;
    const raw = ((aimX - segment.a[0]) * dx + (aimZ - segment.a[1]) * dz) / len2;
    const t = Math.max(0.14, Math.min(0.86, raw));
    const px = segment.a[0] + dx * t;
    const pz = segment.a[1] + dz * t;
    const d = Math.hypot(px - x, pz - z);
    if (d < min || d > max) continue;
    const score = Math.hypot(px - aimX, pz - aimZ);
    if (!best || score < best.score) best = { segment, t, d, score };
  }
  return best;
}

export function nearestRoadSite(roads, x, z, along = 36) {
  let best = null;
  for (const segment of roads || []) {
    if (!segment || !(segment.length >= 16)) continue;
    const dx = segment.b[0] - segment.a[0];
    const dz = segment.b[1] - segment.a[1];
    const len2 = dx * dx + dz * dz || 1;
    const raw = ((x - segment.a[0]) * dx + (z - segment.a[1]) * dz) / len2;
    const t = Math.max(0.08, Math.min(0.92, raw));
    const px = segment.a[0] + dx * t;
    const pz = segment.a[1] + dz * t;
    const d = Math.hypot(px - x, pz - z);
    if (!best || d < best.d) best = { segment, t, d };
  }
  if (!best) return null;
  const shift = along / Math.max(best.segment.length, 1);
  const t = Math.max(
    0.12,
    Math.min(0.88, best.t < 0.5 ? best.t + shift : best.t - shift),
  );
  return { segment: best.segment, t, d: best.d };
}

// A shallow group on the footpath, not a ring that spills into the lane.
export function crowdRing(count = 6) {
  const spots = [];
  for (let i = 0; i < count; i += 1) {
    spots.push({
      along: (i - (count - 1) / 2) * 0.82,
      out: i % 2 === 0 ? 0.2 : 0.95,
    });
  }
  return spots;
}
