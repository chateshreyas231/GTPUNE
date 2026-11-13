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

function canvasTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

// Original painted shop and upper-floor maps. Not traced from a photograph.
function facadeMaps() {
  const shop = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#cbbfa8";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#8d8474";
    g.fillRect(0, 214, 256, 42);
    g.fillStyle = "#1a3034";
    g.fillRect(16, 78, 224, 136);
    g.fillStyle = "#3e6d72";
    g.fillRect(28, 90, 118, 112);
    g.fillStyle = "rgba(214, 236, 230, 0.35)";
    g.fillRect(40, 100, 28, 90);
    g.fillStyle = "#6d7c80";
    for (let y = 90; y < 200; y += 14) g.fillRect(156, y, 72, 7);
    g.fillStyle = "#7a342c";
    g.fillRect(0, 36, 256, 42);
    g.fillStyle = "#f3e6c4";
    g.fillRect(18, 50, 220, 14);
    g.fillStyle = "#c4b59a";
    g.fillRect(0, 214, 256, 6);
  });
  const upper = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#e7dccb";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#c4b7a4";
    g.fillRect(0, 0, 256, 22);
    g.fillStyle = "#b7aa96";
    g.fillRect(0, 22, 256, 8);
    g.fillStyle = "#4e463c";
    g.fillRect(78, 58, 100, 132);
    g.fillStyle = "#6f9494";
    g.fillRect(86, 66, 84, 112);
    g.fillStyle = "#e7dccb";
    g.fillRect(124, 66, 6, 112);
    g.fillRect(86, 118, 84, 5);
    g.fillStyle = "#d9cfc0";
    g.fillRect(70, 188, 116, 12);
    g.fillStyle = "#5c564c";
    g.fillRect(74, 214, 108, 6);
    g.fillStyle = "rgba(90, 70, 48, 0.08)";
    g.fillRect(0, 228, 256, 28);
  });
  return { shop, upper };
}

let paintedFacades;
export function streetBuildingMaterial(tintHex) {
  if (!paintedFacades) paintedFacades = facadeMaps();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: paintedFacades.upper,
    roughness: 0.94,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.shopMap = { value: paintedFacades.shop };
    shader.uniforms.uTint = { value: new THREE.Color(tintHex) };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vPuneWorld;\nvarying vec3 vPuneN;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vPuneWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vPuneN = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D shopMap;
        uniform vec3 uTint;
        varying vec3 vPuneWorld;
        varying vec3 vPuneN;`,
      )
      .replace(
        "#include <map_fragment>",
        `vec4 sampledDiffuseColor;
        {
          float along = abs(vPuneN.x) > abs(vPuneN.z) ? vPuneWorld.z : vPuneWorld.x;
          vec2 shopUv = vec2(along * 0.18, clamp(vPuneWorld.y / 3.2, 0.0, 1.0));
          float floorV = fract((vPuneWorld.y - 3.2) / 3.15);
          vec2 upUv = vec2(along * 0.2, clamp(floorV, 0.02, 0.98));
          float shopBand = 1.0 - smoothstep(2.9, 3.35, vPuneWorld.y);
          vec4 shopC = texture2D(shopMap, shopUv);
          vec4 upC = texture2D(map, upUv);
          shopC.rgb *= mix(vec3(1.0), uTint, 0.22);
          upC.rgb *= uTint;
          sampledDiffuseColor = mix(upC, shopC, shopBand);
        }
        diffuseColor *= sampledDiffuseColor;`,
      );
  };
  material.customProgramCacheKey = () => `street-facade-${tintHex.toString(16)}`;
  return material;
}
