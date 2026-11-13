import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

// Quaternius Ultimate Animated Character Pack, CC0. See README and docs/ASSETS.md.
export const CHARACTER_CAST = [
  { id: "casual-male", file: "casual-male.glb", gender: "man", kind: "student" },
  { id: "casual-female", file: "casual-female.glb", gender: "woman", kind: "student" },
  { id: "worker-male", file: "worker-male.glb", gender: "man", kind: "shop" },
  { id: "worker-female", file: "worker-female.glb", gender: "woman", kind: "shop" },
  { id: "older-male", file: "older-male.glb", gender: "man", kind: "older" },
  { id: "older-female", file: "older-female.glb", gender: "woman", kind: "older" },
];

const MATERIAL_SLOTS = {
  Skin: "skin",
  Face: "skin",
  Hair: "hair",
  Shirt: "top",
  Pants: "bottom",
};

export function characterFor(root) {
  const role = root.userData.role;
  if (!role) return CHARACTER_CAST[0];
  return (
    CHARACTER_CAST.find(
      (cast) => cast.gender === role.gender && cast.kind === role.kind,
    ) ||
    CHARACTER_CAST.find((cast) => cast.gender === role.gender) ||
    CHARACTER_CAST[0]
  );
}

export async function loadSurfacePhotos() {
  const loader = new THREE.TextureLoader();
  const result = {};
  for (const [name, file] of [
    ["asphalt", "asphalt"],
    ["plaster", "plaster"],
  ]) {
    try {
      const t = await loader.loadAsync(`/assets/materials/${file}.jpg`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      result[name] = t;
    } catch (e) {
      console.warn("Material fallback", name, e.message);
    }
  }
  return result;
}

export async function hydrateResidents(roots) {
  const loader = new GLTFLoader();
  const loaded = new Map();
  await Promise.all(
    CHARACTER_CAST.map(async (cast) => {
      try {
        loaded.set(cast.id, await loader.loadAsync(`/assets/characters/${cast.file}`));
      } catch (error) {
        console.warn("Character fallback", cast.file, error);
      }
    }),
  );
  let count = 0;
  for (const root of roots) {
    const gltf = loaded.get(characterFor(root).id);
    if (!gltf) continue;
    try {
      mountCharacter(root, gltf);
      count++;
    } catch (error) {
      console.warn("Character fallback", error);
    }
  }
  return count;
}

function tintCharacter(model, palette) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    const source = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const dressed = source.map((material) => {
      const next = material.clone();
      const slot = MATERIAL_SLOTS[next.name];
      if (slot && palette[slot] != null) next.color.set(palette[slot]);
      next.roughness = 0.78;
      next.metalness = 0;
      return next;
    });
    object.material = Array.isArray(object.material) ? dressed : dressed[0];
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
  });
}

function footSeparation(root) {
  root.updateMatrixWorld(true);
  const left = new THREE.Vector3();
  const right = new THREE.Vector3();
  root.getObjectByName("FootL").getWorldPosition(left);
  root.getObjectByName("FootR").getWorldPosition(right);
  return Math.abs(left.z - right.z);
}

// A full cycle is two steps. The widest foot gap is about one step.
function authoredSpeed(mixer, action, clip, root) {
  action.reset().play();
  action.setEffectiveWeight(1);
  let maxSep = 0;
  for (let i = 0; i < 12; i++) {
    mixer.setTime((i / 12) * clip.duration);
    maxSep = Math.max(maxSep, footSeparation(root));
  }
  action.setEffectiveWeight(0);
  return (maxSep * 2) / clip.duration;
}

export function mountCharacter(root, gltf) {
  const model = clone(gltf.scene);
  tintCharacter(model, {
    skin: root.userData.skin ?? 0xd6b08a,
    hair: root.userData.hair ?? 0x1b1714,
    top: root.userData.shirt ?? 0xe4dccc,
    bottom: root.userData.bottom ?? 0x343a42,
  });
  // These rigs step toward +Z. People in the city face -Z.
  model.rotation.y = Math.PI;
  const bounds = new THREE.Box3().setFromObject(model);
  const height = Math.max(0.01, bounds.max.y - bounds.min.y);
  const normalized = new THREE.Group();
  normalized.name = "character-mesh";
  normalized.add(model);
  normalized.scale.setScalar(1.72 / height);
  normalized.position.y = -bounds.min.y * normalized.scale.x;
  for (const child of [...root.children]) {
    child.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material.dispose();
    });
    root.remove(child);
  }
  root.add(normalized);
  root.updateMatrixWorld(true);

  const clips = {};
  for (const name of ["Idle", "Walk", "Run"]) {
    const clip = gltf.animations.find((entry) => entry.name === name);
    if (!clip) throw new Error(`Character is missing ${name}`);
    clips[name.toLowerCase()] = clip;
  }
  for (const bone of ["FootL", "FootR", "FistL", "FistR", "Head"]) {
    if (!model.getObjectByName(bone)) throw new Error(`Character is missing ${bone}`);
  }
  const mixer = new THREE.AnimationMixer(model);
  const actions = {
    idle: mixer.clipAction(clips.idle),
    walk: mixer.clipAction(clips.walk),
    run: mixer.clipAction(clips.run),
  };
  for (const action of Object.values(actions)) {
    action.play();
    action.setEffectiveWeight(0);
  }
  const authored = {
    walk: authoredSpeed(mixer, actions.walk, clips.walk, root),
    run: authoredSpeed(mixer, actions.run, clips.run, root),
  };
  actions.idle.setEffectiveWeight(1);
  mixer.setTime(0);

  let mode = "idle";
  const fade = 0.16;
  root.userData.detailedHuman = true;
  root.userData.character = characterFor(root).id;
  root.userData.mixer = mixer;
  root.userData.actions = actions;
  root.userData.authored = authored;
  root.userData.gaitMode = mode;
  // Walk and Run swing the opposite arm and leg and shift the head
  // and torso over the standing foot. The clip speeds up with travel.
  root.userData.walk = (dt = 0, speed = 0) => {
    const meters = Math.abs(Number(speed) || 0);
    const next = meters < 0.2 ? "idle" : meters < 3.2 ? "walk" : "run";
    if (next !== mode) {
      actions[mode].fadeOut(fade);
      actions[next].reset().fadeIn(fade).play();
      mode = next;
      root.userData.gaitMode = mode;
    }
    if (mode !== "idle") {
      const pace = authored[mode] || 1;
      actions[mode].setEffectiveTimeScale(
        Math.min(2.8, Math.max(0.75, meters / pace)),
      );
    }
    mixer.update(Math.max(0, dt));
  };
  root.userData.pose = () => {
    root.updateMatrixWorld(true);
    const localZ = (name) => {
      const point = new THREE.Vector3();
      root.getObjectByName(name).getWorldPosition(point);
      root.worldToLocal(point);
      return point.z;
    };
    return {
      leftLeg: localZ("FootL"),
      rightLeg: localZ("FootR"),
      leftArm: localZ("FistL"),
      rightArm: localZ("FistR"),
      leftArmZ: 0,
      rightArmZ: 0,
    };
  };
  root.userData.walk(0, 0);
  return root;
}
