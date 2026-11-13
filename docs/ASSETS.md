# Asset provenance and limits

## Street materials

`public/assets/materials/asphalt.jpg` and `plaster.jpg` are the 1K diffuse textures for Poly Haven's `asphalt_02` and `concrete_wall_006`. Poly Haven publishes its assets under CC0: https://polyhaven.com/license. Facade windows are original procedural overlays on the plaster material. These textures are general materials and do not reproduce a particular FC Road facade.

## Characters

The player and the pedestrians use six rigged characters:

- `public/assets/characters/casual-male.glb`
- `public/assets/characters/casual-female.glb`
- `public/assets/characters/worker-male.glb`
- `public/assets/characters/worker-female.glb`
- `public/assets/characters/older-male.glb`
- `public/assets/characters/older-female.glb`

Source: Quaternius, Ultimate Animated Character Pack (November 2019), Casual / Worker / Old Classy male and female. https://quaternius.com/packs/ultimatedanimatedcharacter.html

License: CC0 1.0 Universal (public domain). https://creativecommons.org/publicdomain/zero/1.0/

Quaternius publishes that pack as free for personal and commercial projects. CC0 allows the meshes, including the walk and run clips, to be shipped inside this game. No attribution is required; the credit above is recorded so the source stays attached to the files. These files are part of the game, not a standalone asset library.

The glTF binaries are the CC0 conversions published at https://github.com/Yametech12/ghostname-3d-assets (`Casual_Male`, `Casual_Female`, `Worker_Male`, `Worker_Female`, `OldClassy_Male`, `OldClassy_Female`). That conversion has no texture atlas, so the game tints Skin, Face, Hair, Shirt and Pants to each resident's palette. Belts, vests, hats and small details keep their converted colors. Students use the casual bodies, shop workers use the worker bodies, and older neighbours use the Old Classy bodies. The player uses the casual man.

The Walk and Run clips face +Z, swing the opposite arm and leg, and shift the head and torso laterally over the standing foot. The runtime turns each mesh to face -Z, scales it to the resident's height, and plays Idle, Walk or Run from travel speed. A stopped person stands. This is stylized low-poly art, not a photorealistic Maharashtrian person. The stacked procedural body remains only as a fallback if a mesh fails to load.

## Voices

`public/audio/manifest.json` records the voice, locale, exact text and SHA-256 of every bundled clip. Clips are synthetic Microsoft neural speech: Marathi `mr-IN-ManoharNeural`, Hindi `hi-IN-SwaraNeural`, Indian English `en-IN-PrabhatNeural`. They are not recordings of local actors and have not been validated by a Marathi-speaking voice director. A locale-specific voice does not establish a specific Pune dialect or accent.

The nine clips work without browser-installed voices or a runtime speech service. Enable SOUND, choose a language, approach a resident and press T. A user interaction starts audio playback. Speech stops when sound is turned off.

To regenerate the clips, use Python 3, `edge-tts==7.3.1`, Node.js and `scripts/generate-voices.py`. The script uses inherited proxy settings and preserves certificate verification. This is an optional asset-authoring step; normal installation/startup does not require Python or the external speech service. Review the speech provider's applicable terms for your distribution. Replace these clips with your own original Marathi/Hindi recordings for an authentic local performance.

## Exact FC Road buildings

The chosen reference target is Goodluck Chowk toward Fergusson College. Building footprints and tagged heights come from the OpenStreetMap extract; road widths come from `width` or `lanes` tags, with class defaults only when both are missing. See [measured streets](MEASUREMENTS.md). Facades, awning depth, shop lettering and tree spacing are original geometry, not copied photos. The renderer still uses a flat terrain surface. A 4K photo is a 3840 × 2160 render, not a claim of photorealistic assets.
