# PUNE / After Hours

A browser-based 3D driving and walking prototype set in an illustrative Pune neighbourhood. Built with Three.js and Vite. This is an original implementation, not a copy of GTA or Benglooru assets or code.

## Run

Requires Node.js 22.12+ (validated on Node 24).

```sh
npm ci --cache /tmp/gtpune-npm
PORT=3001 npm start
```

`npm start` builds and serves the prototype (port 3000 by default; `PORT=3001` selects 3001). Keep the terminal running. The previous FC Road chapter remains at `/classic/`, with its assets, missions, saves and tests preserved. See [the original chapter documentation](docs/CLASSIC.md). `npm run dev -- --port 3001` is also available for live editing.

`npm run build` makes a static site in `dist/`; `npm run preview` serves that build. No API keys or backend are required. WebGL2 is required. A hardware-accelerated browser is recommended.

## Play

- WASD / arrow keys: drive or walk; Space: brake.
- E: exit a stopped car, or enter when within 7 m.
- C: cycle chase, close and overhead cameras.
- H: horn; enable sound with the SOUND button first.
- T: talk to a pedestrian within 22 m. Select Marathi, Hindi or English.
- J / START DABBA DELIVERY: begin a timed ₹450 delivery. Stop at the marker, get out and press F to collect; repeat at FC Road to deliver. Completion saves the wallet locally.
- 4K PHOTO: export a 3840 × 2160 scene PNG; normal rendering remains sized for your screen.
- P: pause. The game also pauses on a hidden tab.
- Follow the three amber markers to complete the evening run. Return to Deccan resets your vehicle position.

Traffic follows road segments and yields near the player. Buildings, pedestrians and cars block movement. NPCs are fictional people, with a skinned reference character, procedural residents and simpler family figures; dialogue is authored text. Speech uses nine bundled Marathi, Hindi and Indian English neural clips; no installed voice is required. These are synthetic performances, not local actor recordings. Engine and horn sounds are synthesized. See [asset provenance](docs/ASSETS.md).

## Real Pune map data

A bundled OpenStreetMap extract covers 18.490–18.540 N, 73.785–73.852 E: Kothrud through Deccan and FC Road. It contains 6,042 road ways and 19,850 building footprints, downloaded from the official OSM map API in nine bounded exports. The game loads nearby building geometry within about 900 m and refreshes it as you travel. Roads and footprints follow the source data; facades, road widths, vegetation and untagged heights remain generated. Building multipolygon relations and terrain elevation are not modeled yet.

```sh
npm run map:fetch
npm run build
```

The importer caches successful XML tiles in ignored `.cache/gtpune-osm/` so interrupted imports resume. Remove that cache to refresh from the service. Data is validated before replacing `public/data/pune-osm.json`. The in-game source label shows whether the bundled map or the illustrative fallback is active. If the map is absent, a generated city allows offline development.

Map data is © OpenStreetMap contributors, licensed under [ODbL 1.0](https://www.openstreetmap.org/copyright), separately from application code. See [map data provenance](docs/MAP-DATA.md). Retain attribution and comply with ODbL when redistributing a derived database. Heights use an OSM `height` tag when present, otherwise `building:levels` at 3 m per level, otherwise the median floor count of that building type in the extract. Road widths use an OSM `width` tag, otherwise `lanes` at 3.5 m, otherwise the modal lane count for that highway class. See [measured streets](docs/MEASUREMENTS.md). No Google Maps tiles, Street View photos, or Mapchannels imagery are copied.

## Validation

```sh
npm test
npm run test:browser
```

Unit tests validate map conversion, spawn snapping, repeatability and collision geometry. Browser tests use `/usr/bin/chromium` and cover rendering, movement, pause, reset, walking, local-language dialogue, lighting, help and mobile layout. Adjust the Playwright executable path on other machines. Test screenshots are written under ignored `test-results/`.

## References and outstanding work

Requested references:

- https://benglooru.com/
- https://www.youtube.com/shorts/1pXjiHdqLEU
- https://www.youtube.com/watch?v=OOHPj0aqXfQ

Benglooru’s public site and controls documentation were inspected after network access was restored. Its public documentation describes a stylized OSM-based map, generated local voices, driving, walking and missions. Its source code and assets have not been copied into this project. The provided YouTube links remain inaccessible through the cloud proxy.

The current result is a playable prototype, not a finished GTA-scale game or photorealistic digital twin. Next fidelity steps require licensed building imagery/3D models, terrain, animated rigged residents, native actor recordings, more advanced traffic simulation and further spatial batching. The engine currently models a flat city surface and generated building exteriors; it has no interiors, combat or multiplayer.

The selected first facade-reference target is **Goodluck Chowk toward Fergusson College**. Exact facade reconstruction awaits original overlapping video/photos or licensed reference assets. Current textures and props are illustrative; they do not establish the real colors or signs of those buildings.

[Normalized user walking-tour links and capture requirements](docs/PUNE-REFERENCES.md). Those five videos remain unviewed because the proxy rejected requests.
