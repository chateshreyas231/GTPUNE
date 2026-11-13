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

// Painted maps only. Shop words are generic categories, not names from the street.
export function createStreetTextures(plasterImage) {
  const upper = canvasTexture(512, 512, (g) => {
    g.fillStyle = "#d7d0c2";
    g.fillRect(0, 0, 512, 512);
    if (plasterImage) g.drawImage(plasterImage, 0, 0, 512, 512);
    for (let y = 8; y < 512; y += 128) {
      g.fillStyle = "#c8c1b2";
      g.fillRect(0, y + 96, 512, 10);
      g.fillStyle = "#5c615f";
      for (let x = 18; x < 500; x += 16) g.fillRect(x, y + 78, 3, 22);
      g.fillStyle = "#8d8778";
      g.fillRect(0, y + 72, 512, 6);
      for (let x = 24; x < 512; x += 128) {
        g.fillStyle = "#2b3032";
        g.fillRect(x - 4, y + 8, 72, 62);
        g.fillStyle = "#7f9ea4";
        g.fillRect(x, y + 12, 64, 54);
        g.fillStyle = "#d5ebe6";
        g.fillRect(x + 4, y + 16, 22, 46);
        g.fillStyle = "#d7d0c2";
        g.fillRect(x + 30, y + 12, 3, 54);
        g.fillRect(x, y + 36, 64, 3);
        if (((x + y) / 16) % 5 === 0) {
          g.fillStyle = "#c5ccd0";
          g.fillRect(x + 70, y + 28, 18, 12);
          g.fillStyle = "#8a9294";
          g.fillRect(x + 86, y + 30, 4, 16);
        }
      }
    }
  });
  const shop = canvasTexture(512, 256, (g, w, h) => {
    const fascias = ["#9d3d34", "#1e5c46", "#2a4e86", "#c47a2c"];
    const words = ["चहा", "किराणा", "औषध", "बेकरी"];
    g.fillStyle = "#cfc6b4";
    g.fillRect(0, 0, w, h);
    const bay = w / 4;
    g.font = "700 28px 'Noto Sans Devanagari', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = 0; i < 4; i++) {
      const x = i * bay;
      g.fillStyle = fascias[i];
      g.fillRect(x, 6, bay, 58);
      g.fillStyle = "#f4ecd8";
      g.fillText(words[i], x + bay / 2, 36);
      g.fillStyle = i % 2 ? "#152226" : "#243036";
      g.fillRect(x + 12, 78, bay - 24, 132);
      g.fillStyle = "rgba(214, 232, 226, 0.35)";
      g.fillRect(x + 22, 90, 18, 104);
      if (i % 2 === 0) {
        for (let y = 86; y < 200; y += 14) {
          g.fillStyle = y % 28 === 0 ? "#3e484c" : "#7d898e";
          g.fillRect(x + 16, y, bay - 32, 7);
        }
      }
      g.fillStyle = "#8b8476";
      g.fillRect(x, h - 36, bay, 36);
      g.fillStyle = "#6e675c";
      g.fillRect(x + bay - 4, 0, 4, h);
    }
  });
  const paver = canvasTexture(128, 128, (g) => {
    g.fillStyle = "#b7ae9a";
    g.fillRect(0, 0, 128, 128);
    const tones = ["#cfc6b4", "#b3aa98", "#ddd4c2", "#a39988"];
    for (let y = 0; y < 128; y += 32)
      for (let x = 0; x < 128; x += 32) {
        g.fillStyle = tones[(x / 32 + y / 16) % tones.length];
        g.fillRect(x + 1, y + 1, 30, 30);
      }
  });
  return { upper, shop, paver };
}

export function commercialWallMaterial(upperMap, shopMap, tint) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: upperMap,
    roughness: 0.94,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uShopFront = { value: shopMap };
    shader.uniforms.uWallTint = { value: new THREE.Color(tint) };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWallWorld;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWallWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uShopFront;
        uniform vec3 uWallTint;
        varying vec3 vWallWorld;`,
      )
      .replace(
        "#include <map_fragment>",
        `vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        float along = vWallWorld.x * 0.07 + vWallWorld.z * 0.09;
        float ground = 1.0 - smoothstep(2.45, 3.2, vWallWorld.y);
        vec2 shopUv = vec2(fract(along), clamp(vWallWorld.y / 3.2, 0.02, 0.98));
        vec3 shopRgb = texture2D(uShopFront, shopUv).rgb;
        sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb * uWallTint, shopRgb, ground);
        diffuseColor *= sampledDiffuseColor;`,
      );
  };
  material.customProgramCacheKey = () => "pune-commercial-wall";
  return material;
}
