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

function canvasTexture(width, height, paint, repeat = false) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Original painted maps. Shop words are generic categories, not filmed signage.
export function createStreetLook() {
  const paver = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#b7b09f";
    g.fillRect(0, 0, 256, 256);
    const tones = ["#cfc6b4", "#b3ab9a", "#ddd3c0", "#a39b8b"];
    for (let y = 0; y < 256; y += 32)
      for (let x = 0; x < 256; x += 32) {
        g.fillStyle = tones[(x / 32 + y / 16) % tones.length];
        g.fillRect(x + 1, y + 1, 30, 30);
      }
    g.fillStyle = "#8b8474";
    g.fillRect(33, 97, 30, 30);
    g.fillRect(161, 33, 30, 30);
    g.fillRect(97, 193, 30, 30);
  }, true);
  const upper = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#d8d2c6";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#b5aea0";
    g.fillRect(0, 0, 256, 16);
    g.fillStyle = "#2c3133";
    g.fillRect(46, 36, 112, 124);
    g.fillStyle = "#7d989e";
    g.fillRect(52, 42, 100, 112);
    g.fillStyle = "#d5ebe4";
    g.fillRect(56, 46, 34, 100);
    g.fillStyle = "#d8d2c6";
    g.fillRect(98, 42, 6, 112);
    g.fillRect(52, 94, 100, 5);
    g.fillStyle = "#ece7dc";
    g.fillRect(178, 64, 56, 40);
    g.fillStyle = "#5a6366";
    g.fillRect(184, 72, 44, 18);
    g.fillStyle = "#323634";
    g.fillRect(18, 178, 220, 8);
    for (let x = 26; x < 230; x += 16) g.fillRect(x, 154, 4, 32);
    g.fillStyle = "rgba(80, 62, 40, 0.09)";
    g.fillRect(0, 210, 256, 46);
  }, true);
  const shopOpen = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#7a302c";
    g.fillRect(0, 0, 256, 54);
    g.fillStyle = "#f3e6c4";
    g.fillRect(16, 16, 224, 24);
    g.fillStyle = "#7a302c";
    g.fillRect(32, 23, 54, 10);
    g.fillRect(98, 23, 28, 10);
    g.fillRect(138, 23, 70, 10);
    g.fillStyle = "#c9b48a";
    g.fillRect(0, 54, 256, 14);
    g.fillStyle = "#163238";
    g.fillRect(0, 68, 256, 164);
    g.fillStyle = "#3f7278";
    g.fillRect(10, 80, 156, 140);
    g.fillStyle = "rgba(226, 240, 234, 0.4)";
    g.fillRect(20, 90, 26, 112);
    g.fillStyle = "#6a5132";
    g.fillRect(178, 108, 64, 124);
    g.fillStyle = "#f0e2bc";
    g.fillRect(214, 162, 8, 10);
    g.fillStyle = "#8b8576";
    g.fillRect(0, 232, 256, 24);
  }, true);
  const shopShutter = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#243c66";
    g.fillRect(0, 0, 256, 54);
    g.fillStyle = "#f3e6c4";
    g.fillRect(16, 16, 224, 24);
    g.fillStyle = "#243c66";
    g.fillRect(36, 23, 40, 10);
    g.fillRect(88, 23, 80, 10);
    g.fillRect(180, 23, 36, 10);
    g.fillStyle = "#c9b48a";
    g.fillRect(0, 54, 256, 14);
    g.fillStyle = "#55646c";
    g.fillRect(0, 68, 256, 164);
    for (let y = 74; y < 224; y += 14) {
      g.fillStyle = y % 28 === 0 ? "#3c494f" : "#7e8c93";
      g.fillRect(8, y, 240, 8);
    }
    g.fillStyle = "#8b8576";
    g.fillRect(0, 232, 256, 24);
  }, true);
  const labels = [
    ["चहा", "#7a302c"],
    ["मिसळ", "#1f5a3c"],
    ["औषध", "#243c66"],
    ["पुस्तक", "#6a4a22"],
    ["बेकरी", "#8a4e16"],
    ["मोबाईल", "#14343a"],
  ];
  const signs = labels.map(([title, bg]) =>
    canvasTexture(512, 160, (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, 512, 160);
      g.strokeStyle = "#f4ecd4";
      g.lineWidth = 8;
      g.strokeRect(8, 8, 496, 144);
      g.fillStyle = "#f6efd8";
      g.font = "700 64px 'Noto Sans Devanagari', Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(title, 256, 82);
    }),
  );
  return { paver, upper, shopOpen, shopShutter, signs };
}

export function puneFacadeMaterial(look, tintHex) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: look.upper,
    roughness: 0.94,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.shopMap = { value: look.shopOpen };
    shader.uniforms.shutterMap = { value: look.shopShutter };
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
        uniform sampler2D shutterMap;
        uniform vec3 uTint;
        varying vec3 vPuneWorld;
        varying vec3 vPuneN;`,
      )
      .replace(
        "#include <map_fragment>",
        `vec4 sampledDiffuseColor;
        {
          float side = abs(vPuneN.x) > abs(vPuneN.z) ? vPuneWorld.z : vPuneWorld.x;
          vec2 shopUv = vec2(side * 0.2, clamp(vPuneWorld.y / 3.2, 0.02, 0.98));
          float floorV = fract((vPuneWorld.y - 3.2) / 3.15);
          vec2 upUv = vec2(side * 0.2, clamp(floorV, 0.02, 0.98));
          float shop = 1.0 - smoothstep(2.85, 3.3, vPuneWorld.y);
          float shutter = step(0.58, fract(sin(floor(side * 0.2) * 47.9) * 43758.5453));
          vec4 shopC = mix(texture2D(shopMap, shopUv), texture2D(shutterMap, shopUv), shutter);
          vec4 upC = texture2D(map, upUv);
          upC.rgb *= uTint;
          sampledDiffuseColor = mix(upC, shopC, shop);
        }
        diffuseColor *= sampledDiffuseColor;`,
      );
  };
  material.customProgramCacheKey = () => `pune-facade-${tintHex.toString(16)}`;
  return material;
}
