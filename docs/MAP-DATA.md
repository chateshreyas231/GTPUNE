# Pune map extract

The database in `public/data/pune-osm.json` is derived from OpenStreetMap and is licensed under the Open Data Commons Open Database License (ODbL) 1.0:

- Copyright: © OpenStreetMap contributors
- Attribution and license: https://www.openstreetmap.org/copyright
- Full license: https://opendatacommons.org/licenses/odbl/1-0/
- Source: https://www.openstreetmap.org/api/0.6/map
- Bounding box: west 73.785, south 18.490, east 73.852, north 18.540
- Export timestamp: the `gtpune.retrievedAt` field in the JSON

The importer merges nine OSM XML tiles, deduplicates ways, resolves node references into coordinates, and retains roads and building ways. Contributor usernames and edit metadata are omitted. The application projects the coordinates to local meters, estimates widths and untagged heights, and generates facade appearances. These estimates do not establish the actual appearance of a specific real building.

Keep the database's attribution and license when sharing it, and review the ODbL obligations for modified databases and produced works. The on-screen map links to the OSM copyright page. The illustrative fallback does not use the bundled geographic data.
