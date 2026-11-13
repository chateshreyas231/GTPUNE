import * as THREE from "three";

const people = [];
const lamps = [];
const windowMaterials = [];
let skyMesh = null;
let streetScene = null;
let contactTarget = null;
let contactBlurTarget = null;
let contactCamera = null;
let contactPlane = null;
let contactBlur = null;
let blurScene = null;
let blurCamera = null;
const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

function speckle(g, w, h, seed, alpha) {
  for (let i = 0; i < 700; i += 1) {
    const n = Math.sin((seed + i) * 127.1) * 43758.5453;
    const r = n - Math.floor(n);
    const m = Math.sin((seed + i) * 311.7) * 43758.5453;
    const s = m - Math.floor(m);
    g.fillStyle = `rgba(30, 24, 16, ${alpha * s})`;
    g.fillRect((r * w) | 0, (((n * 17) % 1) * h) | 0, 2, 2);
  }
}

function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

function paintNoise(base, seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, seed, 0.18);
  return canvasTexture(canvas, 1, 1);
}

const plasterMap = paintNoise("#e6d7c3", 2);
const stoneMap = paintNoise("#cbb89a", 5);
const concreteMap = paintNoise("#b7b1a8", 8);
const asphaltMap = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  g.fillStyle = "#3c434a";
  g.fillRect(0, 0, 256, 128);
  speckle(g, 256, 128, 4, 0.2);
  g.strokeStyle = "#eceff2";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, 8);
  g.lineTo(256, 8);
  g.moveTo(0, 120);
  g.lineTo(256, 120);
  g.stroke();
  g.fillStyle = "#f7f7f5";
  g.fillRect(24, 60, 64, 7);
  g.fillRect(156, 60, 64, 7);
  return canvasTexture(canvas, 14, 1);
})();
const paverMap = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  g.fillStyle = "#c9b79a";
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      g.fillStyle = (x + y) % 2 ? "#d9c7aa" : "#b7a488";
      g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
    }
  }
  return canvasTexture(canvas, 8, 2);
})();

function repeated(map, rx, ry) {
  const clone = map.clone();
  clone.repeat.set(rx, ry);
  clone.needsUpdate = true;
  return clone;
}

function plaster(color) {
  return new THREE.MeshStandardMaterial({
    map: repeated(plasterMap, 2, 2),
    color,
    roughness: 0.88,
    metalness: 0.02,
  });
}

function stone(color) {
  return new THREE.MeshStandardMaterial({
    map: repeated(stoneMap, 2, 1),
    color,
    roughness: 0.8,
    metalness: 0.04,
  });
}

const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0x9ec9db,
  roughness: 0.16,
  metalness: 0.42,
  emissive: new THREE.Color("#ffd7a8"),
  emissiveIntensity: 0,
});
windowMaterials.push(glassMaterial);

const concreteMaterial = new THREE.MeshStandardMaterial({
  map: repeated(concreteMap, 1, 1),
  color: 0xd6d3d1,
  roughness: 0.94,
});

const frameMaterial = new THREE.MeshStandardMaterial({
  color: 0x3f3a36,
  roughness: 0.45,
  metalness: 0.25,
});

function markCaster(object) {
  object.layers.enable(1);
  object.traverse((child) => child.layers.enable(1));
}

function addMesh(geometry, material, x, y, z, rotY = 0, caster = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = caster;
  mesh.receiveShadow = true;
  if (caster) markCaster(mesh);
  streetScene.add(mesh);
  return mesh;
}

function extrudeFootprint(width, depth, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -depth / 2);
  shape.lineTo(width / 2, -depth / 2);
  shape.lineTo(width / 2, depth / 2);
  shape.lineTo(-width / 2, depth / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function solid(world, RAPIER, x, y, z, hx, hy, hz) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(1), body);
}

