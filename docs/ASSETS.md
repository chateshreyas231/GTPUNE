# Asset provenance and limits

## Street materials

`public/assets/materials/asphalt.jpg` and `plaster.jpg` are the 1K diffuse textures for Poly Haven's `asphalt_02` and `concrete_wall_006`. Poly Haven publishes its assets under CC0: https://polyhaven.com/license. Facade windows are original procedural overlays on the plaster material. These textures are general materials and do not reproduce a particular FC Road facade.

## Animated resident reference

`public/assets/characters/michelle.glb` comes from the Three.js example assets at https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf. The Michelle character is a Mixamo reference model. Adobe's FAQ permits royalty-free character/animation use in video games: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html. It is included as part of this game, not offered as a standalone asset library. Retain the source/provenance when distributing the game and consult Adobe's terms for other uses.

This is a stylized rigged reference civilian, not a photorealistic Maharashtrian person. The runtime normalizes its scale after posing and generates a simple walking cycle. Other residents and smaller family figures use original procedural geometry. They need higher-quality character art and animation to reach the requested realism.

## Voices

`public/audio/manifest.json` records the voice, locale, exact text and SHA-256 of every bundled clip. Clips are synthetic Microsoft neural speech: Marathi `mr-IN-ManoharNeural`, Hindi `hi-IN-SwaraNeural`, Indian English `en-IN-PrabhatNeural`. They are not recordings of local actors and have not been validated by a Marathi-speaking voice director. A locale-specific voice does not establish a specific Pune dialect or accent.

The nine clips work without browser-installed voices or a runtime speech service. Enable SOUND, choose a language, approach a resident and press T. A user interaction starts audio playback. Speech stops when sound is turned off.

To regenerate the clips, use Python 3, `edge-tts==7.3.1`, Node.js and `scripts/generate-voices.py`. The script uses inherited proxy settings and preserves certificate verification. This is an optional asset-authoring step; normal installation/startup does not require Python or the external speech service. Review the speech provider's applicable terms for your distribution. Replace these clips with your own original Marathi/Hindi recordings for an authentic local performance.

## Exact FC Road buildings

The chosen reference target is Goodluck Chowk toward Fergusson College. Building footprints and tagged heights come from the OpenStreetMap extract; road widths come from `width` or `lanes` tags, with class defaults only when both are missing. See [measured streets](MEASUREMENTS.md). Facades, awning depth, shop lettering and tree spacing are original geometry, not copied photos. The renderer still uses a flat terrain surface. A 4K photo is a 3840 × 2160 render, not a claim of photorealistic assets.
