// Original game rules: escalating witnesses, a bounded search and surrender.
export const CRIME_HEAT = { assault: 2, vehicleTheft: 1, hitAndRun: 3 };
export function createLaw() {
  return { heat: 0, stars: 0, search: 0, surrender: 0 };
}
export function reportCrime(state, type, { witnessed = true } = {}) {
  const amount = CRIME_HEAT[type];
  if (!amount || !witnessed) return state;
  const heat = Math.min(10, state.heat + amount);
  return {
    ...state,
    heat,
    stars: Math.min(5, Math.ceil(heat / 2)),
    search: 45 + Math.ceil(heat / 2) * 15,
    surrender: 0,
  };
}
export function tickLaw(
  state,
  dt,
  { seen = false, nearOfficer = false, surrendering = false } = {},
) {
  dt = Math.max(0, Math.min(1, Number(dt) || 0));
  if (!state.stars) return { ...createLaw(), arrested: false };
  const surrender = nearOfficer && surrendering ? state.surrender + dt : 0;
  if (surrender >= 3) return { ...createLaw(), arrested: true };
  const search = seen ? 45 + state.stars * 15 : Math.max(0, state.search - dt);
  if (search === 0) return { ...createLaw(), arrested: false };
  return { ...state, search, surrender, arrested: false };
}
