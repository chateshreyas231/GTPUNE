import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { stepGait } from "./city.js";
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
    // This rig faces +Z. The walker faces -Z, the same way the car and the
    // procedural body move, so turn the mesh around before it is scaled.
    model.rotation.y = Math.PI;
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
    if (root.userData.player) {
      try {
        dressPuneri(model);
      } catch (error) {
        console.warn("Player look fallback", error);
      }
    }
    root.userData.walk = (dt = 0, speed = 0) => {
      const { swing, hip, arm, knee } = stepGait(root.userData, dt, speed);
      for (const [name, { bone, rest }] of Object.entries(joints)) {
        bone.quaternion.copy(rest);
        const left = name.startsWith("Left");
        // Bind pose is a T. Local +X drops the arm to the side. The same
        // local Z on both arms swings them opposite ways along facing,
        // because the right arm's axis is mirrored. +Z on the left arm
        // is backward, so a positive swing (left leg forward) sends the
        // left arm back and the right arm forward.
        if (name.endsWith("Arm")) {
          bone.rotateX(Math.PI / 2);
          bone.rotateZ(swing * arm);
        }
        if (name.endsWith("UpLeg")) bone.rotateX((left ? -swing : swing) * hip);
        if (name === "LeftLeg" || name === "RightLeg") {
          const forward = left ? Math.max(0, swing) : Math.max(0, -swing);
          bone.rotateX(forward * knee);
        }
      }
    };
    root.userData.walk(0, 0);
  }
  return roots.length;
}

function dressPuneri(model) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    const source = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const dressed = source.map((material) => {
      const next = material.clone();
      if (next.map?.image) next.map = recolorPuneri(next.map);
      next.metalness = 0.02;
      next.roughness = 0.78;
      next.metalnessMap = null;
      return next;
    });
    object.material = Array.isArray(object.material) ? dressed : dressed[0];
  });
}

// Light-medium wheatish skin, a light shirt, dark hair and trousers left dark.
function recolorPuneri(source) {
  const image = source.image;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  const px = frame.data;
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i],
      g = px[i + 1],
      b = px[i + 2];
    if (r > 180 && g > 150 && b < 140 && r > b + 40) {
      const shade = Math.max(
        0.55,
        Math.min(1.15, (0.299 * r + 0.587 * g + 0.114 * b) / 255 / 0.82),
      );
      px[i] = clamp(228 * shade);
      px[i + 1] = clamp(220 * shade);
      px[i + 2] = clamp(206 * shade);
    } else if (
      r > g &&
      g > b &&
      r - b > 28 &&
      r > 35 &&
      r < 200 &&
      g < 155 &&
      b < 120
    ) {
      const shade = Math.max(
        0.55,
        Math.min(1.15, (0.299 * r + 0.587 * g + 0.114 * b) / 78),
      );
      px[i] = clamp(214 * shade);
      px[i + 1] = clamp(176 * shade);
      px[i + 2] = clamp(138 * shade);
    } else if (r > 145 && g < 110 && b < 110 && r > g + 35 && r > b + 35) {
      px[i] = 176;
      px[i + 1] = 154;
      px[i + 2] = 132;
    }
  }
  context.putImageData(frame, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = source.flipY;
  map.wrapS = source.wrapS;
  map.wrapT = source.wrapT;
  map.anisotropy = source.anisotropy || 4;
  map.needsUpdate = true;
  return map;
}
