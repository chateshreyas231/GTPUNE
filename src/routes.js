export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function nodeKey(point) {
  return `${point[0].toFixed(1)},${point[1].toFixed(1)}`;
}
function snap(n) {
  return Math.round(n * 10) / 10;
}
function withLength(segment) {
  const a = [snap(segment.a[0]), snap(segment.a[1])];
  const b = [snap(segment.b[0]), snap(segment.b[1])];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    ...segment,
    a,
    b,
    length,
    angle: Math.atan2(b[0] - a[0], b[1] - a[1]),
  };
}
function lerpPoint(a, b, t) {
  return [snap(a[0] + (b[0] - a[0]) * t), snap(a[1] + (b[1] - a[1]) * t)];
}
function paramOn(point, segment) {
  const dx = segment.b[0] - segment.a[0],
    dz = segment.b[1] - segment.a[1],
    len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return null;
  const t = ((point[0] - segment.a[0]) * dx + (point[1] - segment.a[1]) * dz) / len2;
  if (t < -0.002 || t > 1.002) return null;
  const x = segment.a[0] + dx * t,
    z = segment.a[1] + dz * t;
  if (Math.hypot(x - point[0], z - point[1]) > 1.25) return null;
  return Math.min(1, Math.max(0, t));
}
function segmentCrossing(p, q) {
  const rx = p.b[0] - p.a[0],
    rz = p.b[1] - p.a[1],
    sx = q.b[0] - q.a[0],
    sz = q.b[1] - q.a[1],
    denom = rx * sz - rz * sx,
    qpx = q.a[0] - p.a[0],
    qpz = q.a[1] - p.a[1];
  if (Math.abs(denom) > 1e-6) {
    const t = (qpx * sz - qpz * sx) / denom,
      u = (qpx * rz - qpz * rx) / denom;
    if (t >= -1e-4 && t <= 1 + 1e-4 && u >= -1e-4 && u <= 1 + 1e-4)
      return {
        t: Math.min(1, Math.max(0, t)),
        u: Math.min(1, Math.max(0, u)),
      };
    return null;
  }
  const hits = [
    [paramOn(q.a, p), 0],
    [paramOn(q.b, p), 1],
    [0, paramOn(p.a, q)],
    [1, paramOn(p.b, q)],
  ];
  for (const [t, u] of hits) if (t != null && u != null) return { t, u };
  return null;
}
// Break every crossing and T-junction so traffic can leave on another road.
export function splitRoadsAtJunctions(segments) {
  const prepared = segments.map(withLength).filter((s) => s.length >= 0.5);
  const cuts = prepared.map(() => [0, 1]);
  const cell = 90;
  const buckets = new Map();
  prepared.forEach((seg, index) => {
    const minX = Math.min(seg.a[0], seg.b[0]),
      maxX = Math.max(seg.a[0], seg.b[0]),
      minZ = Math.min(seg.a[1], seg.b[1]),
      maxZ = Math.max(seg.a[1], seg.b[1]);
    for (let x = Math.floor(minX / cell); x <= Math.floor(maxX / cell); x++)
      for (let z = Math.floor(minZ / cell); z <= Math.floor(maxZ / cell); z++) {
        const key = `${x},${z}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(index);
      }
  });
  const seen = new Set();
  for (const ids of buckets.values())
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i],
          b = ids[j],
          key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const hit = segmentCrossing(prepared[a], prepared[b]);
        if (!hit) continue;
        if (hit.t > 0.004 && hit.t < 0.996) cuts[a].push(hit.t);
        if (hit.u > 0.004 && hit.u < 0.996) cuts[b].push(hit.u);
      }
  const out = [];
  prepared.forEach((seg, index) => {
    const ts = [...new Set(cuts[index].map((t) => Math.round(t * 1000) / 1000))].sort(
      (a, b) => a - b,
    );
    for (let k = 1; k < ts.length; k++) {
      const pa = lerpPoint(seg.a, seg.b, ts[k - 1]),
        pb = lerpPoint(seg.a, seg.b, ts[k]),
        length = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (length < 0.8) continue;
      out.push({
        ...seg,
        a: pa,
        b: pb,
        length,
        angle: Math.atan2(pb[0] - pa[0], pb[1] - pa[1]),
      });
    }
  });
  return out;
}
export function roadAdjacency(segments) {
  const map = new Map();
  for (const segment of segments)
    for (const end of [segment.a, segment.b]) {
      const key = nodeKey(end);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(segment);
    }
  return map;
}
function exitsAt(adjacency, node, previous, recent) {
  const mapped = (adjacency.get(node) || [])
    .map((segment) => {
      const direction = nodeKey(segment.a) === node ? 1 : -1;
      return {
        segment,
        direction,
        fromT: direction === 1 ? 0 : 1,
        nextNode: nodeKey(direction === 1 ? segment.b : segment.a),
        len: segment.length,
      };
    })
    .filter((choice) => choice.len > 0.4);
  const forward = mapped.filter((choice) => choice.segment !== previous);
  const pool = forward.length ? forward : mapped;
  const fresh = pool.filter((choice) => !recent.includes(choice.segment));
  return fresh.length ? fresh : pool;
}
function chooseExit(exits, goal, rng) {
  if (!goal) return exits[Math.floor(rng() * exits.length) % exits.length];
  const scored = exits
    .map((exit) => {
      const end = exit.direction === 1 ? exit.segment.b : exit.segment.a;
      return {
        ...exit,
        dist: Math.hypot(end[0] - goal[0], end[1] - goal[1]),
      };
    })
    .sort((a, b) => a.dist - b.dist || a.len - b.len);
  const best = scored[0].dist;
  const near = scored.filter((exit) => exit.dist <= best + 8);
  return near[Math.floor(rng() * near.length) % near.length];
}
// A directed trip along the road graph. The first exit at a junction is never
// the segment just used while another exit exists, so traffic does not shuttle.
export function planTrip({
  adjacency,
  fromSegment,
  fromT = 0,
  direction = 1,
  atNode = null,
  goal = null,
  minLength = 36,
  rng = Math.random,
  maxSteps = 12,
}) {
  const steps = [];
  let length = 0;
  const recent = [];
  let node = atNode;
  if (!atNode) {
    const dir = direction >= 0 ? 1 : -1;
    const t = Math.min(1, Math.max(0, fromT));
    const endT = dir === 1 ? 1 : 0;
    const stepLen = Math.abs(endT - t) * fromSegment.length;
    if (stepLen >= 0.4) {
      steps.push({ segment: fromSegment, direction: dir, fromT: t });
      length += stepLen;
      recent.push(fromSegment);
    }
    node = nodeKey(dir === 1 ? fromSegment.b : fromSegment.a);
  }
  let previous = steps.length ? steps[steps.length - 1].segment : fromSegment;
  while (length < minLength && steps.length < maxSteps) {
    const exits = exitsAt(adjacency, node, previous, recent);
    if (!exits.length) break;
    const pick = chooseExit(exits, goal, rng);
    steps.push({
      segment: pick.segment,
      direction: pick.direction,
      fromT: pick.fromT,
    });
    length += pick.len;
    recent.push(pick.segment);
    if (recent.length > 8) recent.shift();
    previous = pick.segment;
    node = pick.nextNode;
  }
  return { steps, length, endNode: node, endSegment: previous, goal };
}
export function segmentPoint(segment, t, lateral = 0) {
  const len = segment.length || Math.hypot(segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]);
  const dx = (segment.b[0] - segment.a[0]) / len,
    dz = (segment.b[1] - segment.a[1]) / len,
    x = segment.a[0] + (segment.b[0] - segment.a[0]) * t,
    z = segment.a[1] + (segment.b[1] - segment.a[1]) * t;
  return [x - dz * lateral, z + dx * lateral];
}
export function tripPolyline(trip, lateralForStep = () => 0) {
  const points = [];
  const push = (point) => {
    const last = points[points.length - 1];
    if (!last || Math.hypot(last[0] - point[0], last[1] - point[1]) > 0.3)
      points.push(point);
  };
  for (const step of trip.steps || []) {
    const lateral = lateralForStep(step) || 0;
    const endT = step.direction === 1 ? 1 : 0;
    push(segmentPoint(step.segment, step.fromT, lateral));
    push(segmentPoint(step.segment, endT, lateral));
  }
  return points;
}
export function advanceAlong(state, dt) {
  const points = state.points;
  if (!points || points.length < 2)
    return { ...state, arrived: true };
  let left = Math.max(0, state.speed || 0) * dt;
  let x = state.x,
    z = state.z,
    index = state.index || 0,
    yaw = state.yaw || 0;
  while (left > 0 && index < points.length - 1) {
    const next = points[index + 1];
    const dx = next[0] - x,
      dz = next[1] - z,
      dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      index += 1;
      x = next[0];
      z = next[1];
      continue;
    }
    yaw = Math.atan2(-dx, -dz);
    const step = Math.min(left, dist);
    x += (dx / dist) * step;
    z += (dz / dist) * step;
    left -= step;
    if (step >= dist - 1e-4) index += 1;
  }
  return {
    ...state,
    x,
    z,
    index,
    yaw,
    arrived: index >= points.length - 1,
  };
}
export function chooseGoal(segments, from, minDistance, rng = Math.random) {
  let farthest = null;
  const consider = (point) => {
    const dist = Math.hypot(point[0] - from[0], point[1] - from[1]);
    if (!farthest || dist > farthest.dist) farthest = { point, dist };
    return dist >= minDistance ? point : null;
  };
  const tries = Math.min(segments.length, 16);
  for (let i = 0; i < tries; i++) {
    const segment = segments[Math.floor(rng() * segments.length) % segments.length];
    const hit = consider(segmentPoint(segment, Math.min(0.85, 0.2 + (i % 5) * 0.15), 0));
    if (hit) return hit;
  }
  for (const segment of segments) {
    const hit = consider(segmentPoint(segment, 0.5, 0));
    if (hit) return hit;
  }
  return farthest ? farthest.point : [from[0], from[1]];
}
export function laneLateral(segment, kind, direction) {
  const width = segment.width || 8;
  const meters =
    kind === "motorcycle"
      ? Math.min(width * 0.34, 3.6)
      : Math.min(width * 0.18, 2.2);
  return (direction >= 0 ? 1 : -1) * meters;
}
export function sidewalkLateral(segment, side) {
  return (side >= 0 ? 1 : -1) * ((segment.width || 8) / 2 + 1.65);
}
