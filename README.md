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
- P: pause. The game also pauses on a hidden tab.
- Follow the three amber markers to complete the evening run. Return to Deccan resets your vehicle position.

Traffic follows road segments and yields near the player. Buildings, pedestrians and cars block movement. NPCs are generated fictional people; dialogue is authored text. Speech uses a matching installed browser voice and falls back to subtitles. Engine and horn sounds are synthesized; there are no recorded native actors yet.

## Real Pune map data

The shipped fallback is a compact, illustrative grid. It is **not an accurate reconstruction** of Kothrud, FC Road or Deccan. Buildings are procedural and do not reproduce real facades. The in-game label identifies which data source is active.

```sh
npm run map:fetch
```

This fetches OpenStreetMap road centerlines and building outlines for the bounding box 18.490–18.540 N, 73.785–73.852 E from `overpass-api.de`. It covers Kothrud through Deccan and FC Road. Requires network access to that host. The result is saved to ignored `public/data/pune-osm.json`; reload the app or rebuild to include it. The download validates data before replacing an existing file. See the on-map attribution when real data is loaded.

OpenStreetMap data is © OpenStreetMap contributors, licensed under [ODbL 1.0](https://www.openstreetmap.org/copyright). Retain attribution and comply with ODbL when redistributing a derived database. Heights use OSM height or level tags where present and otherwise default to 12 m. Road widths, facades, vegetation and NPCs remain generated. OSM coverage is incomplete; even imported footprints are not photorealistic scans. Large imported datasets need further batching/streaming work before targeting low-end mobile devices. No Google Maps tiles or Street View imagery are copied.

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

Reference inspection and the live map download were blocked by the cloud network policy during initial development. No reference code, media or assets have been extracted or reverse engineered. Network domain additions were saved as an environment draft; they must be applied through environment settings before these operations can be validated.

The current result is a playable prototype, not a finished GTA-scale game or photorealistic digital twin. Next fidelity steps require actual map ingestion and validation, licensed building imagery/3D models, terrain, animated rigged residents, native voice recordings, continuous traffic routing and spatial batching. The engine currently models a flat city surface and generated building exteriors; it has no interiors, combat or multiplayer.
