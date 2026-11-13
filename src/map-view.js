const SIZES = new Set(["dock", "min", "max"]);

export const MAP_ZOOM_MIN = 0.45;
export const MAP_ZOOM_MAX = 4;
export const MAP_ZOOM_STEP = 1.25;

export function clampZoom(zoom) {
  const value = Number(zoom);
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, value));
}

export function createMapView(partial = {}) {
  return {
    zoom: clampZoom(partial.zoom ?? 1),
    size: SIZES.has(partial.size) ? partial.size : "dock",
    follow: partial.follow !== false,
    focusX: Number.isFinite(partial.focusX) ? partial.focusX : 0,
    focusZ: Number.isFinite(partial.focusZ) ? partial.focusZ : 0,
    pointerOver: partial.pointerOver === true,
  };
}

export function mapScale(size, zoom, canvasWidth) {
  const base = size === "max" ? 0.28 : 0.18;
  const width = canvasWidth > 0 ? canvasWidth : 520;
  return base * clampZoom(zoom) * (width / 520);
}

export function viewCenter(view, playerX, playerZ) {
  if (view.size !== "max" || view.follow) return { x: playerX, z: playerZ };
  return { x: view.focusX, z: view.focusZ };
}

export function toggleExpand(view) {
  view.size = view.size === "max" ? "dock" : "max";
  view.follow = true;
  if (view.size !== "max") view.pointerOver = false;
  return view;
}

export function toggleMin(view) {
  view.size = view.size === "min" ? "dock" : "min";
  view.follow = true;
  view.pointerOver = false;
  return view;
}

export function recenter(view, playerX, playerZ) {
  view.follow = true;
  view.focusX = playerX;
  view.focusZ = playerZ;
  return view;
}

export function panByPixels(view, dx, dy, scale, playerX, playerZ) {
  if (view.size !== "max" || !(scale > 0) || (dx === 0 && dy === 0)) return view;
  if (view.follow) {
    view.focusX = playerX;
    view.focusZ = playerZ;
    view.follow = false;
  }
  view.focusX -= dx / scale;
  view.focusZ -= dy / scale;
  return view;
}

export function zoomBy(view, factor, anchor) {
  const prev = view.zoom;
  const next = clampZoom(prev * factor);
  if (
    anchor &&
    view.size === "max" &&
    !view.follow &&
    anchor.scale > 0 &&
    prev > 0 &&
    next !== prev
  ) {
    const applied = next / prev;
    const worldX = view.focusX + anchor.offsetX / anchor.scale;
    const worldZ = view.focusZ + anchor.offsetY / anchor.scale;
    const nextScale = anchor.scale * applied;
    view.focusX = worldX - anchor.offsetX / nextScale;
    view.focusZ = worldZ - anchor.offsetY / nextScale;
  }
  view.zoom = next;
  return view;
}

export function wheelZoomFactor(deltaY) {
  if (!deltaY) return 1;
  const steps = Math.max(-4, Math.min(4, -deltaY / 120));
  return MAP_ZOOM_STEP ** steps;
}

export function blocksDriving(view) {
  return view.size === "max" && view.pointerOver === true;
}

export function sizeLabels(size) {
  return {
    expand: size === "max" ? "DOCK" : "EXPAND",
    min: size === "min" ? "MAP" : "MIN",
  };
}
