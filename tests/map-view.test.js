import test from "node:test";
import assert from "node:assert/strict";
import {
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
  blocksDriving,
  createMapView,
  panByPixels,
  recenter,
  toggleExpand,
  toggleMin,
  viewCenter,
  wheelZoomFactor,
  zoomBy,
} from "../src/map-view.js";

test("expand opens a large map and dock returns to the corner", () => {
  const view = createMapView();
  assert.equal(view.size, "dock");
  toggleExpand(view);
  assert.equal(view.size, "max");
  assert.equal(view.follow, true);
  toggleExpand(view);
  assert.equal(view.size, "dock");
  assert.equal(view.follow, true);
});

test("min and expand do not stay on at the same time", () => {
  const view = createMapView({ size: "max" });
  toggleMin(view);
  assert.equal(view.size, "min");
  toggleExpand(view);
  assert.equal(view.size, "max");
  toggleMin(view);
  assert.equal(view.size, "min");
  toggleMin(view);
  assert.equal(view.size, "dock");
});

test("dragging the expanded map pans and does not snap back to the player", () => {
  const view = createMapView({ size: "max", follow: true });
  panByPixels(view, 100, -40, 2, 10, 20);
  assert.equal(view.follow, false);
  assert.equal(view.focusX, 10 - 100 / 2);
  assert.equal(view.focusZ, 20 - -40 / 2);
  panByPixels(view, 20, 0, 2, 999, 999);
  assert.equal(view.focusX, 10 - 50 - 10);
  assert.deepEqual(viewCenter(view, 400, -200), {
    x: view.focusX,
    z: view.focusZ,
  });
});

test("recenter puts the expanded map back on the player", () => {
  const view = createMapView({ size: "max" });
  panByPixels(view, 80, 0, 1, 0, 0);
  assert.equal(view.follow, false);
  recenter(view, 30, -15);
  assert.equal(view.follow, true);
  assert.deepEqual(viewCenter(view, 30, -15), { x: 30, z: -15 });
  assert.deepEqual(viewCenter(view, 12, 4), { x: 12, z: 4 });
});

test("the docked minimap ignores panning and stays on the player", () => {
  const view = createMapView({ size: "dock" });
  panByPixels(view, 40, 10, 1, 5, 6);
  assert.equal(view.follow, true);
  assert.deepEqual(viewCenter(view, 5, 6), { x: 5, z: 6 });
  assert.deepEqual(viewCenter(view, 9, 1), { x: 9, z: 1 });
});

test("wheel and buttons zoom inside the existing limits", () => {
  const view = createMapView({ zoom: 1 });
  zoomBy(view, wheelZoomFactor(-120));
  assert.equal(view.zoom, 1.25);
  zoomBy(view, wheelZoomFactor(120));
  assert.equal(view.zoom, 1);
  view.zoom = MAP_ZOOM_MAX;
  zoomBy(view, 1.25);
  assert.equal(view.zoom, MAP_ZOOM_MAX);
  view.zoom = MAP_ZOOM_MIN;
  zoomBy(view, 1 / 1.25);
  assert.equal(view.zoom, MAP_ZOOM_MIN);
});

test("driving keys are ignored only while the pointer is over the expanded map", () => {
  const view = createMapView({ size: "max", pointerOver: true });
  assert.equal(blocksDriving(view), true);
  view.pointerOver = false;
  assert.equal(blocksDriving(view), false);
  view.size = "dock";
  view.pointerOver = true;
  assert.equal(blocksDriving(view), false);
});
