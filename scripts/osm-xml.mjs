import { XMLParser } from "fast-xml-parser";
const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: false,
  isArray: (name) => ["node", "way", "nd", "tag"].includes(name),
});
export function mergeOSMExports(documents) {
  const nodes = new Map(),
    ways = new Map();
  for (const xml of documents) {
    const root = parser.parse(xml).osm;
    if (!root) throw Error("Expected an OpenStreetMap XML export");
    for (const n of root.node || [])
      nodes.set(String(n["@_id"]), {
        lat: Number(n["@_lat"]),
        lon: Number(n["@_lon"]),
      });
    for (const w of root.way || []) ways.set(String(w["@_id"]), w);
  }
  const elements = [];
  for (const [id, w] of ways) {
    const tags = Object.fromEntries(
      (w.tag || []).map((t) => [t["@_k"], t["@_v"]]),
    );
    if (!tags.highway && !tags.building) continue;
    const geometry = (w.nd || []).map((n) => nodes.get(String(n["@_ref"])));
    if (
      geometry.length < 2 ||
      geometry.some(
        (p) => !p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon),
      )
    )
      continue;
    elements.push({ type: "way", id: Number(id), tags, geometry });
  }
  if (!elements.length)
    throw Error("Export contains no complete roads or building footprints");
  return { elements };
}
