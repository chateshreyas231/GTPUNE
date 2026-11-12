export function clampScene(value) {
  return Math.max(0, Math.min(100, value));
}

export function sceneBeat(before, after) {
  if (before < 100 && after >= 100) return "scene";
  if (before < 70 && after >= 70) return "blocked";
  if (before < 40 && after >= 40) return "shout";
  return null;
}

export const streetObjects = ["chappal", "newspaper", "dabba"];
