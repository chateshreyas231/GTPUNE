# Asset provenance and limits

## Street materials

`public/assets/materials/asphalt.jpg` and `plaster.jpg` are the 1K diffuse textures for Poly Haven's `asphalt_02` and `concrete_wall_006`. Poly Haven publishes its assets under CC0: https://polyhaven.com/license. Facade windows are original procedural overlays on the plaster material. These textures are general materials and do not reproduce a particular FC Road facade.

## Playable girl, boy, and man

The player starts as Ananya, a girl in a light shirt, dark trousers, and short dark hair. V cycles to Kabir, a shorter boy in a hoodie and jeans, then Nikhil, a taller man in a light shirt and dark trousers, then back. Skin tones are wheatish. These are clothed rigs with walk, run, and idle clips, not stacks of primitive shapes.

| File | Body | Height | Pack |
| --- | --- | --- | --- |
| `public/assets/characters/girl.glb` | Girl, default | 1.62 m | Ultimate Modular Women, Casual |
| `public/assets/characters/boy.glb` | Boy | 1.50 m | Ultimate Modular Characters, Casual Hoodie |
| `public/assets/characters/man.glb` | Man | 1.76 m | Ultimate Modular Characters, Casual 2 |

Quaternius publishes both packs under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/. Pack pages: https://quaternius.com/packs/ultimatemodularwomen.html and https://quaternius.com/packs/ultimatemodularcharacters.html. The game recolors skin, hair, and clothes at runtime. The boy mesh is the casual hoodie male scaled to 1.50 m so he stands shorter than the girl and the man. A copy of the license note is in `public/assets/characters/LICENSE-QUATERNIUS.txt`.

`public/assets/characters/michelle.glb` remains in the tree from an earlier Mixamo reference and is not used for the player. Adobe's Mixamo FAQ permits royalty-free character use in a shipped game: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html. Other residents still use original procedural geometry.

## Voices

`public/audio/manifest.json` records the voice, locale, exact text and SHA-256 of every bundled clip. Clips are synthetic Microsoft neural speech: Marathi `mr-IN-ManoharNeural`, Hindi `hi-IN-SwaraNeural`, Indian English `en-IN-PrabhatNeural`. They are not recordings of local actors and have not been validated by a Marathi-speaking voice director. A locale-specific voice does not establish a specific Pune dialect or accent.

The nine clips work without browser-installed voices or a runtime speech service. Enable SOUND, choose a language, approach a resident and press T. A user interaction starts audio playback. Speech stops when sound is turned off.

To regenerate the clips, use Python 3, `edge-tts==7.3.1`, Node.js and `scripts/generate-voices.py`. The script uses inherited proxy settings and preserves certificate verification. This is an optional asset-authoring step; normal installation/startup does not require Python or the external speech service. Review the speech provider's applicable terms for your distribution. Replace these clips with your own original Marathi/Hindi recordings for an authentic local performance.

## Exact FC Road buildings

The chosen reference target is Goodluck Chowk toward Fergusson College. Building footprints and tagged heights come from the OpenStreetMap extract; road widths come from `width` or `lanes` tags, with class defaults only when both are missing. See [measured streets](MEASUREMENTS.md). Facades, awning depth, shop lettering and tree spacing are original geometry, not copied photos. The renderer still uses a flat terrain surface. A 4K photo is a 3840 × 2160 render, not a claim of photorealistic assets.
