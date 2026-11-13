import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { PLAYER_LOOKS, lookById } from "./characters.js";

const lookCache = new Map();
const residentCache = new Map();
const loader = new GLTFLoader();

// Everyday people from Quaternius's Ultimate Animated Character pack.
// CC0 1.0, https://opengameart.org/content/animated-characters-pack
const MEN = ["casual-male", "casual2-male", "casual-bald", "worker-male"];
const WOMEN = ["casual-female", "casual2-female", "old-classy-female"];
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
  const library = residentCache;
  await Promise.all(
    [...MEN, ...WOMEN].map(async (name) => {
      if (!library.has(name))
        library.set(
          name,
          await loader.loadAsync(`/assets/characters/${name}.glb`),
        );
    }),
  );
  let men = 0;
  let women = 0;
  for (const root of roots) {
    const woman = root.userData.role?.gender === "woman";
    const name = woman
      ? WOMEN[women++ % WOMEN.length]
      : MEN[men++ % MEN.length];
    const gltf = library.get(name);
    const model = clone(gltf.scene);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const height = bounds.max.y - bounds.min.y || 1;
    const normalized = new THREE.Group();
    // The walk cycle travels along +Z. Walkers and cars face -Z.
    model.rotation.y = Math.PI;
    normalized.add(model);
    normalized.scale.setScalar(1.72 / height);
    normalized.position.y = -bounds.min.y * normalized.scale.x;
    paintResident(model, root);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    clearCharacter(root);
    markSharedGeometry(model);
    root.add(normalized);
    root.userData.height = 1.72;
    root.userData.detailedHuman = true;
    root.userData.cast = name;
    const mixer = new THREE.AnimationMixer(model);
    root.userData.mixer = mixer;
    root.userData.animationRoot = model;
    const idleClip = gltf.animations.find((clip) => clip.name === "Idle");
    const walkClip = gltf.animations.find((clip) => clip.name === "Walk");
    const idle = idleClip ? mixer.clipAction(idleClip) : null;
    const walk = walkClip ? mixer.clipAction(walkClip) : null;
    idle?.play();
    walk?.play();
    idle?.setEffectiveWeight(1);
    walk?.setEffectiveWeight(0);
    root.userData.walk = (dt = 0, speed = 0) => {
      const moving = Math.abs(speed) > 0.12;
      if (walk && idle) {
        walk.setEffectiveWeight(moving ? 1 : 0);
        idle.setEffectiveWeight(moving ? 0 : 1);
        if (moving) {
          const pace = Math.min(1.55, Math.max(0.82, Math.abs(speed) / 1.7));
          walk.setEffectiveTimeScale(pace);
        }
      }
      mixer.update(Math.max(0, dt));
      const sway = moving
        ? Math.sin((walk?.time || 0) * Math.PI * 2) * 0.04
        : 0;
      normalized.position.x = sway;
      normalized.rotation.z = sway * 0.7;
    };
    root.userData.walk(0, 0);
  }
  return roots.length;
}

function paintResident(model, root) {
  const skin = root.userData.skin ?? 0xd6b08a;
  const shirt = root.userData.shirt ?? 0xe4dccc;
  const pants = root.userData.role?.bottom ?? 0x343a42;
  const hair = root.userData.role?.hair ?? 0x1b1714;
  model.traverse((object) => {
    if (!object.isMesh) return;
    const source = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const painted = source.map((material) => {
      const next = material.clone();
      const name = material.name || "";
      if (/skin|face/i.test(name)) next.color.setHex(skin);
      else if (/shirt|vest|detail/i.test(name)) next.color.setHex(shirt);
      else if (/pants/i.test(name)) next.color.setHex(pants);
      else if (/hair|hat/i.test(name)) next.color.setHex(hair);
      else if (/belt/i.test(name)) next.color.setHex(0x2a241c);
      next.roughness = 0.78;
      next.metalness = 0.02;
      return next;
    });
    object.material = Array.isArray(object.material) ? painted : painted[0];
  });
}

