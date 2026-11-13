# FC Road visual-reference inspection

The user supplied https://www.mapchannels.com/routemaps3/map.htm?units=miles . This is a generic route viewer combining Google Maps and Street View; the original link does not itself identify a Pune location.

## Route that was actually opened

The viewer's documented/public URL parser supports coordinate route nodes. The following normal viewer URL successfully loaded a walking route of approximately 0.44 miles in the Goodluck Chowk–Fergusson College vicinity:

https://www.mapchannels.com/routemaps3/map.htm?units=miles&route=18.5176,73.8412,18.5235,73.8412&mode=1&map2d=1&zoom=18

The initial point is on Bhandarkar Road immediately west of the FC Road junction. This is not an assertion that the coordinate pairs identify specific building entrances. Normal address autocomplete suggestions for Goodluck Chowk and Fergusson College were visible, but the initial form submission did not create the two route nodes. The supported route URL loaded both the route and actual street imagery.

## Verified initial panorama

- Actual panorama position reported by the viewer: **18.51767652236258 N, 73.84120417540292 E**.
- Initial view heading: **97 degrees** (toward the FC Road junction).
- Google Street View image date displayed on screen: **December 2025**.
- Screenshot evidence: `/tmp/mapchannels-goodluck-straight.png`; wider first capture `/tmp/mapchannels-pune-route.png`.
- Map labels visible in the same viewer include Cafe Goodluck, Fergusson College Road, Bhandarkar Road, Wadeshwar, BMCC Road and Apte Road. Labels are map evidence, not proof that a particular pictured facade belongs to a named business.

Visible street-level features:

- A cream/tan older upper-storey street wall on the north side, with narrow/arched window openings, vertical bays, roof-edge parapets and red/white retail signboards at ground level.
- More than one building height and frontage rhythm; the scene is not a uniform row of equal facade boxes.
- Dense mature broadleaf tree canopies and strong dappled street shade on the opposite side.
- Overhead utility wires and a roadside pole, parked scooters/motorcycles, black-and-yellow auto-rickshaws, small cars and pedestrians.
- Worn grey asphalt, an irregular curb/sidewalk edge and mixed paving near shopfronts.

These observations can inform the material palette, facade rhythm and original modeled street details. They do not establish surveyed facade dimensions, exact storey heights, hidden surfaces or an entire building's geometry.

## OSM correspondence and uncertainty

The bundled OSM extract contains relevant named route/area evidence:

- Bhandarkar Path ways including `1570313653` and `1160407187` / `1160407188` near the junction.
- Cafe Goodluck Road way `202299530` south of the junction.
- Building `359970565` is tagged Motion Education Deccan, with `building:levels=6` and `height=23 meters`; its bounds are roughly 18.517169–18.517362 N and 73.840798–73.840930 E. Preserve these supplied tags. The initial photographed north-side facade was **not** established to be this building.
- Building `202296451` is tagged as a college building with an address on Bhandarkar Road (bounds approximately 18.517766–18.517941 N, 73.840836–73.841065 E). It is near the initial panorama, but no unambiguous photo-to-footprint identity has been verified.
- Building `282003231` is named Fergusson College Autonomous, Pune, deeper inside the campus (not necessarily the street-facing frontage).

No exact named facade should be replaced solely from proximity to these coordinates. A building-by-building reference table still needs matched location, view direction, visible entrance/sign evidence, and additional angles.

## Image use

The screenshots are local inspection evidence with Google attribution visible. They are not imported into the game as textures, raw tiles, panoramas or distributable game art. New building assets should be original modeled interpretations or use appropriately licensed photography/3D assets. No site API credential was extracted or reused outside the intended public viewer, and HTTPS verification remained enabled.

## Additional inspected directions

| View                                  | Actual panorama location / direction              | Displayed image date | Evidence and observations                                                                                                                                                                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bhandarkar south-side compound        | 18.5176765224 N, 73.8412041754 E; heading 127.19° | December 2025        | `/tmp/mapchannels-goodluck-side.png`: pale grey/white low-rise compound, a sloped grey sheet-metal veranda/awning, grilles, boundary wall, paving slabs, a mature tree and parked auto-rickshaws.                                                                                                                       |
| FC Road northward                     | 18.5229562973 N, 73.8410187735 E; heading 11°     | January 2026         | `/tmp/mapchannels-fc-road-north.png`: tree canopy over a mixed-traffic road, bus/bus-like traffic on the campus side, parked cars and an east-side low-rise commercial street wall. The route progress display had reset to zero after reaching the route end; the panorama position is the relevant location evidence. |
| FC Road east-side commercial frontage | Same panorama position; heading 40.24°            | January 2026         | `/tmp/mapchannels-fc-road-north-side.png`: beige concrete structural frame, deep recessed/open ground-floor bays, stairs, recessed upper ribbon windows, red bank fascia, blue coffee frontage, parked cars and mature street trees with white/red trunk-base paint.                                                    |

A moving-route screenshot `/tmp/mapchannels-fc-road-mid.png` was also inspected, showing the dense traffic/tree-canopy character of the corridor. Its image load lagged the map progress while the route was animated. **Do not bind that image to the contemporaneous recorded coordinates.** Use stationary panorama captures for facade-to-building correspondence.

A strong spatial candidate for the east-side office mass is untagged OSM building `359998895` (centroid approximately 18.52315518 N, 73.84124402 E). It sits immediately northeast of the stationary panorama, but no name or survey height links it unambiguously to the pictured bank/coffee storefront. Treat this correspondence as a candidate requiring confirmation, not an exact named reconstruction.

The office view was reproduced with a separate stationary route URL (`route=18.5229563,73.8410188,18.5235,73.8412`) and no playback. `/tmp/mapchannels-fc-office-static.png` confirms the same panorama location at heading **44.67°**, January 2026 imagery. This stationary capture is preferred over the earlier animated-route captures for reference work.
