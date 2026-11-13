// Original Blender bodies, recolored in game. Editable sources: assets/blender/.
// The girl is the default. V cycles girl, boy, man.
export const PLAYER_LOOKS = [
  {
    id: "girl",
    name: "Ananya",
    label: "Girl",
    file: "/assets/pune-originals/pune-woman.glb",
    height: 1.62,
    license: "CC0-1.0",
    credit: "GTPUNE original Blender character",
    source: "assets/blender/pune-woman.blend",
    materials: {
      Skin: 0xd6b08a,
      Hair_Blond: 0x1a1412,
      Hair_Brown: 0x1a1412,
      White: 0xf4f1ea,
      Orange: 0x243044,
      Brown: 0x14110f,
      Grey: 0x2a2622,
      Shirt: 0x305b6e,
      Pants: 0x243044,
      Hair: 0x1a1412,
    },
  },
  {
    id: "boy",
    name: "Kabir",
    label: "Boy",
    file: "/assets/pune-originals/pune-young-adult.glb",
    height: 1.5,
    license: "CC0-1.0",
    credit: "GTPUNE original Blender character, shortened adult proportions",
    source: "assets/blender/pune-young-adult.blend",
    materials: {
      Skin: 0xe0bc96,
      Hair: 0x1a1412,
      Eyebrows: 0x1a1412,
      Eye: 0x14110f,
      Purple: 0x8e3d4a,
      LightBlue: 0x2c3a4e,
      White: 0xe8e4dc,
      Shirt: 0x8e3d4a,
      Pants: 0x2c3a4e,
    },
  },
  {
    id: "man",
    name: "Nikhil",
    label: "Man",
    file: "/assets/pune-originals/pune-man.glb",
    height: 1.76,
    license: "CC0-1.0",
    credit: "GTPUNE original Blender character",
    source: "assets/blender/pune-man.blend",
    materials: {
      Skin: 0xc89870,
      Skin_Darker: 0xb58868,
      Hair: 0x241c18,
      Eyebrows: 0x241c18,
      Eye: 0x14110f,
      LightBrown: 0xe4dccc,
      LightBlue: 0x2a3038,
      White: 0xd8d2c8,
      Red_Dark: 0x2a2622,
      Shirt: 0xe4dccc,
      Pants: 0x2a3038,
    },
  },
];

export function defaultLook() {
  return PLAYER_LOOKS[0];
}

export function lookById(id) {
  return PLAYER_LOOKS.find((look) => look.id === id) || PLAYER_LOOKS[0];
}

export function cycleLook(id) {
  const index = PLAYER_LOOKS.findIndex((look) => look.id === id);
  const next = index < 0 ? 0 : (index + 1) % PLAYER_LOOKS.length;
  return PLAYER_LOOKS[next].id;
}
