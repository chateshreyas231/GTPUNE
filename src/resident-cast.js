export const RESIDENT_CAST = [
  "traditional-man",
  "nauvari-woman",
  "printed-dress",
  "casual-jacket",
  "casual-woman",
  "construction-worker",
  "police-officer",
  "policewoman",
];
export function residentVariant(role = {}, index = 0) {
  if (role === "construction" || role.kind === "construction")
    return "construction-worker";
  if (role.service === "police")
    return role.gender === "woman" ? "policewoman" : "police-officer";
  if (role.gender === "woman") {
    if (role.garment === "saree" || role.kind === "older")
      return "nauvari-woman";
    return index % 2 ? "printed-dress" : "casual-woman";
  }
  if (role.garment === "kurta" || role.kind === "older")
    return "traditional-man";
  return "casual-jacket";
}
