import * as THREE from "three";

export const WEATHER_TYPES = Object.freeze(["clear", "rain", "fog", "storm"]);
export const FESTIVAL_TYPES = Object.freeze([
  "none",
  "diwali",
  "ganpati",
  "kites",
]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

// Scene-camera zoom is separate from minimap zoom. Moving restores the follow view.
export class CameraZoomController {
  constructor({ distance = 13, min = 3, max = 30 } = {}) {
    this.min = Math.max(0.5, finite(min, 3));
    this.max = Math.max(this.min, finite(max, 30));
    this.defaultDistance = clamp(finite(distance, 13), this.min, this.max);
    this.distance = this.defaultDistance;
  }
  wheel(deltaY = 0) {
    this.distance = clamp(
      this.distance * Math.exp(clamp(finite(deltaY), -2000, 2000) * 0.0015),
      this.min,
      this.max,
    );
    return this.distance;
  }
  reset() {
    return (this.distance = this.defaultDistance);
  }
  follow(moving) {
    return moving ? this.reset() : this.distance;
  }
}

// Only named clothing materials (or an exact procedural shirt match) are tinted.
// Skin, hair, eyes and the source material shared by other residents stay intact.
export function applyOutfit(root, color) {
  if (!root?.traverse) return 0;
  const tint = new THREE.Color(color);
  const oldShirt = root.userData.shirt;
  let changed = 0;
  root.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    const list = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const replacement = list.map((material) => {
      const name = material.name || "";
      const garment =
        /shirt|vest|jacket|dress|saree|kurta|pants|trouser|clothing|\btop\b/i.test(
          name,
        );
      const procedural =
        !name &&
        Number.isInteger(oldShirt) &&
        material.color?.getHex() === oldShirt;
      if (
        (!garment && !procedural && !material.userData.puneClothing) ||
        /skin|face|hair|eye/i.test(name) ||
        !material.color
      )
        return material;
      const next = material.clone();
      next.color.copy(tint);
      if (material.userData.puneOutfitOwned) material.dispose();
      next.userData.puneOutfitOwned = true;
      changed++;
      return next;
    });
    object.material = Array.isArray(object.material)
      ? replacement
      : replacement[0];
  });
  if (changed) root.userData.shirt = tint.getHex();
  return changed;
}

const WEATHER = {
  clear: { sky: 0x8bbce0, fog: 0.0008, clouds: 0.83, rain: false },
  rain: { sky: 0x778d9d, fog: 0.0028, clouds: 0.97, rain: true },
  fog: { sky: 0xb3c2c5, fog: 0.0065, clouds: 0.35, rain: false },
  storm: { sky: 0x3f5264, fog: 0.0038, clouds: 1, rain: true },
};
const seeded = (index) => {
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};
const sphere = new THREE.SphereGeometry(1, 8, 5);