function massBuilding(scene, world, RAPIER, spec) {
  const street = spec.face === "south" ? 1 : -1;
  const shopH = spec.shopH ?? 3.35;
  const floorH = spec.floorH ?? 3.05;
  const towerH = spec.floors * floorH;
  const setback = spec.setback ?? 0.85;
  const shopZ = spec.frontZ - street * (spec.d / 2);
  const towerD = Math.max(3.2, spec.d - setback);
  const towerW = Math.max(3.4, spec.w - (spec.sideSetback ?? 0.45));
  const towerZ = spec.frontZ - street * (setback + towerD / 2);

  const shop = addMesh(
    extrudeFootprint(spec.w, spec.d, shopH),
    stone(spec.shop ?? spec.color),
    spec.x,
    0,
    shopZ,
  );
  shop.castShadow = true;
  const tower = addMesh(
    extrudeFootprint(towerW, towerD, towerH),
    plaster(spec.color),
    spec.x,
    shopH,
    towerZ,
  );
  tower.castShadow = true;

  const cornice = addMesh(
    new THREE.BoxGeometry(spec.w + 0.18, 0.22, spec.d * 0.28),
    concreteMaterial,
    spec.x,
    shopH,
    spec.frontZ - street * 0.12,
  );
  cornice.castShadow = true;

  const parapet = addMesh(
    new THREE.BoxGeometry(towerW + 0.12, 0.45, towerD + 0.12),
    plaster(spec.color),
    spec.x,
    shopH + towerH,
    towerZ,
  );
  parapet.castShadow = true;

  if (spec.tank) {
    const tank = addMesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.55, metalness: 0.35 }),
      spec.x + towerW * 0.22,
      shopH + towerH + 0.7,
      towerZ,
    );
    tank.castShadow = true;
  }

  const bays = Math.max(2, Math.round(spec.w / 2.15));
  const faceZ = spec.frontZ - street * (setback - 0.02);
  for (let floor = 0; floor < spec.floors; floor += 1) {
    for (let bay = 0; bay < bays; bay += 1) {
      const x = spec.x - towerW / 2 + ((bay + 0.5) * towerW) / bays;
      const y = shopH + floor * floorH + floorH * 0.42;
      const recess = addMesh(
        new THREE.BoxGeometry(0.72, 1.15, 0.12),
        frameMaterial,
        x,
        y,
        faceZ,
      );
      recess.castShadow = false;
      const pane = addMesh(
        new THREE.BoxGeometry(0.56, 0.98, 0.05),
        glassMaterial,
        x,
        y,
        faceZ + street * 0.05,
      );
      pane.castShadow = false;
    }
    if (floor % 2 === 1) {
      const slabZ = faceZ + street * 0.48;
      const slab = addMesh(
        new THREE.BoxGeometry(towerW * 0.72, 0.1, 0.9),
        concreteMaterial,
        spec.x,
        shopH + floor * floorH,
        slabZ,
      );
      slab.castShadow = true;
      const rail = addMesh(
        new THREE.BoxGeometry(towerW * 0.72, 0.08, 0.06),
        frameMaterial,
        spec.x,
        shopH + floor * floorH + 0.55,
        slabZ + street * 0.4,
      );
      rail.castShadow = false;
    }
  }

  const shopGlassZ = spec.frontZ + street * 0.04;
  const panes = spec.books ? 2 : 3;
  for (let i = 0; i < panes; i += 1) {
    const x = spec.x - spec.w * 0.28 + (i * spec.w * 0.28);
    addMesh(
      new THREE.BoxGeometry(spec.w * 0.22, 1.7, 0.06),
      glassMaterial,
      x,
      1.35,
      shopGlassZ,
      0,
      false,
    );
  }

  if (spec.awning !== false) {
    const awning = addMesh(
      new THREE.BoxGeometry(spec.w * 0.92, 0.07, 1.25),
      new THREE.MeshStandardMaterial({ color: spec.awningColor ?? 0xc2410c, roughness: 0.72 }),
      spec.x,
      shopH - 0.25,
      spec.frontZ + street * 0.55,
    );
    awning.rotation.x = street > 0 ? -0.18 : 0.18;
  }

  if (spec.sign) {
    const board = document.createElement("canvas");
    board.width = 512;
    board.height = 128;
    const g = board.getContext("2d");
    g.fillStyle = spec.signBg ?? "#1c1917";
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = spec.signInk ?? "#f8fafc";
    g.font = "bold 64px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(spec.sign, 256, 64);
    const sign = addMesh(
      new THREE.PlaneGeometry(Math.min(spec.w * 0.7, 4.2), 0.7),
      new THREE.MeshStandardMaterial({ map: canvasTexture(board), roughness: 0.6 }),
      spec.x,
      shopH - 0.85,
      spec.frontZ + street * 0.08,
      street > 0 ? 0 : Math.PI,
      false,
    );
    sign.castShadow = false;
  }

  if (spec.books) {
    for (let i = 0; i < 6; i += 1) {
      addMesh(
        new THREE.BoxGeometry(0.12, 0.7, 0.08),
        new THREE.MeshStandardMaterial({
          color: [0x9a3412, 0x1e3a5f, 0xb45309, 0x365314, 0x7f1d1d, 0x44403c][i],
          roughness: 0.7,
        }),
        spec.x - 0.7 + i * 0.22,
        1.15,
        shopGlassZ + street * 0.02,
        0,
        false,
      );
    }
  }

  const totalH = shopH + towerH;
  solid(world, RAPIER, spec.x, totalH / 2, shopZ, spec.w / 2, totalH / 2, spec.d / 2);
}

