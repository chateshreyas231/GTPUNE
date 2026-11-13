import {
  RawShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// Slightly wider than the previous chase lens (57°) and follow distances
// (4.4 m on foot, 13 m in a car). Close and overhead cameras stay put.
export const CINEMATIC = {
  fov: 62,
  footBack: 4.9,
  carBack: 14.4,
  carHeight: 7.45,
  bloomStrength: 0.18,
  bloomRadius: 0.5,
  bloomThreshold: 1.9,
  bloomSmooth: 0.55,
  contrast: 0.96,
  lift: 0.015,
  vignette: 0.18,
  exposure: 1.05,
  letterbox: 0,
};

export const GRADE = {
  shadowTint: [0.92, 0.98, 1.06],
  highlightTint: [1.16, 1.03, 0.82],
  printTint: [1.05, 1.01, 0.94],
  shadowMix: 0.55,
  highlightMix: 0.62,
  saturation: 1,
  whitePoint: 3.4,
};

const LUMA = [0.2126, 0.7152, 0.0722];

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function luma(color) {
  return color[0] * LUMA[0] + color[1] * LUMA[1] + color[2] * LUMA[2];
}

// Linear scene color after the film grade, before the sRGB display encode.
// The fullscreen shader uses these same constants.
export function gradeSceneColor(rgb, u = 0.5, v = 0.5) {
  let color = rgb.map((channel) => Math.max(0, channel) * CINEMATIC.exposure);
  const shadow = 1 - smoothstep(0.02, 0.55, luma(color));
  const highlight = smoothstep(0.25, 1.35, luma(color));
  color = color.map(
    (channel, i) =>
      channel * (1 + (GRADE.shadowTint[i] - 1) * shadow * GRADE.shadowMix),
  );
  color = color.map(
    (channel, i) =>
      channel *
      (1 + (GRADE.highlightTint[i] - 1) * highlight * GRADE.highlightMix),
  );
  color = color.map((channel, i) => channel * GRADE.printTint[i]);
  const mid = luma(color);
  color = color.map((channel) => mid + (channel - mid) * GRADE.saturation);
  const white = GRADE.whitePoint;
  color = color.map((channel) => {
    const mapped = Math.min(
      1,
      (channel * (1 + channel / (white * white))) / (1 + channel),
    );
    const softer = (mapped - 0.5) * CINEMATIC.contrast + 0.5;
    return softer * (1 - CINEMATIC.lift) + CINEMATIC.lift;
  });
  const px = (u - 0.5) * 1.05;
  const py = (v - 0.5) * 1.15;
  const edge = smoothstep(0.18, 0.75, px * px + py * py);
  const shade = 1 - CINEMATIC.vignette * edge;
  return color.map((channel) => Math.max(0, channel * shade));
}

export function thirdPersonRig({ walking, view }) {
  if (walking) {
    if (view === 1) return { back: 2.6, overhead: false };
    if (view === 2) return { back: 16, overhead: true };
    return { back: CINEMATIC.footBack, overhead: false };
  }
  if (view === 1) return { back: 5, height: 3 };
  if (view === 2) return { back: 18, height: 42 };
  return { back: CINEMATIC.carBack, height: CINEMATIC.carHeight };
}

function filmGradeMaterial() {
  const material = new RawShaderMaterial({
    name: "FilmGrade",
    uniforms: {
      tDiffuse: { value: null },
      contrast: { value: CINEMATIC.contrast },
      lift: { value: CINEMATIC.lift },
      vignette: { value: CINEMATIC.vignette },
      exposure: { value: CINEMATIC.exposure },
      shadowTint: { value: new Vector3(...GRADE.shadowTint) },
      highlightTint: { value: new Vector3(...GRADE.highlightTint) },
      shadowMix: { value: GRADE.shadowMix },
      highlightMix: { value: GRADE.highlightMix },
      saturation: { value: GRADE.saturation },
      whitePoint: { value: GRADE.whitePoint },
      printTint: { value: new Vector3(...GRADE.printTint) },
    },
    vertexShader: /* glsl */ `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tDiffuse;
      uniform float contrast;
      uniform float lift;
      uniform float vignette;
      uniform float exposure;
      uniform vec3 shadowTint;
      uniform vec3 highlightTint;
      uniform float shadowMix;
      uniform float highlightMix;
      uniform float saturation;
      uniform float whitePoint;
      uniform vec3 printTint;
      varying vec2 vUv;
      void main() {
        vec3 color = max(texture2D(tDiffuse, vUv).rgb, 0.0) * exposure;
        float y = dot(color, vec3(0.2126, 0.7152, 0.0722));
        float shadow = 1.0 - smoothstep(0.02, 0.55, y);
        float highlight = smoothstep(0.25, 1.35, y);
        color *= mix(vec3(1.0), shadowTint, shadow * shadowMix);
        color *= mix(vec3(1.0), highlightTint, highlight * highlightMix);
        color *= printTint;
        float y2 = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(y2), color, saturation);
        color = color * (vec3(1.0) + color / (whitePoint * whitePoint)) / (vec3(1.0) + color);
        color = min(color, vec3(1.0));
        color = (color - 0.5) * contrast + 0.5;
        color = color * (1.0 - lift) + lift;
        vec2 p = (vUv - 0.5) * vec2(1.05, 1.15);
        float edge = smoothstep(0.18, 0.75, dot(p, p));
        color *= 1.0 - vignette * edge;
        color = pow(clamp(max(color, 0.0), 0.0, 1.0), vec3(0.4545454545));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  material.toneMapped = false;
  return material;
}

export function createCinematicComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new Vector2(256, 256),
    CINEMATIC.bloomStrength,
    CINEMATIC.bloomRadius,
    CINEMATIC.bloomThreshold,
  );
  bloom.highPassUniforms.smoothWidth.value = CINEMATIC.bloomSmooth;
  const fitBloom = bloom.setSize.bind(bloom);
  bloom.setSize = (width, height) => {
    const cap = 960;
    const longest = Math.max(width, height, 1);
    const scale = Math.min(1, cap / longest);
    fitBloom(
      Math.max(2, Math.round(width * scale)),
      Math.max(2, Math.round(height * scale)),
    );
  };
  composer.addPass(bloom);
  composer.addPass(new ShaderPass(filmGradeMaterial()));
  const size = new Vector2();
  renderer.getSize(size);
  composer.setSize(size.x, size.y);
  return composer;
}
