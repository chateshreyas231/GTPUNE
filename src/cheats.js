const CHEATS = {
  pavsa(save) {
    save.weather = "rain";
  },
  unhala(save) {
    save.weather = "clear";
  },
  paise(save) {
    save.cash += 100;
  },
};

export function applyCheat(save, word) {
  const cleaned = String(word ?? "").trim().toLowerCase();
  const use = CHEATS[cleaned];
  if (!use) return { accepted: false, save };

  const next = structuredClone(save);
  use(next);
  next.cheated = true;
  if (!next.cheatsUsed.includes(cleaned)) next.cheatsUsed = [...next.cheatsUsed, cleaned];
  return { accepted: true, save: next };
}
