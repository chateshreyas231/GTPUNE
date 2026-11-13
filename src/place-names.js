function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
    );
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}

export function roadTitle(road) {
  if (!road) return "";
  const alt = road.altName || "";
  const name = road.name || "";
  if (alt === "FC Road") return "Fergusson College Road";
  if (alt === "JM Road" || name === "Jangli Maharaj Path")
    return "Jangli Maharaj Road";
  if (alt && /road/i.test(alt)) return alt;
  return name;
}

export function roadUnder(x, z, segments) {
  let best = null,
    bestD = Infinity;
  for (const segment of segments) {
    const dist = segmentDistance(x, z, segment.a, segment.b);
    if (dist < bestD) {
      bestD = dist;
      best = segment;
    }
  }
  if (!best) return "";
  const limit = Math.max(16, (best.width || 12) / 2 + 8);
  if (bestD > limit) return "";
  return roadTitle(best);
}

export const PLASTER = {
  cream: 0xf4ead3,
  offWhite: 0xf7f5f0,
  paleYellow: 0xf3e3a4,
  salmon: 0xe8b59a,
  terracotta: 0xc46548,
  concrete: 0xb9b9b4,
  dustyRose: 0xd9aaa3,
  fadedGreen: 0xc5d2b4,
};
export const GLASS_PLASTER = 0xd5e4ee;
const PLASTER_LIST = Object.values(PLASTER);
export const SHOP_BANDS = [0x7c2f3b, 0x1f6b4a, 0x1d4f88, 0xc4892b];

function buildingSeed(building = {}) {
  if (building.id != null && Number.isFinite(Number(building.id)))
    return Math.abs(Number(building.id));
  return Math.round(Math.abs(building.color || 0) * 100000);
}

export function buildingLook(building = {}) {
  const seed = buildingSeed(building);
  const kind = building.kind || "yes";
  const glass =
    ["commercial", "retail", "office", "hotel"].includes(kind) ||
    building.shop === "mall" ||
    /mall/i.test(building.name || "");
  return {
    plaster: glass ? GLASS_PLASTER : PLASTER_LIST[seed % PLASTER_LIST.length],
    band: SHOP_BANDS[seed % SHOP_BANDS.length],
    glass,
    seed,
  };
}

export const SHOP_BOARDS = [
  { kind: "kirana", name: "Apna Kirana" },
  { kind: "medical", name: "Laxmi Medical" },
  { kind: "tea", name: "Tapri Chaha" },
  { kind: "bookstore", name: "FC Books" },
  { kind: "salon", name: "Nutan Salon" },
  { kind: "electronics", name: "Shree Electronics" },
  { kind: "bakery", name: "Annapurna Bakery" },
  { kind: "juice", name: "Nisarg Juice" },
  { kind: "tailor", name: "Suman Tailors" },
  { kind: "kirana", name: "Gharacha Kirana" },
  { kind: "medical", name: "Arogya Medical" },
  { kind: "tea", name: "Kaka Chi Chaha" },
  { kind: "bookstore", name: "Pustak Ghar" },
  { kind: "salon", name: "Keshav Salon" },
  { kind: "electronics", name: "Mobile Galli" },
  { kind: "bakery", name: "Bhavani Bakery" },
  { kind: "juice", name: "Fresh Juice Bar" },
  { kind: "tailor", name: "Stitch Point" },
];

export function frontageName(building = {}) {
  if (building.name) return building.name;
  return SHOP_BOARDS[buildingSeed(building) % SHOP_BOARDS.length].name;
}

export function isShopFront(building = {}) {
  if (building.shop && building.shop !== "no") return true;
  if (["retail", "commercial"].includes(building.kind)) return true;
  if (
    ["cafe", "restaurant", "fast_food", "bank", "pharmacy", "clinic"].includes(
      building.amenity,
    )
  )
    return true;
  if (building.name && /mall|store|market/i.test(building.name)) return true;
  return false;
}
