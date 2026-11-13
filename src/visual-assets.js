import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { gaitCycle, punchEnvelope } from "./city.js";
const POSE_BONES = [
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "Neck",
  "Head",
  "LeftShoulder",
  "RightShoulder",
  "LeftArm",
  "RightArm",
  "LeftForeArm",
  "RightForeArm",
  "LeftUpLeg",
  "RightUpLeg",
  "LeftLeg",
  "RightLeg",
  "LeftFoot",
  "RightFoot",
  "LeftToeBase",
  "RightToeBase",
];
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
      mixer.stopAllAction();
    }
    // The mesh faces +Z. Travel in this world is local -Z, so turn to face the walk.
    model.rotation.y = Math.PI;
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
    const groundY = -bounds.min.y * normalized.scale.x;
    normalized.position.y = groundY;
    const joints = {};
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
      if (o.isBone) {
        const key = o.name.replace(/^mixamorig:?/, "");
        if (POSE_BONES.includes(key) && !joints[key])
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
    const turn = (name, ...ops) => {
      const joint = joints[name];
      if (!joint) return;
      joint.bone.quaternion.copy(joint.rest);
      for (const [axis, angle] of ops) joint.bone[`rotate${axis}`](angle);
    };
    root.userData.walk = (time, speed = 0) => {
      for (const { bone, rest } of Object.values(joints))
        bone.quaternion.copy(rest);
      const cycle = gaitCycle(time, speed);
      const swing = Math.sin(cycle.phase);
      const liftL = Math.max(0, Math.cos(cycle.phase));
      const liftR = Math.max(0, -Math.cos(cycle.phase));
      const punch = punchEnvelope(root.userData.strike);
      const hang = Math.PI / 2;
      turn("LeftUpLeg", ["X", swing * cycle.stride]);
      turn("RightUpLeg", ["X", -swing * cycle.stride]);
      turn("LeftLeg", ["X", -liftL * cycle.knee]);
      turn("RightLeg", ["X", -liftR * cycle.knee]);
      turn("LeftFoot", ["X", (liftL * 0.45 - liftR * 0.12) * cycle.amount]);
      turn("RightFoot", ["X", (liftR * 0.45 - liftL * 0.12) * cycle.amount]);
      turn("LeftToeBase", ["X", liftL * 0.2 * cycle.amount]);
      turn("RightToeBase", ["X", liftR * 0.2 * cycle.amount]);
      turn(
        "LeftArm",
        ["X", hang],
        ["Z", -swing * cycle.arm + cycle.breath * 0.35],
      );
      turn(
        "LeftForeArm",
        ["Z", 0.32 + Math.max(0, swing) * 0.4 * cycle.amount],
      );
      if (punch) {
        turn("RightArm", ["X", hang], ["Z", -1.25 * punch]);
        turn("RightForeArm", ["Z", punch > 0.25 ? -0.06 : -0.45]);
      } else {
        turn(
          "RightArm",
          ["X", hang],
          ["Z", -swing * cycle.arm - cycle.breath * 0.35],
        );
        turn(
          "RightForeArm",
          ["Z", -(0.32 + Math.max(0, -swing) * 0.4 * cycle.amount)],
        );
      }
      turn("Spine", ["X", cycle.lean * 0.65 + cycle.breath]);
      turn("Spine1", ["X", cycle.lean * 0.85 + cycle.breath * 0.45]);
      turn("Spine2", ["X", cycle.lean * 0.35]);
      normalized.position.y =
        groundY + Math.abs(Math.sin(cycle.phase)) * cycle.bob;
    };
    root.userData.walk(0, 0);
  }
  return roots.length;
}
