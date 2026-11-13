import { execFileSync } from "node:child_process";
import {
  writeFileSync,
  mkdirSync,
  renameSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { parseOSM } from "../src/city.js";
import { mergeOSMExports } from "./osm-xml.mjs";
// Nine modest exports stay below the OSM map API's 50,000-node limit.
// Cache successful tiles so an interrupted download can resume without repeats.
const bounds = { west: 73.785, east: 73.852, south: 18.49, north: 18.54 };
const cache = ".cache/gtpune-osm";
try {
  mkdirSync(cache, { recursive: true });
  const documents = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const lon = (i) =>
        (bounds.west + ((bounds.east - bounds.west) * i) / 3).toFixed(7);
      const lat = (i) =>
        (bounds.south + ((bounds.north - bounds.south) * i) / 3).toFixed(7);
      const bbox = [lon(col), lat(row), lon(col + 1), lat(row + 1)].join(",");
      const file = `${cache}/${bbox}.osm`;
      if (!existsSync(file)) {
        console.log(`Downloading Pune tile ${row * 3 + col + 1}/9`);
        const xml = execFileSync(
          "curl",
          [
            "--fail-with-body",
            "--silent",
            "--show-error",
            "--location",
            "--max-time",
            "90",
            "--user-agent",
            "GTPUNEPrototype/0.1",
            `https://www.openstreetmap.org/api/0.6/map?bbox=${bbox}`,
          ],
          { maxBuffer: 80 * 1024 * 1024, encoding: "utf8" },
        );
        mergeOSMExports([xml]);
        writeFileSync(file, xml);
      }
      documents.push(readFileSync(file, "utf8"));
    }
  const data = mergeOSMExports(documents),
    parsed = parseOSM(data);
  data.gtpune = {
    retrievedAt: new Date().toISOString(),
    bounds,
    source: "OpenStreetMap map API",
    attribution: "© OpenStreetMap contributors",
    license: "ODbL 1.0",
  };
  mkdirSync("public/data", { recursive: true });
  writeFileSync("public/data/pune-osm.json.tmp", JSON.stringify(data));
  renameSync("public/data/pune-osm.json.tmp", "public/data/pune-osm.json");
  console.log(
    `Saved ${parsed.roads.length} roads and ${parsed.buildings.length} building footprints. Untagged heights and all facades are estimated. Run npm run build and reload.`,
  );
} catch (e) {
  console.error(
    "Map import failed; previous map data was preserved.",
    e.message,
  );
  process.exitCode = 1;
}