function makeTree(x, z) {
  const trunk = addMesh(
    new THREE.CylinderGeometry(0.14, 0.2, 2.1, 7),
    new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.9 }),
    x,
    1.05,
    z,
  );
  trunk.castShadow = true;
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f6a38, roughness: 0.86 });
  const leafB = new THREE.MeshStandardMaterial({ color: 0x3d7c46, roughness: 0.84 });
  addMesh(new THREE.SphereGeometry(1.05, 10, 8), leaf, x, 2.55, z);
  addMesh(new THREE.SphereGeometry(0.72, 8, 7), leafB, x + 0.55, 2.85, z + 0.15);
  addMesh(new THREE.SphereGeometry(0.62, 8, 7), leafB, x - 0.48, 2.7, z - 0.1);
  const body = streetScene.userData.world.createRigidBody(
    streetScene.userData.RAPIER.RigidBodyDesc.fixed().setTranslation(x, 1.05, z),
  );
  streetScene.userData.world.createCollider(
    streetScene.userData.RAPIER.ColliderDesc.cylinder(1.05, 0.18),
    body,
  );
}

function makeLamp(x, z) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.4, metalness: 0.4 });
  addMesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 7), metal, x, 2.3, z);
  const head = addMesh(
    new THREE.BoxGeometry(0.62, 0.1, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xf8e7c0, emissive: 0x000000, roughness: 0.35 }),
    x,
    4.55,
    z,
  );
  const light = new THREE.PointLight(0xffc56b, 0, 26, 1.5);
  light.position.set(x, 4.3, z);
  streetScene.add(light);
  lamps.push({ head, light });
  const body = streetScene.userData.world.createRigidBody(
    streetScene.userData.RAPIER.RigidBodyDesc.fixed().setTranslation(x, 2.3, z),
  );
  streetScene.userData.world.createCollider(
    streetScene.userData.RAPIER.ColliderDesc.cylinder(2.3, 0.08),
    body,
  );
}

function makeBike(x, z) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.38, metalness: 0.5 });
  const wheel = new THREE.TorusGeometry(0.3, 0.02, 6, 16);
  for (const offset of [0.55, -0.42]) {
    const mesh = addMesh(wheel, metal, x + offset, 0.3, z);
    mesh.rotation.y = Math.PI / 2;
  }
  const frame = addMesh(new THREE.BoxGeometry(0.9, 0.04, 0.04), metal, x + 0.05, 0.5, z);
  frame.rotation.z = -0.32;
  addMesh(
    new THREE.BoxGeometry(0.28, 0.05, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 }),
    x - 0.2,
    0.7,
    z,
  );
  addMesh(new THREE.BoxGeometry(0.04, 0.04, 0.38), metal, x + 0.46, 0.78, z);
}

