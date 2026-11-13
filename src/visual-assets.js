import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
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
  const gltf = await new GLTFLoader().loadAsync(
    "/assets/characters/michelle.glb",
  );
  for (const root of roots) {
    const model = clone(gltf.scene);
    const mixer = new THREE.AnimationMixer(model),
      pose = gltf.animations.find((c) => c.name === "TPose");
    if (pose) {
      mixer.clipAction(pose).play();
      mixer.update(0.001);
    }
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (o.isSkinnedMesh) {
        o.skeleton.update();
        o.computeBoundingBox();
      }
    });
    const bounds = new THREE.Box3().setFromObject(model),
      height = bounds.max.y - bounds.min.y;
    const normalized = new THREE.Group();
    normalized.add(model);
    normalized.scale.setScalar(1.72 / height);
    normalized.position.y = -bounds.min.y * normalized.scale.x;
    const joints = {};
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
      if (o.isBone) {
        const name = o.name.replace(/[^a-z]/gi, "");
        for (const key of [
          "LeftArm",
          "RightArm",
          "LeftUpLeg",
          "RightUpLeg",
          "LeftLeg",
          "RightLeg",
          "Head",
        ])
          if (name.endsWith(key))
            joints[key] = { bone: o, rest: o.quaternion.clone() };
      }
    });
    for (const child of [...root.children]) {
      child.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          if (!Array.isArray(o.material)) o.material.dispose();
        }
      });
      root.remove(child);
    }
    root.add(normalized);
    root.userData.height = 1.72;
    root.userData.detailedHuman = true;
    root.userData.walk = (time, amount = 1) => {
      for (const [name, { bone, rest }] of Object.entries(joints)) {
        bone.quaternion.copy(rest);
        const left = name.startsWith("Left"),
          swing = Math.sin(time * 6 + (left ? 0 : Math.PI)) * amount;
        if (name.endsWith("Arm")) bone.rotateZ(left ? -1.25 : 1.25);
        if (name.endsWith("UpLeg")) bone.rotateX(swing * 0.35);
        if (name.endsWith("Leg") && !name.endsWith("UpLeg"))
          bone.rotateX(Math.max(0, -swing) * 0.4);
        if (name.endsWith("Arm")) bone.rotateX(-swing * 0.25);
      }
    };
    root.userData.walk(0, 0);
  }
  return roots.length;
}
