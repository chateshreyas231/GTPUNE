import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { residentProfile, segmentDistance } from "../src/city.js";
import {
  ROAD_Y,
  WALK_Y,
  SHOP_NAMES,
  STALL_NAMES,
  cornerPlans,
  exhaustPuff,
  isLightHaze,
  makeCigarette,
  makeConstruction,
  makeFoodStall,
  makePothole,
  makeShopFront,
  makeSmokeWisp,
  potholeMarks,
  ribbonPositions,
  sellerIndex,
  sellerPose,
  shopLabel,
  sidewalkRibbons,
  smogGrade,
  smokerSlots,
  tickWisp,
  wallPositions,
} from "../src/street-corners.js";

const BANNED =
  /starbucks|mcdonald|domino|kfc|burger\s*king|dmart|reliance|chitale|kayani|ccd|cafe\s*coffee|subway|pizza\s*hut/i;

test("sidewalk shares the carriageway kerb through a bend", () => {
  const points = [
    [0, 0],
    [28, 0],
    [28, 22],
    [46, 36],
  ];
  const width = 7;
  const sidewalk = 1.6;
  const ribbons = sidewalkRibbons(points, width, sidewalk);
  assert.equal(ribbons.left.inner, ribbons.carriage.left);
  assert.equal(ribbons.right.inner, ribbons.carriage.right);
  assert.equal(ribbons.left.inner.length, points.length);
  const bend = ribbons.left.inner[1];
  const walk = ribbonPositions(ribbons.left.outer, ribbons.left.inner, WALK_Y);
  let shared = 0;
  for (let i = 0; i < walk.length; i += 3) {
    if (Math.hypot(walk[i] - bend[0], walk[i + 2] - bend[1]) < 1e-6) shared++;
  }
  assert.ok(shared >= 2);
  const e1x = walk[3] - walk[0],
    e1z = walk[5] - walk[2],
    e2x = walk[6] - walk[0],
    e2z = walk[8] - walk[2];
  assert.ok(e1z * e2x - e1x * e2z > 0);
  for (let i = 0; i < points.length; i++) {
    const kerb = ribbons.left.inner[i];
    const outer = ribbons.left.outer[i];
    const centre = points[i];
    const kerbD = Math.hypot(kerb[0] - centre[0], kerb[1] - centre[1]);
    const outerD = Math.hypot(outer[0] - centre[0], outer[1] - centre[1]);
    assert.ok(outerD > kerbD + sidewalk * 0.65);
    assert.ok(kerbD > width / 2 - 0.05);
  }
  const straight = sidewalkRibbons(
    [
      [0, 0],
      [40, 0],
    ],
    width,
    2.2,
  );
  const span = Math.hypot(
    straight.left.outer[0][0] - straight.left.inner[0][0],
    straight.left.outer[0][1] - straight.left.inner[0][1],
  );
  assert.ok(Math.abs(span - 2.2) < 0.02);
  const wall = wallPositions(ribbons.left.inner, ROAD_Y, WALK_Y);
  assert.ok(wall.includes(ROAD_Y));
  assert.ok(wall.includes(WALK_Y));
  assert.ok(WALK_Y > ROAD_Y);
  assert.ok(WALK_Y - ROAD_Y < 0.25);
});

test("potholes sit in the carriageway", () => {
  const points = [
    [0, 0],
    [0, 90],
  ];
  const width = 7;
  const holes = potholeMarks(points, width);
  assert.ok(holes.length >= 2);
  for (const hole of holes) {
    assert.ok(hole.z > 2 && hole.z < 88);
    assert.ok(Math.abs(hole.x) < width / 2 - 0.25);
    const pit = makePothole(hole);
    assert.equal(pit.name, "pothole");
    assert.ok(pit.getObjectByName("pit"));
    assert.ok(pit.getObjectByName("rim"));
  }
});

