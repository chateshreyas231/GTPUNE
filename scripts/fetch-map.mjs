import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, renameSync } from "node:fs";
import { parseOSM } from "../src/city.js";
// Covers Kothrud through Deccan and FC Road. Geometry remains ODbL licensed.
const query =
  '[out:json][timeout:90];(way["highway"](18.490,73.785,18.540,73.852);way["building"](18.490,73.785,18.540,73.852););out geom;';
try {
  const raw = execFileSync(
    "curl",
    [
      "--fail-with-body",
      "--silent",
      "--show-error",
      "--max-time",
      "120",
      "--data-urlencode",
      `data=${query}`,
      "https://overpass-api.de/api/interpreter",
    ],
    { maxBuffer: 100 * 1024 * 1024 },
  );
  const data = JSON.parse(raw);
  const parsed = parseOSM(data);
  mkdirSync("public/data", { recursive: true });
  writeFileSync(
    "public/data/pune-osm.json.tmp",
    JSON.stringify({
      ...data,
      gtpune: {
        retrievedAt: new Date().toISOString(),
        attribution: "© OpenStreetMap contributors",
        license: "ODbL 1.0",
      },
    }),
  );
  renameSync("public/data/pune-osm.json.tmp", "public/data/pune-osm.json");
  console.log(
    `Saved ${parsed.roads.length} roads and ${parsed.buildings.length} building footprints. Heights without tags are estimated. Restart/reload the app.`,
  );
} catch (e) {
  console.error(
    "Map download failed; existing data was preserved. Check network access to overpass-api.de.",
    e.message,
  );
  process.exitCode = 1;
}
