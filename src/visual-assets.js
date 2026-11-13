import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { PLAYER_LOOKS, lookById } from "./characters.js";

const lookCache = new Map();

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

export async function prepareLooks() {
  const loader = new GLTFLoader();
  await Promise.all(
    PLAYER_LOOKS.map(async (look) => {
      const gltf = await loader.loadAsync(look.file);
      lookCache.set(look.id, gltf);
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

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) material?.dispose();
  });
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
  for (const child of [...root.children]) {
    if (child.userData?.attachment) continue;
    disposeObject(child);
    root.remove(child);
  }
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
  root.userData.actions = actions;
  root.userData.clip = "";
  root.userData.look = look.id;
  root.userData.name = look.name;
  root.userData.height = look.height;
  root.userData.detailedHuman = true;
  root.userData.walk = (dt = 0, speed = 0) => {
    const meters = Math.abs(Number(speed) || 0);
    const clip = meters > 3.2 ? "Run" : meters > 0.25 ? "Walk" : "Idle";
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
        clip === "Run" ? Math.max(0.85, meters / 4.5) : clip === "Walk" ? Math.max(0.8, meters / 1.4) : 1;
    }
    mixer.update(Math.max(0, dt));
  };
  root.userData.walk(0, 0);
  return true;
}
