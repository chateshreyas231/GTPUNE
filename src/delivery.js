export function createDelivery(pickup, dropoff) {
  return {
    phase: "pickup",
    pickup: [...pickup],
    dropoff: [...dropoff],
    remaining: 360,
    reward: 450,
  };
}
export function tickDelivery(job, dt) {
  if (!["pickup", "delivery"].includes(job.phase)) return job;
  const remaining = Math.max(0, job.remaining - dt);
  return { ...job, remaining, phase: remaining === 0 ? "failed" : job.phase };
}
export function interactDelivery(job, position, onFoot) {
  if (!["pickup", "delivery"].includes(job.phase) || !onFoot)
    return { job, paid: 0 };
  const target = job.phase === "pickup" ? job.pickup : job.dropoff;
  if (Math.hypot(position[0] - target[0], position[1] - target[1]) > 14)
    return { job, paid: 0 };
  return job.phase === "pickup"
    ? { job: { ...job, phase: "delivery" }, paid: 0 }
    : { job: { ...job, phase: "complete" }, paid: job.reward };
}
