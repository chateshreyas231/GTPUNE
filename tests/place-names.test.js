import test from "node:test";
import assert from "node:assert/strict";
import {
  parseOSM,
  roadTitle,
  buildingLook,
  PLASTER,
  frontageName,
  SHOP_BOARDS,
  isShopFront,
} from "../src/city.js";

test("OSM road and place names stay on the features that carried them", () => {
  const map = parseOSM({
    elements: [
      {
        id: 10,
        tags: {
          highway: "primary",
          name: "Gopal Krushna Gokhale Path",
          alt_name: "FC Road",
        },
        geometry: [
          { lat: 18.52, lon: 73.841 },
          { lat: 18.523, lon: 73.841 },
        ],
      },
      {
        id: 11,
        tags: { highway: "primary", name: "Karve Road" },
        geometry: [
          { lat: 18.51, lon: 73.84 },
          { lat: 18.51, lon: 73.845 },
        ],
      },
      {
        id: 20,
        tags: { building: "college", name: "Fergusson College" },
        geometry: [
          { lat: 18.521, lon: 73.842 },
          { lat: 18.522, lon: 73.842 },
          { lat: 18.522, lon: 73.843 },
          { lat: 18.521, lon: 73.842 },
        ],
      },
      {
        id: 21,
        tags: { building: "retail", shop: "mall", name: "Centro Mall" },
        geometry: [
          { lat: 18.518, lon: 73.844 },
          { lat: 18.519, lon: 73.844 },
          { lat: 18.519, lon: 73.845 },
          { lat: 18.518, lon: 73.844 },
        ],
      },
    ],
  });
  assert.equal(roadTitle(map.roads[0]), "Fergusson College Road");
  assert.equal(roadTitle(map.roads[1]), "Karve Road");
  assert.equal(
    roadTitle({ name: "Jangli Maharaj Path", altName: "JM Road" }),
    "Jangli Maharaj Road",
  );
  assert.equal(map.buildings[0].name, "Fergusson College");
  assert.equal(map.buildings[1].name, "Centro Mall");
  assert.equal(map.buildings[1].shop, "mall");
  assert.ok(map.buildings[0].points.length >= 4);
  assert.ok(map.buildings[0].height > 0);
});

test("building plaster varies and shop bands are not one brown", () => {
  const looks = Array.from({ length: 24 }, (_, i) =>
    buildingLook({ id: i * 3 + 1, kind: "yes" }),
  );
  const plasters = new Set(looks.map((look) => look.plaster));
  assert.ok(plasters.size >= 6);
  for (const look of looks) {
    assert.ok(Object.values(PLASTER).includes(look.plaster));
    assert.ok([0x7c2f3b, 0x1f6b4a, 0x1d4f88, 0xc4892b].includes(look.band));
    assert.equal(look.glass, false);
  }
  assert.equal(
    buildingLook({ id: 4, kind: "yes" }).plaster,
    buildingLook({ id: 4, kind: "yes" }).plaster,
  );
  const mall = buildingLook({
    id: 8,
    kind: "retail",
    shop: "mall",
    name: "Centro Mall",
  });
  assert.equal(mall.glass, true);
  assert.equal(mall.plaster, 0xd5e4ee);
});

test("shop boards keep OSM names and otherwise stay stable", () => {
  assert.equal(frontageName({ id: 4, name: "Deccan Gymkhana" }), "Deccan Gymkhana");
  assert.equal(frontageName({ id: 9 }), frontageName({ id: 9 }));
  assert.notEqual(frontageName({ id: 9 }), frontageName({ id: 10 }));
  const banned = /starbucks|mcdonald|ccd|dmart|reliance|chitale|kayani/i;
  for (const board of SHOP_BOARDS) assert.equal(banned.test(board.name), false);
  assert.equal(isShopFront({ id: 21, shop: "mall", name: "Centro Mall" }), true);
  assert.equal(isShopFront({ id: 7, kind: "yes" }), false);
  assert.equal(frontageName({ id: 3 }), SHOP_BOARDS[3 % SHOP_BOARDS.length].name);
});