function makeFigure(x, z, shirt, pants, yaw, phase) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc48a62, roughness: 0.7 });
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.5, 0.16),
    new THREE.MeshStandardMaterial({ color: pants, roughness: 0.86 }),
  );
  legs.position.y = 0.3;
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.46, 0.18),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 }),
  );
  torso.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin);
  head.position.y = 1.16;
  group.add(legs, torso, head);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  markCaster(group);
  group.position.set(x, 0.18, z);
  group.rotation.y = yaw;
  streetScene.add(group);
  people.push({ group, phase, base: 0.18 });
}

function makeSignal(x, z) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.45, metalness: 0.35 });
  addMesh(new THREE.CylinderGeometry(0.07, 0.09, 4.1, 8), metal, x, 2.05, z);
  addMesh(new THREE.BoxGeometry(0.32, 0.95, 0.24), metal, x, 3.55, z);
  [0xb91c1c, 0xf59e0b, 0x15803d].forEach((color, index) => {
    const lamp = addMesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: index === 0 ? 0.85 : 0.08,
        roughness: 0.35,
      }),
      x,
      3.85 - index * 0.28,
      z + 0.12,
      0,
      false,
    );
    lamp.castShadow = false;
  });
  const body = streetScene.userData.world.createRigidBody(
    streetScene.userData.RAPIER.RigidBodyDesc.fixed().setTranslation(x, 2, z),
  );
  streetScene.userData.world.createCollider(
    streetScene.userData.RAPIER.ColliderDesc.cylinder(2, 0.1),
    body,
  );
}

function chaiStall() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.78 });
  addMesh(extrudeFootprint(2.2, 0.85, 1.05), wood, -6, 0.18, 7.2);
  const awningCanvas = document.createElement("canvas");
  awningCanvas.width = 128;
  awningCanvas.height = 32;
  const g = awningCanvas.getContext("2d");
  for (let i = 0; i < 8; i += 1) {
    g.fillStyle = i % 2 ? "#e07a2f" : "#f6e7c1";
    g.fillRect(i * 16, 0, 16, 32);
  }
  const awning = addMesh(
    new THREE.BoxGeometry(2.4, 0.06, 1.2),
    new THREE.MeshStandardMaterial({ map: canvasTexture(awningCanvas), roughness: 0.68 }),
    -6,
    2.05,
    6.7,
  );
  awning.rotation.x = 0.2;
  const kettle = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, metalness: 0.7, roughness: 0.25 });
  addMesh(new THREE.SphereGeometry(0.16, 12, 8), kettle, -5.3, 1.4, 6.95);
  addMesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 8), kettle, -5.12, 1.45, 6.95);
  const cup = new THREE.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.35 });
  for (let i = 0; i < 4; i += 1) {
    addMesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 8), cup, -6.55 + i * 0.13, 1.32, 6.9);
  }
  const board = document.createElement("canvas");
  board.width = 256;
  board.height = 96;
  const bg = board.getContext("2d");
  bg.fillStyle = "#9a3412";
  bg.fillRect(0, 0, 256, 96);
  bg.fillStyle = "#f6e7c1";
  bg.font = "bold 54px sans-serif";
  bg.textAlign = "center";
  bg.textBaseline = "middle";
  bg.fillText("CHAI", 128, 48);
  addMesh(
    new THREE.PlaneGeometry(1.35, 0.5),
    new THREE.MeshStandardMaterial({ map: canvasTexture(board), roughness: 0.55 }),
    -6,
    2.45,
    6.5,
    Math.PI,
    false,
  );
  solid(streetScene.userData.world, streetScene.userData.RAPIER, -6, 0.7, 7.2, 1.1, 0.55, 0.42);
}

function skyCanvas(night, rain) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  if (night) {
    grad.addColorStop(0, "#070b14");
    grad.addColorStop(0.5, "#1a2744");
    grad.addColorStop(1, "#2c261e");
  } else if (rain) {
    grad.addColorStop(0, "#667481");
    grad.addColorStop(1, "#a3a8ad");
  } else {
    grad.addColorStop(0, "#6eafe6");
    grad.addColorStop(0.45, "#c5ddf3");
    grad.addColorStop(0.78, "#f3e0c4");
    grad.addColorStop(1, "#e7d3b0");
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  if (night) {
    g.fillStyle = "#f8fafc";
    for (let i = 0; i < 24; i += 1) {
      const n = Math.sin(i * 91.7) * 43758.5453;
      g.fillRect((n - Math.floor(n)) * 16, ((n * 3) % 1) * 140, 1, 1);
    }
  }
  return canvasTexture(canvas);
}

