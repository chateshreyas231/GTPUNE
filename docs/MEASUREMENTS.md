# Measured streets

The city is rebuilt from `public/data/pune-osm.json`. That file is the survey. Coordinates are projected with the same origin as the game (`18.5167° N`, `73.841° E`). Nothing in this pass copies a Street View photo, a Google Earth tile, a Mapchannels frame, or a YouTube frame.

A fetch of `https://www.mapchannels.com/routemaps3/map.htm?units=miles` returned only the page title. It did not expose a street image that could be counted. The walking-tour videos were already unreachable from this environment. Counts that are not in the extract are marked **invented** below.

## What the extract measures

| Quantity | What the meshes use | How |
| --- | --- | --- |
| Road centerlines | 6,042 driveable ways | Each segment is the carriageway centerline. Paths, steps and footways are not carriageways |
| Road width | 3 ways with a numeric `width` | That width, in metres. Five other `width` tags sit on paths, steps or footways and are not driven |
| Lanes | 432 ways | `lanes × 3.5 m` (one urban lane) |
| Neither width nor lanes | 5,607 ways | Modal tagged lane count for that class, times 3.5 m. Service and living streets use 5 m, the tagged width of the Kothrud living street named "road" |
| Building footprint | 19,850 outlines | Extruded on those vertices. The outline is not replaced with a box |
| `height` | 57 buildings | That height, clamped to 3–120 m |
| `building:levels` | 270 buildings, when `height` is absent | `levels × 3 m` |
| Neither | 19,523 buildings | Median floors of that `building` type, times 3 m |

Modal lanes among tagged ways: primary 2 (108 of 196), secondary 2 (66 of 85), tertiary 2 (57 of 76), trunk 2 (16 of 27), residential 2 (25 of 44). Untagged primary, secondary, tertiary, trunk and residential roads are therefore 7 m. A tagged 3-lane primary is 10.5 m. The one secondary `width=10` stays 10 m.

46 buildings have both `height` and `building:levels`. The median is 3.33 m per level and the lower quartile is 3.00 m. The model uses 3 m so a `building:levels=4` mass is 12 m.

Median floors where a type has a height or level tag, used only when both tags are missing:

| Type | Median floors | Default height |
| --- | --- | --- |
| apartments | 5 | 15 m |
| yes, residential, retail, school | 4 | 12 m |
| commercial, industrial | 3 | 9 m |
| house, detached | 2 | 6 m |
| office | 5 | 15 m |
| hospital | 7 | 21 m |
| temple, bungalow, shed | 1 | 3 m |

`hotel` has only two tagged examples and is not used as a default. A `college` levels value of 0 is ignored; untagged colleges use 4 floors, the school median.

## Setback from the centerline to the nearest footprint

Sampled along named roads. This is the measured gap the sidewalk has to fit inside. It includes compounds, not only the footway. p10 is the close edge of the street wall.

| Corridor | Samples | p10 | p50 |
| --- | --- | --- | --- |
| FC corridor (Gokhale Path and Off FC Road) | 96 | 10.56 m | 16.54 m |
| Jangli Maharaj Path | 147 | 14.10 m | 17.83 m |
| Bhandarkar Path (Deccan) | 105 | 5.42 m | 8.39 m |
| Apte Path | 85 | 4.04 m | 8.51 m |
| Deccan Gymkhana Road | 42 | 4.34 m | 8.16 m |
| Prabhat Path | 105 | 6.85 m | 11.41 m |
| Karve Road | 847 | 8.22 m | 17.59 m |
| Paud Road (Kothrud) | 928 | 6.65 m | 18.47 m |

Sidewalk widths are chosen so a 7 m carriageway still clears that p10 wall:

- Gokhale Path and Off FC Road: **2.4 m** each side (p10 leaves about 7.1 m outside a 7 m carriageway)
- Jangli Maharaj Path, Karve Road, Paud Road: **2.2 m**
- Deccan streets (Bhandarkar, Apte, Prabhat, Goodluck, Deccan Gymkhana) and every other road: **1.6 m** (Bhandarkar p10 leaves about 1.9 m)

## Invented, because the survey does not contain them

| Detail | Value | Why it is not a measurement |
| --- | --- | --- |
| Awning depth | 1.2 m | No awning tag. Mapchannels did not yield a countable frame |
| Shop bay | 4.5 m of frontage | Shop nodes: FC corridor 1, Deccan 0, Kothrud 0. One bay is placed per 4.5 m of a street-facing edge |
| Tree spacing | 14 m along the kerb | The extract has 0 `natural=tree` nodes |
| Leaf clumps | 5 per canopy, swaying | Canopy shape is not in the survey |
| Floor-band thickness | 0.16 m tall, 0.34 m deep, one band per 3 m storey | The band marks the measured storey. The moulding size is not tagged |
| Sign lettering | generic category words already in the scene (चहा, मिसळ, and the roadside boards) | Exact shop names are not taken from a photograph |

Ground-floor shops are a shallow front and an awning on edges that sit 0.2–7.5 m outside the carriageway. Upper floors are the footprint extrusion plus those bands, up to 8 storeys, on the nearest 48 buildings. Buildings farther away keep the surveyed footprint and height without the band meshes.
