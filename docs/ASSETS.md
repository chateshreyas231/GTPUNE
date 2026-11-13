# Asset provenance and limits

## Street materials

`public/assets/materials/asphalt.jpg` and `plaster.jpg` are the 1K diffuse textures for Poly Haven's `asphalt_02` and `concrete_wall_006`. Poly Haven publishes its assets under CC0: https://polyhaven.com/license. Facade windows are original procedural overlays on the plaster material. These textures are general materials and do not reproduce a particular FC Road facade.

## Animated resident reference

The player and street pedestrians use these GLB files in `public/assets/characters/`:

- `casual-male.glb`, `casual-female.glb`, `casual2-male.glb`, `casual2-female.glb`, `casual-bald.glb`, `worker-male.glb`, `old-classy-female.glb`

They come from the Ultimate Animated Character pack by Quaternius, as uploaded by Quaternius on OpenGameArt: https://opengameart.org/content/animated-characters-pack . The submission lists the license as CC0 and links to https://creativecommons.org/publicdomain/zero/1.0/ . The game keeps the Idle and Walk clips, scales the rigs to about 1.72 m, and recolors the named Skin, Face, Shirt, Pants, Hair, Hat, Vest, Detail and Belt materials. Wheatish skin stays between `#C89870` and `#E8C4A2`. The Mixamo Michelle reference is not shipped.

## Voices

`public/audio/manifest.json` records the voice, locale, exact text and SHA-256 of every bundled clip. Clips are synthetic Microsoft neural speech: Marathi `mr-IN-ManoharNeural`, Hindi `hi-IN-SwaraNeural`, Indian English `en-IN-PrabhatNeural`. They are not recordings of local actors and have not been validated by a Marathi-speaking voice director. A locale-specific voice does not establish a specific Pune dialect or accent.

The nine clips work without browser-installed voices or a runtime speech service. Enable SOUND, choose a language, approach a resident and press T. A user interaction starts audio playback. Speech stops when sound is turned off.

To regenerate the clips, use Python 3, `edge-tts==7.3.1`, Node.js and `scripts/generate-voices.py`. The script uses inherited proxy settings and preserves certificate verification. This is an optional asset-authoring step; normal installation/startup does not require Python or the external speech service. Review the speech provider's applicable terms for your distribution. Replace these clips with your own original Marathi/Hindi recordings for an authentic local performance.

## Exact FC Road buildings

The chosen reference target is Goodluck Chowk toward Fergusson College. Building footprints and tagged heights come from the OpenStreetMap extract; road widths come from `width` or `lanes` tags, with class defaults only when both are missing. See [measured streets](MEASUREMENTS.md). Facades, awning depth, shop lettering and tree spacing are original geometry, not copied photos. The renderer still uses a flat terrain surface. A 4K photo is a 3840 × 2160 render, not a claim of photorealistic assets.