test("construction, stalls, and shops line the pavement", () => {
  const segments = [
    {
      a: [0, 0],
      b: [0, 180],
      width: 7,
      length: 180,
      sidewalk: 1.6,
    },
  ];
  const plans = cornerPlans(segments, 0, 20, () => false, [
    {
      name: "Laxmi Stores",
      minX: -12,
      maxX: 12,
      minZ: 0,
      maxZ: 180,
    },
    { name: "McDonald's", minX: 0, maxX: 4, minZ: 0, maxZ: 4 },
  ]);
  assert.ok(plans.construction.length >= 3);
  assert.ok(plans.stalls.length >= 4);
  assert.ok(plans.shops.length >= 4);
  for (const spot of [...plans.construction, ...plans.stalls, ...plans.shops]) {
    const dist = segmentDistance(spot.x, spot.z, segments[0].a, segments[0].b);
    assert.ok(dist > segments[0].width / 2 - 0.2);
    assert.ok(dist < segments[0].width / 2 + segments[0].sidewalk + 0.35);
    assert.equal(BANNED.test(spot.name || ""), false);
  }
  for (const stall of plans.stalls) assert.ok(STALL_NAMES.includes(stall.name));
  assert.ok(plans.shops.some((shop) => shop.name === "Laxmi Stores"));
  assert.equal(shopLabel({ name: "McDonald's" }, 0), SHOP_NAMES[0]);
  assert.equal(shopLabel({ name: "Laxmi Stores" }, 2), "Laxmi Stores");
  const site = makeConstruction();
  assert.equal(site.name, "construction");
  assert.ok(site.getObjectByName("barrier"));
  assert.ok(site.getObjectByName("sand"));
  assert.ok(site.getObjectByName("scaffold"));
  const height = new THREE.Box3().setFromObject(site).getSize(new THREE.Vector3()).y;
  assert.ok(height > 2.4 && height < 5);
  const stall = makeFoodStall(plans.stalls[0]);
  assert.equal(stall.name, "food-stall");
  assert.equal(stall.userData.name, plans.stalls[0].name);
  assert.ok(stall.getObjectByName("counter"));
  assert.ok(stall.getObjectByName("canopy"));
  const shop = makeShopFront(plans.shops[0]);
  assert.equal(shop.name, "shop-front");
  assert.equal(shop.userData.name, plans.shops[0].name);
  assert.ok(shop.getObjectByName("shutter"));
  const pose = sellerPose(plans.stalls[0]);
  const stallDist = segmentDistance(
    plans.stalls[0].x,
    plans.stalls[0].z,
    segments[0].a,
    segments[0].b,
  );
  const sellerDist = segmentDistance(pose.x, pose.z, segments[0].a, segments[0].b);
  assert.ok(sellerDist < stallDist);
  assert.equal(residentProfile(sellerIndex(0)).kind, "shop");
  assert.equal(residentProfile(sellerIndex(1)).kind, "shop");
});

test("stalls follow a bent carriageway rather than the straight chord", () => {
  const plans = cornerPlans(
    [
      {
        points: [
          [0, 0],
          [0, 40],
          [30, 40],
          [30, 100],
        ],
        width: 7,
        sidewalk: 1.6,
      },
    ],
    0,
    10,
    () => false,
    [],
  );
  assert.ok(plans.stalls.length >= 1);
  assert.ok(
    plans.stalls.some(
      (stall) => stall.z > 34 && stall.z < 46 && stall.x > 14 && stall.x < 28,
    ),
  );
});

test("distance smog stays a light haze and smokers keep a small cigarette", () => {
  for (const night of [false, true]) {
    const grade = smogGrade(night);
    assert.equal(isLightHaze(grade), true);
  }
  assert.equal(isLightHaze({ fog: 0xffffff, density: 0.02 }), false);
  const day = smogGrade(false);
  assert.equal(day.background, 0xd4d2bc);
  const puff = exhaustPuff();
  assert.ok(puff.opacity > 0.4);
  assert.ok(puff.scale > 0.4);
  assert.ok(puff.color < 0xe0e0e0);
  const slots = smokerSlots(48);
  assert.equal(slots.length, 4);
  assert.equal(new Set(slots).size, 4);
  assert.ok(slots.every((slot) => slot > 0 && slot < 48));
  const cigarette = makeCigarette();
  assert.equal(cigarette.name, "cigarette");
  const stick = cigarette.getObjectByName("cigarette-stick");
  assert.ok(stick.geometry.parameters.height < 0.12);
  const wisp = makeSmokeWisp();
  assert.equal(wisp.name, "smoke-wisp");
  assert.ok(wisp.userData.puffs.length >= 3);
  tickWisp(wisp, 0.2);
  tickWisp(wisp, 0.8);
  assert.ok(wisp.userData.puffs[0].position.y > 0);
});