function setupContact() {
  contactTarget = new THREE.WebGLRenderTarget(1024, 1024);
  contactTarget.texture.generateMipmaps = false;
  contactTarget.texture.minFilter = THREE.LinearFilter;
  contactTarget.texture.magFilter = THREE.LinearFilter;
  contactBlurTarget = contactTarget.clone();
  contactCamera = new THREE.OrthographicCamera(-46, 46, 46, -46, 1, 48);
  contactCamera.position.set(0, 30, 0);
  contactCamera.up.set(0, 0, -1);
  contactCamera.lookAt(0, 0, 0);
  contactCamera.layers.set(1);
  contactBlur = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      dir: { value: new THREE.Vector2(1.4 / 1024, 0) },
    },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      precision highp float;
      uniform sampler2D tDiffuse;
      uniform vec2 dir;
      varying vec2 vUv;
      void main() {
        vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
        sum += texture2D(tDiffuse, vUv + dir) * 0.1945946;
        sum += texture2D(tDiffuse, vUv - dir) * 0.1945946;
        sum += texture2D(tDiffuse, vUv + dir * 2.0) * 0.1216216;
        sum += texture2D(tDiffuse, vUv - dir * 2.0) * 0.1216216;
        sum += texture2D(tDiffuse, vUv + dir * 3.0) * 0.054054;
        sum += texture2D(tDiffuse, vUv - dir * 3.0) * 0.054054;
        gl_FragColor = sum;
      }
    `,
  });
  blurScene = new THREE.Scene();
  blurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), contactBlur));
  blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  contactPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(92, 92),
    new THREE.MeshBasicMaterial({
      map: contactTarget.texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.5,
    }),
  );
  contactPlane.rotation.x = -Math.PI / 2;
  contactPlane.position.y = 0.07;
  contactPlane.renderOrder = 2;
  streetScene.add(contactPlane);
}

function sidewalk(world, RAPIER, x, z, hx) {
  const mesh = addMesh(
    new THREE.BoxGeometry(hx * 2, 0.18, 4.1),
    new THREE.MeshStandardMaterial({ map: paverMap, roughness: 0.92, metalness: 0 }),
    x,
    0.09,
    z,
    0,
    false,
  );
  mesh.receiveShadow = true;
  solid(world, RAPIER, x, 0.09, z, hx, 0.09, 2.05);
  const curbZ = z > 0 ? z - 2.12 : z + 2.12;
  addMesh(
    new THREE.BoxGeometry(hx * 2, 0.22, 0.18),
    new THREE.MeshStandardMaterial({ map: concreteMap, roughness: 0.9 }),
    x,
    0.11,
    curbZ,
    0,
    false,
  );
}

export function buildStreet(scene, world, RAPIER) {
  streetScene = scene;
  scene.userData.world = world;
  scene.userData.RAPIER = RAPIER;

  const earth = addMesh(
    new THREE.BoxGeometry(160, 1, 160),
    new THREE.MeshStandardMaterial({ map: repeated(stoneMap, 10, 10), color: 0xc4ae86, roughness: 0.95 }),
    0,
    -0.5,
    0,
    0,
    false,
  );
  earth.receiveShadow = true;
  solid(world, RAPIER, 0, -0.5, 0, 80, 0.5, 80);

  const road = addMesh(
    new THREE.BoxGeometry(86, 0.04, 8.2),
    new THREE.MeshStandardMaterial({ map: asphaltMap, roughness: 0.96, metalness: 0.02 }),
    0,
    0.02,
    0,
    0,
    false,
  );
  road.receiveShadow = true;
  const cross = addMesh(
    new THREE.BoxGeometry(8.4, 0.05, 46),
    new THREE.MeshStandardMaterial({
      map: repeated(asphaltMap, 1, 6),
      roughness: 0.96,
    }),
    18,
    0.03,
    0,
    0,
    false,
  );
  cross.receiveShadow = true;

  const zebra = document.createElement("canvas");
  zebra.width = 128;
  zebra.height = 32;
  const zg = zebra.getContext("2d");
  zg.fillStyle = "#f4f4f2";
  for (let i = 0; i < 4; i += 1) zg.fillRect(6 + i * 32, 2, 16, 28);
  const zebraMat = new THREE.MeshBasicMaterial({ map: canvasTexture(zebra), transparent: true, depthWrite: false });
  const crossing = addMesh(new THREE.PlaneGeometry(7.4, 3.4), zebraMat, 18, 0.06, 0, 0, false);
  crossing.rotation.x = -Math.PI / 2;
  crossing.castShadow = false;

  sidewalk(world, RAPIER, -12, -6.25, 24);
  sidewalk(world, RAPIER, 32, -6.25, 8);
  sidewalk(world, RAPIER, -12, 6.25, 24);
  sidewalk(world, RAPIER, 32, 6.25, 8);

  const north = [
    { x: -30.4, w: 5.2, d: 6.2, floors: 3, color: 0xd7c4a6, shop: 0xc4b094, tank: true },
    { x: -23.9, w: 6.4, d: 7.1, floors: 4, color: 0xe7d3b4, shop: 0xb08968, awningColor: 0x9a3412 },
    { x: -16, w: 8, d: 7.4, floors: 5, color: 0xf0e2cc, shop: 0xd6c4a8, sign: "COLLEGE STRIP", signBg: "#f3e6c8", signInk: "#3f3428", awningColor: 0xc4b49a, tank: true, floorH: 3.2 },
    { x: -8.8, w: 5, d: 6.1, floors: 2, color: 0xe4c8a4, shop: 0xa16207, awningColor: 0xb45309 },
    { x: -2.8, w: 5.4, d: 6.5, floors: 3, color: 0xdcc7a8, shop: 0x78716c, tank: true },
    { x: 10.1, w: 5, d: 6.4, floors: 4, color: 0xe8d5bc, shop: 0x57534e, awningColor: 0x1e3a5f },
    { x: 27.5, w: 8, d: 7.2, floors: 5, color: 0xd8c3a4, shop: 0x92400e, tank: true },
    { x: 35.2, w: 5.2, d: 6.2, floors: 2, color: 0xead9c0, shop: 0x44403c },
  ];
  for (const block of north) {
    massBuilding(scene, world, RAPIER, { ...block, face: "south", frontZ: -8.6 });
  }

  const south = [
    { x: -27.4, w: 5.2, d: 6.4, floors: 3, color: 0xe6d2b6, shop: 0xa8a29e, awningColor: 0xb45309 },
    { x: -21.2, w: 6, d: 6.8, floors: 4, color: 0xf1e0c8, shop: 0x9a3412, tank: true },
    { x: -14.4, w: 6.2, d: 6.2, floors: 2, color: 0xdcc6a6, shop: 0x78716c },
    { x: -8, w: 5, d: 6, floors: 3, color: 0xe8d4b8, shop: 0x44403c, awningColor: 0xc2410c },
    { x: -1.8, w: 6, d: 6.6, floors: 4, color: 0xf3e4cc, shop: 0x57534e, tank: true },
    { x: 4.6, w: 5.4, d: 6.3, floors: 2, color: 0xe7d5bc, shop: 0x78716c, awningColor: 0xb45309 },
    { x: 10.4, w: 5, d: 6.4, floors: 3, color: 0xf8f1e4, shop: 0x1e3a5f, books: true, sign: "BOOKS", signBg: "#1e3a5f", signInk: "#f8fafc", awningColor: 0x1e3a5f },
    { x: 28.2, w: 7.2, d: 7, floors: 4, color: 0xd9c4a6, shop: 0x7c2d12, tank: true },
    { x: 35.4, w: 5, d: 6.1, floors: 3, color: 0xead8be, shop: 0x44403c },
  ];
  for (const block of south) {
    massBuilding(scene, world, RAPIER, { ...block, face: "north", frontZ: 8.6 });
  }

  chaiStall();

  for (const [x, z] of [[-28, -7.85], [-12, -7.8], [2, -7.75], [26, -7.8], [-20, 7.85], [-1, 7.8], [28, 7.85]]) {
    makeTree(x, z);
  }
  for (const [x, z] of [[-22, -4.45], [-8, 4.45], [4, -4.45], [12, 4.45], [26, -4.45], [26, 4.45]]) {
    makeLamp(x, z);
  }
  for (const [x, z] of [[-18, 3.45], [-9, -3.45], [3, 3.45], [14, -3.5], [24, 3.45]]) {
    makeBike(x, z);
  }
  makeSignal(13.35, -4.7);
  makeSignal(22.6, 4.7);

  makeFigure(-6.8, 7.7, 0x9a3412, 0x44403c, Math.PI, 0.2);
  makeFigure(-18.5, -5.6, 0xf5f5f4, 0x1e3a5f, 0.6, 1.1);
  makeFigure(-13.6, -5.7, 0xfde68a, 0x292524, -0.4, 2);
  makeFigure(10.2, 6.4, 0x1e3a5f, 0x44403c, Math.PI, 0.7);
  makeFigure(12.4, 5.4, 0xe7e5e4, 0x7f1d1d, 1.1, 1.6);

  skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(340, 18, 14),
    new THREE.MeshBasicMaterial({ map: skyCanvas(false, false), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  scene.add(skyMesh);
  setupContact();
}

export function renderContact(renderer) {
  if (!contactPlane || !streetScene) return;
  contactPlane.visible = false;
  const previousTarget = renderer.getRenderTarget();
  const previousShadow = renderer.shadowMap.enabled;
  const previousOverride = streetScene.overrideMaterial;
  const clear = new THREE.Color();
  renderer.getClearColor(clear);
  const alpha = renderer.getClearAlpha();
  renderer.shadowMap.enabled = false;
  streetScene.overrideMaterial = blackMaterial;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(contactTarget);
  renderer.clear();
  renderer.render(streetScene, contactCamera);
  contactBlur.uniforms.tDiffuse.value = contactTarget.texture;
  contactBlur.uniforms.dir.value.set(1.6 / 1024, 0);
  renderer.setRenderTarget(contactBlurTarget);
  renderer.clear();
  renderer.render(blurScene, blurCamera);
  contactBlur.uniforms.tDiffuse.value = contactBlurTarget.texture;
  contactBlur.uniforms.dir.value.set(0, 1.6 / 1024);
  renderer.setRenderTarget(contactTarget);
  renderer.clear();
  renderer.render(blurScene, blurCamera);
  streetScene.overrideMaterial = previousOverride;
  renderer.shadowMap.enabled = previousShadow;
  renderer.setClearColor(clear, alpha);
  renderer.setRenderTarget(previousTarget);
  contactPlane.visible = true;
}

export function markStreetCaster(object) {
  markCaster(object);
}

export function setStreetMood(night, rain) {
  if (skyMesh) skyMesh.material.map = skyCanvas(night, rain);
  for (const material of windowMaterials) material.emissiveIntensity = night ? 1.15 : 0;
  for (const lamp of lamps) {
    lamp.light.intensity = night ? 14 : 0;
    lamp.head.material.emissive.set(night ? 0xf6c56a : 0x000000);
    lamp.head.material.emissiveIntensity = night ? 1 : 0;
  }
}

export function tickStreet(time) {
  for (const person of people) {
    person.group.position.y = person.base + Math.sin(time * 0.0015 + person.phase) * 0.03;
  }
}

export function moodColors(night, rain) {
  if (night) return { sky: 0x101722, near: 22, far: 110, sun: 0.07, ambient: 0.16 };
  if (rain) return { sky: 0x7d8b96, near: 16, far: 80, sun: 0.4, ambient: 0.36 };
  return { sky: 0xc5d8ea, near: 28, far: 130, sun: 1.45, ambient: 0.48 };
}
