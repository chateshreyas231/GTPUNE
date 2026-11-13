# Asset provenance and limits

## Street materials

`public/assets/materials/asphalt.jpg` and `plaster.jpg` are the 1K diffuse textures for Poly Haven's `asphalt_02` and `concrete_wall_006`. Poly Haven publishes its assets under CC0: https://polyhaven.com/license. Facade windows are original procedural overlays on the plaster material. These textures are general materials and do not reproduce a particular FC Road facade.

## Original Blender cars, buildings, transport and people

The expanded 37-model set, reference boundaries, manifests, budgets, placement rules and rebuild commands are documented in [the reference asset update](REFERENCE-ASSET-UPDATE.md). It adds five normal cars, ten houses, eight wardrobe variants and six public/police transport models. The earlier five cars are now the supercar class; the old three procedural civilian car builders and police sedan builder have been removed.

The active player, ordinary residents, officers and construction workers now use original Blender models in `public/assets/pune-originals/`. Editable `.blend` sources, separate named parts, body control cages and armatures are in `assets/blender/`. The native sources preserve editable parts; GLBs merge surfaces by material to reduce draw calls. The manifest binds both source and delivery files with SHA-256 hashes, actual triangle counts, byte sizes and measured bounding dimensions. Width includes mirrors; height/length include attached trim.

| Car | Photo interpretation | Spawn code |
| --- | --- | --- |
| Deccan Supercar | Red low mid-engine-style supercar | `SUPERGT` |
| Heritage GT | Silver long-hood vintage racer, number 4 | `HERITAGEGT` |
| Sahyadri SUV | Grey SUV with black roof and rear spoiler | `SAHYADRI` |
| Deccan Muscle | Red muscle coupe | `MUSCLEGT` |
| Sunset Cabrio | Yellow open-top muscle car | `SUNSET` |

These are original approximate interpretations of the five photographs supplied in chat, with inferred unseen sides, interiors and dimensions. They carry no manufacturer badges, copied photograph textures or extracted game assets. They are not manufacturer CAD replicas. Each car has four independent wheel pivots, modeled tire/rim/brake assemblies, formed body panels, wheel arches, window/pillar geometry, panel seams, lamps and an interior. Doors do not open, interiors are simplified, glass uses an opaque reflective material and there are no damage meshes or LOD transitions yet. Cars have approximately 23,000 triangles each, under 0.9 MB per GLB. These five designs now belong to the supercar category. Ten ordinary traffic slots use the five newer normal cars, and two slots use supercars. The player starts in the Pune Electric. Horn/engine audio remains synthesized.

Three original clothed adult models remain selectable as the player: `pune-woman`, `pune-man`, `pune-young-adult`. Faces include modeled eyelids, eyes/irises, nose, lips, ears and hair; hands have separate fingers, clothing has collars/buttons and shoe soles. Each has a 15-bone deforming rig with original Idle, Walk, Run, Punch_Left, Punch_Right and Sword_Slash clips. They have 14,020–14,628 triangles each and GLBs under 0.7 MB. They are stylized modeled humans, not photorealistic scans or a claim of Rockstar production quality. Ordinary pedestrians now use eight additional role-selected wardrobe models, including sari-inspired clothing, traditional kurta/dhoti/pheta, dresses, casual clothing, police uniforms and construction safety gear. Bike riders remain procedural.

V retains the existing player labels and rendered heights: Ananya/girl 1.62 m, Kabir/boy 1.50 m, Nikhil/man 1.76 m. All source meshes have adult proportions; the shortened Kabir model is not an anatomical child model. Ordinary residents use the new rigs at 1.72 m with role-dependent skin and clothing colors. No real person's likeness was used.

Original model geometry/materials/animations are dedicated under CC0 1.0; see `public/assets/pune-originals/LICENSE.txt`. Reference photographs and vehicle trademarks are not included in this dedication. No paid providers were used. The optional `game-dev` CLI is unavailable in this environment, so authoring, validation and export use Blender 4.3.2 directly rather than claiming a CLI package/admission receipt.

Rebuild with Blender installed: `npm run assets:build`. This intentionally rewrites thirteen car/player sources, GLBs, preview images and their manifest. The separate houses/wardrobe/transport commands are listed in the linked update document. Read-only native validation: `npm run assets:check`. `npm test` verifies delivery/source hashes, embedded-only buffers, wheel pivots, skinning, named clips and geometry budgets. Playwright checks actual browser loading, car spawn/entry/driving, character changes and fighting. Preview renders are `assets/blender/vehicles-preview.png` and `people-preview.png`; matching front/side/top car silhouettes are also included.

The earlier Quaternius files in `public/assets/characters/` remain as legacy assets with their CC0 provenance/license. They are no longer the active ordinary player/resident library. Sources: https://quaternius.com/packs/ultimatemodularwomen.html , https://quaternius.com/packs/ultimatemodularcharacters.html , https://opengameart.org/content/animated-characters-pack .

## Voices

`public/audio/manifest.json` records the voice, locale, exact text and SHA-256 of every bundled clip. Clips are synthetic Microsoft neural speech: Marathi `mr-IN-ManoharNeural`, Hindi `hi-IN-SwaraNeural`, Indian English `en-IN-PrabhatNeural`. They are not recordings of local actors and have not been validated by a Marathi-speaking voice director. A locale-specific voice does not establish a specific Pune dialect or accent.

The nine clips work without browser-installed voices or a runtime speech service. Enable SOUND, choose a language, approach a resident and press T. A user interaction starts audio playback. Speech stops when sound is turned off.

To regenerate the clips, use Python 3, `edge-tts==7.3.1`, Node.js and `scripts/generate-voices.py`. The script uses inherited proxy settings and preserves certificate verification. This is an optional asset-authoring step; normal installation/startup does not require Python or the external speech service. Review the speech provider's applicable terms for your distribution. Replace these clips with your own original Marathi/Hindi recordings for an authentic local performance.

## Street weapons and the Kavach carrier

Fists, the pipe, the stick, the stone, and the Kavach tracked carrier are procedural meshes built in this repository. No weapon, tank, or car model is imported from another game. Horns and engines stay synthesized.

## City services

The three police patrol slots now use original Blender patrol SUV, classic jeep and police transport bus models with plain colored bands, lettering and flashing beacons. Three original Blender public bus models also join traffic. No source photo watermark, manufacturer logo or official crest is included. Sirens remain two-tone Web Audio oscillators. Male/female officers use the new khaki animated rigs; construction workers use the safety-vest/helmet rig. Ambulances, fire engines and motorcycles retain their existing procedural meshes. See the reference asset update for scope and limits.

## Exact FC Road buildings

The chosen reference target is Goodluck Chowk toward Fergusson College. Building footprints and tagged heights come from the OpenStreetMap extract; road widths come from `width` or `lanes` tags, with class defaults only when both are missing. See [measured streets](MEASUREMENTS.md). Facades, awning depth, shop lettering and tree spacing are original geometry, not copied photos. The renderer still uses a flat terrain surface. A 4K photo is a 3840 × 2160 render, not a claim of photorealistic assets.