export async function prepareLooks() {
  await Promise.all(
    PLAYER_LOOKS.map(async (look) => {
      if (!lookCache.has(look.id))
        lookCache.set(look.id, await loader.loadAsync(look.file));
    }),
  );
  return lookCache.size;
}

function paintLook(model, look) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.isSkinnedMesh) object.frustumCulled = false;
    const source = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const painted = source.map((material) => {
      const next = material.clone();
      const hex = look.materials?.[next.name];
      if (hex != null) next.color.setHex(hex);
      next.metalness = 0.02;
      next.roughness = 0.82;
      return next;
    });
    object.material = Array.isArray(object.material) ? painted : painted[0];
  });
}

// SkeletonUtils.clone shares immutable geometry with the cached source model.
// Replacing a look disposes only clone-owned materials and skeleton resources.
function markSharedGeometry(model) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.userData.sharedCharacterGeometry = true;
  });
}
function clearCharacter(root) {
  const oldMixer = root.userData.mixer;
  if (oldMixer) {
    oldMixer.stopAllAction();
    if (root.userData.animationRoot)
      oldMixer.uncacheRoot(root.userData.animationRoot);
  }
  for (const child of [...root.children]) {
    if (child.userData?.attachment) continue;
    const skeletons = new Set();
    child.traverse((object) => {
      if (!object.isMesh) return;
      if (!object.userData.sharedCharacterGeometry) object.geometry?.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material?.dispose();
      if (object.isSkinnedMesh) skeletons.add(object.skeleton);
    });
    for (const skeleton of skeletons) skeleton?.dispose();
    root.remove(child);
  }
}

export function applyLook(root, id) {
  const look = lookById(id);
  const gltf = lookCache.get(look.id);
  if (!gltf) return false;
  const model = clone(gltf.scene);
  model.traverse((object) => {
    if (object.isSkinnedMesh) object.skeleton.update();
  });
  paintLook(model, look);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const height = bounds.max.y - bounds.min.y;
  const fitted = new THREE.Group();
  fitted.name = "player-look";
  // These rigs face +Z. Walking and driving face -Z.
  model.rotation.y = Math.PI;
  fitted.add(model);
  if (height > 0.2) {
    fitted.scale.setScalar(look.height / height);
    fitted.position.y = -bounds.min.y * fitted.scale.x;
  }
  clearCharacter(root);
  markSharedGeometry(model);
  root.add(fitted);
  const mixer = new THREE.AnimationMixer(fitted);
  const actions = {};
  for (const clip of gltf.animations) {
    if (!["Idle", "Walk", "Run"].includes(clip.name)) continue;
    const action = mixer.clipAction(clip, fitted);
    action.enabled = true;
    actions[clip.name] = action;
  }
  root.userData.mixer = mixer;
  root.userData.animationRoot = fitted;
  root.userData.actions = actions;
  root.userData.clip = "";
  root.userData.look = look.id;
  root.userData.cast = look.id;
  root.userData.name = look.name;
  root.userData.height = look.height;
  root.userData.detailedHuman = true;
  root.userData.walk = (dt = 0, speed = 0) => {
    const meters = Math.abs(Number(speed) || 0);
    const clip =
      meters > 3.2 && actions.Run
        ? "Run"
        : meters > 0.25 && actions.Walk
          ? "Walk"
          : "Idle";
    const next = actions[clip];
    if (next && root.userData.clip !== clip) {
      next.reset().fadeIn(0.12).play();
      const previous = actions[root.userData.clip];
      if (previous) previous.fadeOut(0.12);
      root.userData.clip = clip;
    }
    const playing = actions[root.userData.clip];
    if (playing) {
      playing.timeScale =
        clip === "Run"
          ? Math.max(0.85, meters / 4.5)
          : clip === "Walk"
            ? Math.max(0.8, meters / 1.4)
            : 1;
    }
    mixer.update(Math.max(0, dt));
  };
  root.userData.walk(0, 0);
  return true;
}
