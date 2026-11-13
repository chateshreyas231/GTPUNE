// Original art direction informed by inspected Street View, not extracted imagery.
// Coordinates identify the corridor only; no exact photo-to-OSM identity is asserted.
export function fcRoadFacadeProfile(building) {
  const points = building?.points;
  if (!points?.length || building.infill) return null;
  const x = points.reduce((n, p) => n + p[0], 0) / points.length,
    z = points.reduce((n, p) => n + p[1], 0) / points.length;
  const lat = 18.5167 - z / 111320,
    lon = 73.841 + x / 105500;
  if (lat < 18.5173 || lat > 18.5241 || lon < 73.8404 || lon > 73.842)
    return null;
  return lat > 18.5223
    ? {
        id: "fc-recessed-ribbon",
        layout: "recessed-ribbon",
        wallTint: 0xd7c9b1,
        confidence: "corridor-style-only",
        source: "MapChannels/Google Street View January 2026",
      }
    : {
        id: "goodluck-arched",
        layout: "arched-lowrise",
        wallTint: 0xe3dac1,
        confidence: "corridor-style-only",
        source: "MapChannels/Google Street View December 2025",
      };
}
export function drawReferenceFacade(ctx, profile) {
  const w = 512,
    h = 512;
  ctx.fillStyle = profile.layout === "recessed-ribbon" ? "#d4c5a9" : "#e5ddc7";
  ctx.fillRect(0, 0, w, h);
  for (let row = 0; row < 4; row++) {
    const y = row * 128;
    ctx.fillStyle = "#b9ad93";
    ctx.fillRect(0, y + 117, w, 11);
    if (profile.layout === "recessed-ribbon") {
      ctx.fillStyle = "#39464a";
      ctx.fillRect(12, y + 20, 488, 77);
      ctx.fillStyle = "#647777";
      ctx.fillRect(18, y + 27, 476, 24);
      for (let col = 0; col < 6; col++) {
        ctx.fillStyle = "#d4c5a9";
        ctx.fillRect(col * 88, y + 6, 12, 112);
        ctx.fillStyle = "#293639";
        ctx.fillRect(col * 88 + 17, y + 27, 4, 65);
      }
    } else
      for (let col = 0; col < 4; col++) {
        const x = col * 128 + 35;
        ctx.fillStyle = "#b4a88b";
        ctx.fillRect(x - 5, y + 43, 67, 65);
        ctx.beginPath();
        ctx.arc(x + 28, y + 43, 33, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#475957";
        ctx.fillRect(x, y + 45, 56, 57);
        ctx.beginPath();
        ctx.arc(x + 28, y + 45, 28, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#9d9985";
        ctx.fillRect(x + 26, y + 24, 4, 77);
        ctx.fillRect(x - 6, y + 102, 68, 6);
      }
  }
}
