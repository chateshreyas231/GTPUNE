const LOOKS = ["girl", "boy", "man"],
  WEAPONS = ["fists", "pipe", "stick", "stone"],
  WEATHER = ["clear", "drizzle", "monsoon", "blue-hour"];
export function normalizeProgress(raw) {
  if (!raw || raw.version !== 1) return null;
  const owned = [
    "fists",
    ...WEAPONS.filter((id) => id !== "fists" && raw.owned?.includes?.(id)),
  ];
  return {
    version: 1,
    wallet: Math.max(
      0,
      Math.min(
        999999,
        Number.isFinite(raw.wallet) ? Math.floor(raw.wallet) : 0,
      ),
    ),
    look: LOOKS.includes(raw.look) ? raw.look : "girl",
    owned,
    selected: owned.includes(raw.selected) ? raw.selected : "fists",
    weather: WEATHER.includes(raw.weather) ? raw.weather : "clear",
  };
}
export function loadProgress(storage) {
  try {
    storage ??= globalThis.localStorage;
    return normalizeProgress(JSON.parse(storage.getItem("pune-progress-v1")));
  } catch {
    return null;
  }
}
export function saveProgress(data, storage) {
  try {
    storage ??= globalThis.localStorage;
    const value = normalizeProgress({ version: 1, ...data });
    storage.setItem("pune-progress-v1", JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
