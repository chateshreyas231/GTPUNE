# Pune reference asset update

The current update combines the four reference batches supplied during development. The models are original approximations based on visible architecture, vehicle silhouettes and clothing. Unseen sides, dimensions, interiors and garment construction are inferred. No source photo clippings, stock-photo watermarks, manufacturer logos, official crests or actor likenesses are shipped.

| Request | Implemented change | Validation |
| --- | --- | --- |
| Five new everyday cars | Pune Electric, Deccan Coupe, Pune Classic, Ghat Roadster, City Hatch; editable Blender sources and GLBs | File integrity, geometry budgets, wheel pivots, browser loading/spawning/entry/driving |
| Previous cars as supercars | Previous five Blender cars retain their models/codes and now have `super` class; initial traffic has ten normal cars and two supercars | Fleet distribution and compatibility tests; browser inspects actual meshes |
| Replace basic civilian cars | Old compact SUV/off-roader/tall SUV mesh constructors removed; legacy IDs map to Blender replacements; no old car placeholder appears while loading | Legacy remapping tests and live traffic asset IDs |
| Pune houses | Ten models: timber, green and ornate wadas, courtyard wada, basalt/blue-joinery house, tiled and garden bungalows, modern and brick villas, weathered house | Native sources, delivery bounds/budgets, placement rejection tests and real-map browser checks |
| Local people | Eight wardrobe variants: pheta/kurta/dhoti, sari-inspired, printed dress, casual jacket, contemporary woman, safety worker, male/female police | Role selection, skinned meshes, six animation clips, native evaluated hand movement, browser role replacement |
| Public buses | Green city bus, red express coach, older red state bus | Bus traffic count, four rolling wheels, enter/drive/brake/exit browser flow |
| Police fleet | Patrol SUV, classic jeep and police transport bus replace the old procedural police sedan slots | Three patrol agents, per-instance flashing beacons and existing synthesized sirens/pursuit |
| Long vehicles | Nose/centre/tail collision samples participate in traffic and walking blockers; buses also check building clearance while driven | Sample rotation unit test and browser driving |

## Placement boundaries

House replacements stream within 220 m, up to 24 nearby models. A candidate must be an unnamed residential/house/unknown-use footprint without a shop/amenity tag, infill flag or a height above 17 m. Its perimeter must admit a fitted rectangle. Height and the original obstacle/collision footprint are preserved; roofs, stairs and compound details fit inside the admitted bounding rectangle. Named landmarks, commercial buildings, tall apartments and unsuitable irregular sites keep their existing geometry. The renderer continues to show ordinary generated buildings at distance.

These models are residential style references, not claims that the depicted real house occupies a particular OSM location. Courtyards are visible architectural shells; the original footprint remains a solid collision obstacle, so there are no new enterable house interiors. Modern canopies, balcony rails, pitched tiles, timber posts, shutters, basalt coursing, carved trim, brick screens and original plaster wear are modeled details.

## Runtime and asset budgets

The 37-model set includes the eight original exports plus 29 additions. Separate manifests for the original/normal fleet, houses, transport and wardrobes bind each GLB and native `.blend` with hashes and exact delivery triangle counts. Native triangle counts are recorded for new exports separately because font/ngon tessellation can differ during GLB export.

Normal/super cars stay below 30,000 triangles and 1.1 MB each; buses/police transport below 36,000 triangles and 1.9 MB; humans below 22,000 triangles and 1.1 MB; houses below 60,000 triangles and 3.5 MB. Cached meshes remain shared when character/worker models change or houses stream. Emergency beacons clone their material per vehicle so flashing does not alter other vehicles.

The three selectable player models remain available. Ordinary pedestrians, new crowds, five patrol officers and construction workers receive the expanded wardrobe. Clothing is skinned approximated geometry without cloth simulation; the sari/dhoti and printed patterns are stylized interpretations rather than tailoring-accurate reproductions. The construction worker uses an idle rig at a worksite, not a full shovel-work animation. Bus passengers, fares, boarding schedules and damage meshes are not implemented. Ambulance/fire-engine and two-wheeler meshes retain their existing procedural implementation.

## Rebuild and inspect

- `npm run assets:build`: rebuild ten cars and the three original playable people.
- `blender -b --python-exit-code 1 --python scripts/build-blender-assets.py -- --normal-only --render`: rebuild only the five normal cars, retaining earlier model exports/hashes.
- `npm run assets:houses`, `npm run assets:wardrobe`, `npm run assets:transport`: rebuild their separate asset families and preview images.
- `npm run assets:check`: reopen all 37 native files and verify meaningful parts, finite coordinates, rigs and evaluated animation movement.
- `npm test`: source/delivery hashes, GLB budgets, fleet/wardrobe selection, building fit/height protection and existing game logic.
- `npm run test:browser`: exercise actual game import, traffic, controls, character roles, houses on the real map and 4K image export.

Blender 4.3.2 is used locally; no paid provider jobs or external asset packages are required. Models are CC0 under the bundled license. The `game-dev` CLI is unavailable, so these are Blender exports with project manifests rather than a claimed CLI package/admission receipt.

## Spawn codes

Normal: `CITYEV`, `SILVERCOUPE`, `CLASSICBUG`, `ROADSTER`, `CITYHATCH`.

Super: `SUPERGT`, `HERITAGEGT`, `SAHYADRI`, `MUSCLEGT`, `SUNSET`.

Public transport: `CITYBUS`, `STATECOACH`, `STATEBUS`.

Police: `PATROLSUV`, `POLICEJEEP`, `POLICEBUS`.

## Validation recorded for this update

The build and 105 automated unit/server/asset checks pass. All 11 Chromium browser scenarios pass, including the bundled real Pune map, fitted house height, new role/worker models, three public buses and three police vehicles, civilian/supercar distribution, spawning/entry/driving/exit, combat, dialogue, missions, saved settings, festivals and 3840 × 2160 export. All 37 native files reopen in a fresh Blender process; animated hands deform when an attack is applied. The earlier eight source/GLB asset pairs remain byte-for-byte unchanged.

Previews: [normal cars](../assets/blender/normal-vehicles-preview.png), [houses](../assets/blender/houses-preview.png), [wardrobe](../assets/blender/wardrobe-preview.png), [buses](../assets/blender/buses-preview.png), [police vehicles](../assets/blender/police-vehicles-preview.png).