// Original, deliberately stylized environment effects. No photographic realism claim.
// All repeated effects are instanced meshes or points, keeping draw calls bounded.
export function createAtmosphere(scene, options = {}) {
  if (!scene?.add)
    throw new TypeError("createAtmosphere requires a Three.js scene");
  const effectRoot = new THREE.Group();
  effectRoot.name = "Pune sky, weather and festivals";
  scene.add(effectRoot);
  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const sky = new THREE.Color();
  const fog = new THREE.FogExp2(0x8bbce0, WEATHER.clear.fog);
  scene.background = sky;
  scene.fog = fog;
  const state = {
    weather: "clear",
    festival: "none",
    wind: 1,
    night: false,
    disposed: false,
  };
  const dummy = new THREE.Object3D();
  const center = new THREE.Vector3();
  let anchored = false;
  const festivalAnchor = new THREE.Vector3();
  let customAnchor = false;
  const rainCount = Math.min(
    1400,
    Math.max(80, Math.floor(finite(options.rainCount, 480))),
  );
  const birdCount = Math.min(
    40,
    Math.max(1, Math.floor(finite(options.birdCount, 14))),
  );

  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: 0xf5f5ed,
    transparent: true,
    opacity: 0.83,
    depthWrite: false,
  });
  const cloudGeometry = sphere.clone();
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 112);
  clouds.frustumCulled = false;
  clouds.name = "Wind-driven clouds";
  effectRoot.add(clouds);

  const birdGeometry = new THREE.BufferGeometry();
  birdGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.9, 0.2, 0, -0.15, 0, 0.12, 0, -0.06, 0, 0.9, 0.2, 0, 0, -0.06, 0,
        0.15, 0, 0.12,
      ],
      3,
    ),
  );
  const birdMaterial = new THREE.MeshBasicMaterial({
    color: 0x28313a,
    side: THREE.DoubleSide,
  });
  const birds = new THREE.InstancedMesh(birdGeometry, birdMaterial, birdCount);
  birds.frustumCulled = false;
  birds.name = "Flying birds";
  effectRoot.add(birds);

  const rainPositions = new Float32Array(rainCount * 6);
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(rainPositions, 3),
  );
  const rainMaterial = new THREE.LineBasicMaterial({
    color: 0xc0d7e9,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  rain.name = "Local rain";
  effectRoot.add(rain);

  const litterGeometry = new THREE.PlaneGeometry(0.18, 0.22);
  const litterMaterial = new THREE.MeshStandardMaterial({
    color: 0xcec3a7,
    side: THREE.DoubleSide,
    roughness: 1,
  });
  const litter = new THREE.InstancedMesh(litterGeometry, litterMaterial, 36);
  litter.frustumCulled = false;
  litter.name = "Windblown paper litter";
  const scraps = Array.from({ length: 36 }, (_, index) => ({
    x: (seeded(index + 10) - 0.5) * 100,
    z: (seeded(index + 90) - 0.5) * 100,
    phase: seeded(index + 160) * Math.PI * 2,
  }));
  effectRoot.add(litter);

  const festivalRoot = new THREE.Group();
  festivalRoot.name = "Original festival decorations";
  effectRoot.add(festivalRoot);
  const kiteGeometry = new THREE.PlaneGeometry(1.3, 1.3);
  const kiteMaterial = new THREE.MeshBasicMaterial({
    color: 0xf3b537,
    side: THREE.DoubleSide,
  });
  const kites = new THREE.InstancedMesh(kiteGeometry, kiteMaterial, 14);
  kites.name = "Festival kites";
  kites.frustumCulled = false;
  for (let i = 0; i < 14; i++)
    kites.setColorAt(i, new THREE.Color().setHSL(seeded(i + 710), 0.8, 0.58));
  festivalRoot.add(kites);

  const fireworksCount = 180;
  const firePositions = new Float32Array(fireworksCount * 3);
  const fireColors = new Float32Array(fireworksCount * 3);
  const fireGeometry = new THREE.BufferGeometry();
  fireGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(firePositions, 3),
  );
  fireGeometry.setAttribute("color", new THREE.BufferAttribute(fireColors, 3));
  const fireMaterial = new THREE.PointsMaterial({
    size: 0.32,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const fireworks = new THREE.Points(fireGeometry, fireMaterial);
  fireworks.name = "Stylized Diwali fireworks";
  fireworks.frustumCulled = false;
  festivalRoot.add(fireworks);

  const garlandMaterial = new THREE.MeshStandardMaterial({
    color: 0xe6a432,
    roughness: 0.9,
    emissive: 0x402006,
  });
  const redMaterial = new THREE.MeshStandardMaterial({
    color: 0xad332d,
    roughness: 0.8,
  });
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9ac52,
    metalness: 0.35,
    roughness: 0.45,
  });
  const mandap = new THREE.Group();
  mandap.name = "Stylized Ganpati festival mandap";
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mandap.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(5, 0.3, 3.6), redMaterial, 0, 0.15, 0);
  for (const x of [-2.2, 2.2])
    for (const z of [-1.4, 1.4])
      add(
        new THREE.CylinderGeometry(0.12, 0.12, 3.4, 8),
        garlandMaterial,
        x,
        1.8,
        z,
      );
  add(new THREE.ConeGeometry(3.7, 1.5, 4), redMaterial, 0, 4.2, 0).rotation.y =
    Math.PI / 4;
  // A small original elephant-headed decorative silhouette, not a scanned idol.
  add(new THREE.SphereGeometry(0.45, 12, 8), goldMaterial, 0, 2.05, 0.05);
  for (const x of [-0.5, 0.5])
    add(
      new THREE.SphereGeometry(0.38, 10, 7),
      goldMaterial,
      x,
      2.1,
      0.05,
    ).scale.set(0.5, 1, 0.8);
  add(
    new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8),
    goldMaterial,
    0,
    1.65,
    0.34,
  ).rotation.x = -0.25;
  add(new THREE.SphereGeometry(0.55, 12, 8), goldMaterial, 0, 1.2, 0).scale.y =
    1.1;
  festivalRoot.add(mandap);

  const lights = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.085, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd57f }),
    45,
  );
  lights.name = "Festival string lamps";
  for (let i = 0; i < 45; i++) {
    const t = i / 44;
    dummy.position.set(-10 + t * 20, 4.8 - Math.sin(t * Math.PI) * 0.9, 0);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    lights.setMatrixAt(i, dummy.matrix);
  }
  festivalRoot.add(lights);

  function applyEnvironment() {
    const weather = WEATHER[state.weather];
    sky.setHex(
      state.night
        ? state.weather === "storm"
          ? 0x101b2d
          : 0x15283e
        : weather.sky,
    );
    fog.color.copy(sky);
    fog.density = weather.fog * (state.night ? 1.25 : 1);
    cloudMaterial.color.setHex(
      state.night ? 0x4c6078 : state.weather === "clear" ? 0xf5f5ed : 0xa6b3bc,
    );
    cloudMaterial.opacity = weather.clouds;
    rain.visible = weather.rain;
    birds.visible = state.weather !== "storm" && !state.night;
    kites.visible = state.festival === "kites";
    fireworks.visible = state.festival === "diwali";
    mandap.visible = state.festival === "ganpati";
    lights.visible =
      state.festival === "ganpati" || state.festival === "diwali";
  }
  function setWeather(weather) {
    const value = String(weather).toLowerCase();
    if (!WEATHER_TYPES.includes(value)) return false;
    state.weather = value;
    applyEnvironment();
    return true;
  }
  function setFestival(festival, anchor) {
    const value = String(festival).toLowerCase();
    if (!FESTIVAL_TYPES.includes(value)) return false;
    state.festival = value;
    if (anchor) {
      festivalAnchor.set(
        finite(anchor.x ?? anchor[0]),
        finite(anchor.y ?? anchor[1]),
        finite(anchor.z ?? anchor[2]),
      );
      customAnchor = true;
    } else if (anchored) festivalAnchor.set(center.x + 10, 0, center.z - 15);
    applyEnvironment();
    return true;
  }
  function setWind(strength = 1) {
    state.wind = clamp(finite(strength, 1), -3, 3);
    return state.wind;
  }
  function setNight(night) {
    state.night = Boolean(night);
    applyEnvironment();
    return state.night;
  }
  function update(dt = 0, elapsed = 0, playerPosition = center) {
    if (state.disposed) return;
    dt = clamp(finite(dt), 0, 0.2);
    elapsed = finite(elapsed);
    const x = finite(playerPosition?.x ?? playerPosition?.[0]);
    const z = finite(
      playerPosition?.z ?? playerPosition?.[2] ?? playerPosition?.[1],
    );
    center.set(x, 0, z);
    if (!anchored) {
      anchored = true;
      if (!customAnchor) festivalAnchor.set(x + 10, 0, z - 15);
      for (const scrap of scraps) {
        scrap.x += x;
        scrap.z += z;
      }
    }
    for (let i = 0; i < 112; i++) {
      const cluster = Math.floor(i / 7),
        puff = i % 7;
      const drift =
        ((((seeded(cluster + 20) * 1000 + elapsed * state.wind * 1.8) % 1000) +
          1000) %
          1000) -
        500;
      dummy.position.set(
        x + drift + Math.cos(puff * 2.4) * 15,
        105 + seeded(cluster + 80) * 70 + Math.sin(puff) * 5,
        z + (seeded(cluster + 200) - 0.5) * 1000 + Math.sin(puff * 2.4) * 18,
      );
      dummy.scale.set(
        26 + seeded(i + 900) * 15,
        7 + seeded(i + 1200) * 5,
        16 + seeded(i + 1500) * 15,
      );
      dummy.rotation.set(0, seeded(i) * Math.PI, 0);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < birdCount; i++) {
      const angle = elapsed * (0.055 + seeded(i + 41) * 0.05) + i * 2.4;
      const radius = 38 + seeded(i + 150) * 95;
      dummy.position.set(
        x + Math.cos(angle) * radius,
        19 + seeded(i + 19) * 27 + Math.sin(elapsed * 0.4 + i) * 2,
        z + Math.sin(angle) * radius,
      );
      dummy.scale.set(1, 0.25 + Math.abs(Math.sin(elapsed * 5 + i)) * 0.85, 1);
      dummy.rotation.set(-0.2, -angle, Math.sin(elapsed * 5 + i) * 0.15);
      dummy.updateMatrix();
      birds.setMatrixAt(i, dummy.matrix);
    }
    birds.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < rainCount; i++) {
      const rx = x + (seeded(i + 3000) - 0.5) * 90,
        rz = z + (seeded(i + 5000) - 0.5) * 90;
      const y =
        1 +
        ((((seeded(i + 7000) * 35 -
          elapsed * (state.weather === "storm" ? 23 : 16)) %
          35) +
          35) %
          35);
      rainPositions.set(
        [rx, y, rz, rx - state.wind * 0.18, y + 0.85, rz + 0.08],
        i * 6,
      );
    }
    rainGeometry.attributes.position.needsUpdate = true;
    for (let i = 0; i < scraps.length; i++) {
      const scrap = scraps[i];
      scrap.x += dt * state.wind * 0.2;
      if (Math.abs(scrap.x - x) > 85 || Math.abs(scrap.z - z) > 85) {
        scrap.x = x + (seeded(i + Math.floor(elapsed) + 20) - 0.5) * 130;
        scrap.z = z + (seeded(i + Math.floor(elapsed) + 60) - 0.5) * 130;
      }
      dummy.position.set(
        scrap.x,
        0.06 +
          Math.abs(Math.sin(elapsed + scrap.phase)) *
            Math.abs(state.wind) *
            0.04,
        scrap.z,
      );
      dummy.scale.setScalar(0.75 + seeded(i + 44));
      dummy.rotation.set(
        -Math.PI / 2 + Math.sin(elapsed * 2 + scrap.phase) * 0.16 * state.wind,
        0,
        scrap.phase + Math.sin(elapsed + i) * 0.1 * state.wind,
      );
      dummy.updateMatrix();
      litter.setMatrixAt(i, dummy.matrix);
    }
    litter.instanceMatrix.needsUpdate = true;
    festivalRoot.position.copy(festivalAnchor);
    for (let i = 0; i < 14; i++) {
      dummy.position.set(
        (seeded(i + 190) - 0.5) * 80,
        15 + seeded(i + 240) * 20 + Math.sin(elapsed * 0.7 + i),
        (seeded(i + 390) - 0.5) * 80,
      );
      dummy.rotation.set(
        0.1,
        Math.sin(elapsed * 0.3 + i) * 0.4,
        Math.PI / 4 + Math.sin(elapsed * 2 + i) * 0.12 * state.wind,
      );
      dummy.scale.setScalar(0.7 + seeded(i + 13));
      dummy.updateMatrix();
      kites.setMatrixAt(i, dummy.matrix);
    }
    kites.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < fireworksCount; i++) {
      const burst = Math.floor(i / 60),
        particle = i % 60;
      const age = (((elapsed + burst * 1.7) % 5) + 5) % 5;
      const azimuth = particle * 2.39996,
        vertical = (seeded(i + 2400) - 0.5) * 2;
      const radius = Math.min(age, 2.6) * (2.5 + seeded(i + 2600) * 2);
      firePositions.set(
        [
          Math.cos(azimuth) * radius + burst * 12 - 12,
          23 + burst * 6 + vertical * radius - age * age * 0.5,
          Math.sin(azimuth) * radius - 18,
        ],
        i * 3,
      );
      const color = new THREE.Color().setHSL(
        (burst * 0.27 + 0.08) % 1,
        0.85,
        age < 2.7 ? 0.7 : 0.08,
      );
      fireColors.set([color.r, color.g, color.b], i * 3);
    }
    fireGeometry.attributes.position.needsUpdate = true;
    fireGeometry.attributes.color.needsUpdate = true;
  }
  function dispose() {
    if (state.disposed) return;
    state.disposed = true;
    scene.remove(effectRoot);
    const geometries = new Set(),
      materials = new Set();
    effectRoot.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material)
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material])
          materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    if (scene.background === sky) scene.background = previousBackground;
    if (scene.fog === fog) scene.fog = previousFog;
  }
  setWeather(options.weather || "clear");
  setFestival(options.festival || "none", options.festivalAnchor);
  setWind(options.wind ?? 1);
  setNight(options.night ?? false);
  update(0, 0, options.position || center);
  return {
    update,
    setWeather,
    setFestival,
    setWind,
    setNight,
    applyOutfit,
    dispose,
    root: effectRoot,
    get state() {
      return { ...state };
    },
  };
}
