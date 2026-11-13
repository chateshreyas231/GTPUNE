import * as THREE from "three";

const people = [];
const lamps = [];
const windowMaterials = [];
let skyMesh = null;

function speckle(g, w, h, seed, alpha = 0.08) {
  for (let i = 0; i < 900; i += 1) {
    const n = Math.sin((seed + i) * 127.1) * 43758.5453;
    const r = n - Math.floor(n);
    const m = Math.sin((seed + i) * 311.7) * 43758.5453;
    const s = m - Math.floor(m);
    g.fillStyle = `rgba(40, 30, 20, ${alpha * s})`;
    g.fillRect(r * w, ((n * 13) % 1) * h, 2, 2);
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

function paintAsphalt() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  g.fillStyle = "#3a4148";
  g.fillRect(0, 0, 256, 128);
  speckle(g, 256, 128, 4, 0.16);
  g.strokeStyle = "#d5d8dc";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 6);
  g.lineTo(256, 6);
  g.moveTo(0, 122);
  g.lineTo(256, 122);
  g.stroke();
  g.fillStyle = "#f4f6f8";
  g.fillRect(18, 60, 70, 6);
  g.fillRect(150, 60, 70, 6);
  return canvasTexture(canvas, 16, 1);
}

function paintCrossRoad() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  g.fillStyle = "#3a4148";
  g.fillRect(0, 0, 128, 256);
  speckle(g, 128, 256, 9, 0.14);
  g.strokeStyle = "#d5d8dc";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(6, 0);
  g.lineTo(6, 256);
  g.moveTo(122, 0);
  g.lineTo(122, 256);
  g.stroke();
  g.fillStyle = "#f4f6f8";
  g.fillRect(60, 20, 6, 70);
  g.fillRect(60, 150, 6, 70);
  return canvasTexture(canvas, 1, 6);
}

function paintPavers() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  g.fillStyle = "#cbb89a";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const shift = y % 2 ? 32 : 0;
      g.fillStyle = ((x + y) % 2) ? "#d8c7a8" : "#b7a588";
      g.fillRect(x * 64 + shift - 32, y * 64 + 2, 60, 58);
    }
  }
  speckle(g, 256, 256, 2, 0.07);
  return canvasTexture(canvas, 6, 1);
}

function paintEarth() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  g.fillStyle = "#c4ae86";
  g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 6, 0.12);
  return canvasTexture(canvas, 12, 12);
}

function paintZebra() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, 128, 64);
  g.fillStyle = "#f7f7f5";
  for (let i = 0; i < 4; i += 1) g.fillRect(8 + i * 32, 4, 16, 56);
  const texture = canvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function pane(g, glow, x, y, w, h, glass, frame) {
  g.fillStyle = frame;
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = glass;
  g.fillRect(x, y, w, h);
  g.fillStyle = "rgba(255,255,255,0.22)";
  g.fillRect(x, y, w * 0.28, h);
  if (glow) {
    glow.fillStyle = "#ffd29a";
    glow.fillRect(x, y, w, h);
  }
}

function paintShutter(g, x, y, w, h, color) {
  g.fillStyle = "#2b241c";
  g.fillRect(x, y, w, h);
  g.fillStyle = color;
  for (let i = 4; i < h - 4; i += 7) g.fillRect(x + 3, y + i, w - 6, 4);
}

function paintBooks(g, x, y, w, h) {
  g.fillStyle = "#14283a";
  g.fillRect(x, y, w, h);
  const spines = ["#9a3412", "#1e3a5f", "#b45309", "#365314", "#7f1d1d", "#334155", "#a16207", "#1e293b"];
  const spine = (w - 8) / spines.length;
  spines.forEach((color, i) => {
    g.fillStyle = color;
    g.fillRect(x + 4 + i * spine, y + 6, spine - 2, h - 12);
  });
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.fillRect(x, y, w, 8);
}

function paintGate(g, x, y, w, h) {
  g.fillStyle = "#5c5146";
  g.fillRect(x, y, w * 0.12, h);
  g.fillRect(x + w * 0.88, y, w * 0.12, h);
  g.fillRect(x, y, w, h * 0.12);
  g.fillStyle = "#1c1917";
  g.fillRect(x + w * 0.16, y + h * 0.16, w * 0.68, h * 0.8);
  g.fillStyle = "#d6d3d1";
  for (let i = 0; i < 5; i += 1) g.fillRect(x + w * 0.22 + i * w * 0.12, y + h * 0.2, 2, h * 0.7);
}

function paintFacade(opts) {
  const w = opts.w ?? 512;
  const h = opts.h ?? 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = w;
  glowCanvas.height = h;
  const g = canvas.getContext("2d");
  const glow = glowCanvas.getContext("2d");
  glow.fillStyle = "#000";
  glow.fillRect(0, 0, w, h);
  g.fillStyle = opts.wall;
  g.fillRect(0, 0, w, h);
  speckle(g, w, h, opts.seed ?? 1, 0.09);
  g.fillStyle = opts.trim;
  g.fillRect(0, 0, w, 16);
  g.fillRect(0, h - 12, w, 12);

  const shopH = opts.ground ? Math.floor(h * 0.34) : 0;
  const top = 22;
  const usable = h - shopH - top - 18;
  const floors = opts.floors;
  const bays = opts.bays;
  const gapX = w / bays;
  for (let f = 0; f < floors; f += 1) {
    for (let b = 0; b < bays; b += 1) {
      const ww = gapX * 0.46;
      const hh = (usable / floors) * 0.62;
      const x = b * gapX + (gapX - ww) / 2;
      const y = top + f * (usable / floors) + 6;
      pane(g, glow, x, y, ww, hh, opts.glass, opts.frame);
    }
  }

  if (opts.ground) {
    const y0 = h - shopH;
    g.fillStyle = opts.groundWall;
    g.fillRect(0, y0, w, shopH);
    const kinds = opts.kinds ?? [];
    for (let b = 0; b < bays; b += 1) {
      const x = b * gapX + gapX * 0.08;
      const bw = gapX * 0.84;
      const kind = kinds[b] ?? "shutter";
      if (kind === "books") paintBooks(g, x, y0 + 36, bw, shopH - 52);
      else if (kind === "gate") paintGate(g, x, y0 + 10, bw, shopH - 22);
      else paintShutter(g, x, y0 + 28, bw, shopH - 44, kind === "blue" ? "#1e3a5f" : "#9a3412");
    }
  }

  if (opts.caption) {
    g.fillStyle = opts.captionBg;
    g.fillRect(w * 0.28, 24, w * 0.44, 42);
    g.fillStyle = opts.captionInk;
    g.font = "bold 28px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(opts.caption, w / 2, 46);
  }

  return {
    map: canvasTexture(canvas),
    emissiveMap: canvasTexture(glowCanvas),
  };
}

function std(map, extra = {}) {
  return new THREE.MeshStandardMaterial({ map, roughness: 0.86, metalness: 0, ...extra });
}

function frontMaterial(painted) {
  const material = new THREE.MeshStandardMaterial({
    map: painted.map,
    emissive: new THREE.Color("#ffcc88"),
    emissiveMap: painted.emissiveMap,
    emissiveIntensity: 0,
    roughness: 0.78,
  });
  windowMaterials.push(material);
  return material;
}

function addMesh(scene, geometry, material, x, y, z, rotY = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function solid(world, RAPIER, x, y, z, hx, hy, hz) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(1), body);
}

function building(scene, world, RAPIER, spec) {
  const front = frontMaterial(spec.front);
  const side = std(spec.side.map, { roughness: 0.9 });
  const roof = std(spec.roof);
  const materials = spec.face === "south"
    ? [side, side, roof, roof, front, side]
    : [side, side, roof, roof, side, front];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), materials);
  mesh.position.set(spec.x, spec.h / 2, spec.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  solid(world, RAPIER, spec.x, spec.h / 2, spec.z, spec.w / 2, spec.h / 2, spec.d / 2);
  const lip = spec.face === "south" ? spec.d / 2 : -spec.d / 2;
  addMesh(
    scene,
    new THREE.BoxGeometry(spec.w + 0.4, 0.28, 0.45),
    std(spec.roof),
    spec.x,
    spec.h + 0.08,
    spec.z + lip * 0.15,
  );
}

function makeTree(scene, world, RAPIER, x, z) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9 });
  const leafA = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.85 });
  const leafB = new THREE.MeshStandardMaterial({ color: 0x3e7d45, roughness: 0.85 });
  const trunk = addMesh(scene, new THREE.CylinderGeometry(0.12, 0.18, 1.5, 6), trunkMat, x, 0.95, z);
  trunk.castShadow = true;
  addMesh(scene, new THREE.SphereGeometry(0.85, 8, 6), leafA, x, 2.05, z);
  addMesh(scene, new THREE.SphereGeometry(0.62, 8, 6), leafB, x + 0.45, 2.35, z + 0.2);
  addMesh(scene, new THREE.SphereGeometry(0.5, 7, 6), leafB, x - 0.4, 2.25, z - 0.15);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.9, z));
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.75, 0.16), body);
}

function makeLamp(scene, world, RAPIER, x, z) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.45, metalness: 0.35 });
  addMesh(scene, new THREE.CylinderGeometry(0.05, 0.07, 4.2, 6), metal, x, 2.1, z);
  const head = addMesh(scene, new THREE.BoxGeometry(0.55, 0.12, 0.28), new THREE.MeshStandardMaterial({
    color: 0xf8e7c0,
    emissive: 0x000000,
    roughness: 0.4,
  }), x, 4.15, z);
  const light = new THREE.PointLight(0xffc56b, 0, 28, 1.4);
  light.position.set(x, 3.9, z);
  light.castShadow = false;
  scene.add(light);
  lamps.push({ head, light });
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 2.1, z));
  world.createCollider(RAPIER.ColliderDesc.cylinder(2.1, 0.07), body);
}

function makeBike(scene, x, z, yaw) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.45, roughness: 0.4 });
  const wheel = new THREE.TorusGeometry(0.28, 0.02, 6, 16);
  for (const offset of [0.52, -0.42]) {
    const mesh = new THREE.Mesh(wheel, metal);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(offset, 0.28, 0);
    mesh.castShadow = true;
    group.add(mesh);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.04), metal);
  frame.position.set(0.05, 0.46, 0);
  frame.rotation.z = -0.35;
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.05, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 }),
  );
  seat.position.set(-0.18, 0.66, 0);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.36), metal);
  bar.position.set(0.42, 0.74, 0);
  group.add(frame, seat, bar);
  group.position.set(x, 0.02, z);
  group.rotation.y = yaw;
  scene.add(group);
}

function makeFigure(scene, x, z, shirt, pants, yaw, phase) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc48a62, roughness: 0.72 });
  const cloth = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.46, 0.14),
    new THREE.MeshStandardMaterial({ color: pants, roughness: 0.86 }),
  );
  legs.position.y = 0.28;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.16), cloth);
  torso.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), skin);
  head.position.y = 1.06;
  group.add(legs, torso, head);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  group.position.set(x, 0.18, z);
  group.rotation.y = yaw;
  scene.add(group);
  people.push({ group, phase, base: 0.18 });
}

function makeSignal(scene, world, RAPIER, x, z) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x292524, metalness: 0.3, roughness: 0.5 });
  addMesh(scene, new THREE.CylinderGeometry(0.07, 0.09, 3.6, 6), metal, x, 1.8, z);
  const housing = addMesh(scene, new THREE.BoxGeometry(0.28, 0.9, 0.22), metal, x, 3.15, z);
  housing.castShadow = true;
  const colors = [0xb91c1c, 0xf59e0b, 0x15803d];
  colors.forEach((color, index) => {
    const lamp = addMesh(
      scene,
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: index === 0 ? 0.7 : 0.05 }),
      x,
      3.42 - index * 0.26,
      z + 0.1,
    );
    lamp.castShadow = false;
  });
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 1.8, z));
  world.createCollider(RAPIER.ColliderDesc.cylinder(1.8, 0.09), body);
}

function chaiStall(scene, world, RAPIER) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.8 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xf6e7c1, roughness: 0.7 });
  addMesh(scene, new THREE.BoxGeometry(2.1, 0.9, 0.7), wood, -6, 0.7, 7.15);
  const awningCanvas = document.createElement("canvas");
  awningCanvas.width = 128;
  awningCanvas.height = 32;
  const g = awningCanvas.getContext("2d");
  for (let i = 0; i < 8; i += 1) {
    g.fillStyle = i % 2 ? "#e07a2f" : "#f6e7c1";
    g.fillRect(i * 16, 0, 16, 32);
  }
  const awning = addMesh(
    scene,
    new THREE.BoxGeometry(2.3, 0.06, 1.15),
    new THREE.MeshStandardMaterial({ map: canvasTexture(awningCanvas), roughness: 0.65 }),
    -6,
    1.85,
    6.7,
  );
  awning.rotation.x = 0.18;
  const kettle = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, metalness: 0.65, roughness: 0.28 });
  addMesh(scene, new THREE.SphereGeometry(0.16, 10, 8), kettle, -5.35, 1.28, 6.9);
  addMesh(scene, new THREE.CylinderGeometry(0.04, 0.05, 0.16, 6), kettle, -5.18, 1.32, 6.9);
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.4 });
  for (let i = 0; i < 4; i += 1) {
    addMesh(scene, new THREE.CylinderGeometry(0.045, 0.04, 0.08, 6), cupMat, -6.5 + i * 0.12, 1.22, 6.88);
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
    scene,
    new THREE.PlaneGeometry(1.3, 0.48),
    new THREE.MeshStandardMaterial({ map: canvasTexture(board), roughness: 0.6 }),
    -6,
    2.25,
    6.55,
    Math.PI,
  );
  solid(world, RAPIER, -6, 0.7, 7.15, 1.05, 0.45, 0.35);
}

function skyCanvas(night, rain) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  if (night) {
    grad.addColorStop(0, "#070b14");
    grad.addColorStop(0.55, "#18243c");
    grad.addColorStop(1, "#2a241c");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 256);
    g.fillStyle = "#f8fafc";
    for (let i = 0; i < 28; i += 1) {
      const n = Math.sin(i * 91.7) * 43758.5453;
      const x = (n - Math.floor(n)) * 32;
      const y = ((n * 3) % 1) * 150;
      g.fillRect(x, y, 1, 1);
    }
  } else if (rain) {
    grad.addColorStop(0, "#667481");
    grad.addColorStop(1, "#a3a8ad");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 256);
  } else {
    grad.addColorStop(0, "#6eafE6");
    grad.addColorStop(0.42, "#b9d7f2");
    grad.addColorStop(0.72, "#f2ddc0");
    grad.addColorStop(1, "#e7d2ad");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 256);
  }
  return canvasTexture(canvas);
}

function sidewalk(scene, world, RAPIER, material, x, z, hx) {
  const mesh = addMesh(scene, new THREE.BoxGeometry(hx * 2, 0.18, 4.1), material, x, 0.09, z);
  mesh.castShadow = false;
  solid(world, RAPIER, x, 0.09, z, hx, 0.09, 2.05);
  const curbZ = z > 0 ? z - 2.05 : z + 2.05;
  addMesh(
    scene,
    new THREE.BoxGeometry(hx * 2, 0.2, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xb7b1a8, roughness: 0.9 }),
    x,
    0.1,
    curbZ,
  );
}

export function buildStreet(scene, world, RAPIER) {
  const earth = std(paintEarth());
  const ground = addMesh(scene, new THREE.BoxGeometry(150, 1, 150), earth, 0, -0.5, 0);
  ground.castShadow = false;
  solid(world, RAPIER, 0, -0.5, 0, 75, 0.5, 75);

  const asphalt = std(paintAsphalt(), { roughness: 0.95 });
  const road = addMesh(scene, new THREE.BoxGeometry(78, 0.04, 8), asphalt, -2, 0.02, 0);
  road.castShadow = false;
  const cross = addMesh(scene, new THREE.BoxGeometry(8, 0.045, 44), std(paintCrossRoad(), { roughness: 0.95 }), 18, 0.03, 0);
  cross.castShadow = false;

  const zebraMat = new THREE.MeshBasicMaterial({ map: paintZebra(), transparent: true, depthWrite: false });
  addMesh(scene, new THREE.PlaneGeometry(7.2, 3.2), zebraMat, 18, 0.05, 0).rotation.x = -Math.PI / 2;
  const sideZebra = addMesh(scene, new THREE.PlaneGeometry(3.2, 7.2), zebraMat, 18, 0.05, 8);
  sideZebra.rotation.x = -Math.PI / 2;

  const pavers = std(paintPavers(), { roughness: 0.92 });
  sidewalk(scene, world, RAPIER, pavers, -11.5, -6.2, 24.5);
  sidewalk(scene, world, RAPIER, pavers, 31.5, -6.2, 8.5);
  sidewalk(scene, world, RAPIER, pavers, -11.5, 6.2, 24.5);
  sidewalk(scene, world, RAPIER, pavers, 31.5, 6.2, 8.5);

  const roof = paintFacade({
    wall: "#6d6256",
    trim: "#4a433b",
    glass: "#6d6256",
    frame: "#4a433b",
    floors: 1,
    bays: 1,
    seed: 8,
    h: 128,
  }).map;

  const college = paintFacade({
    wall: "#efe4d0",
    trim: "#c4b49a",
    glass: "#8eb4cc",
    frame: "#f7f3ea",
    floors: 3,
    bays: 7,
    ground: true,
    groundWall: "#e7d7bc",
    kinds: ["shutter", "shutter", "gate", "gate", "shutter", "shutter", "shutter"],
    caption: "COLLEGE STRIP",
    captionBg: "#f3e6c8",
    captionInk: "#3f3428",
    seed: 3,
  });
  const collegeSide = paintFacade({
    wall: "#e6d8c4",
    trim: "#c4b49a",
    glass: "#8eb4cc",
    frame: "#f7f3ea",
    floors: 3,
    bays: 2,
    seed: 5,
  });
  building(scene, world, RAPIER, {
    x: -16,
    z: -12.6,
    w: 30,
    d: 7.2,
    h: 9.2,
    face: "south",
    front: college,
    side: collegeSide,
    roof,
  });

  const northShops = paintFacade({
    wall: "#d9c3a5",
    trim: "#a89074",
    glass: "#9ec4d6",
    frame: "#f5efe4",
    floors: 2,
    bays: 4,
    ground: true,
    groundWall: "#efe6d6",
    kinds: ["shutter", "blue", "shutter", "shutter"],
    seed: 11,
  });
  const shopSide = paintFacade({
    wall: "#d7c2a4",
    trim: "#a89074",
    glass: "#9ec4d6",
    frame: "#f5efe4",
    floors: 2,
    bays: 1,
    seed: 12,
  });
  building(scene, world, RAPIER, {
    x: 6,
    z: -11.4,
    w: 12,
    d: 5.2,
    h: 6.4,
    face: "south",
    front: northShops,
    side: shopSide,
    roof,
  });
  building(scene, world, RAPIER, {
    x: 30,
    z: -12.2,
    w: 12,
    d: 6,
    h: 7.5,
    face: "south",
    front: northShops,
    side: shopSide,
    roof,
  });

  const southFront = paintFacade({
    wall: "#e7d3b4",
    trim: "#b89b78",
    glass: "#b7d0de",
    frame: "#f8f1e4",
    floors: 2,
    bays: 6,
    ground: true,
    groundWall: "#f3ead8",
    kinds: ["shutter", "shutter", "blue", "shutter", "shutter", "books"],
    seed: 15,
  });
  building(scene, world, RAPIER, {
    x: -4,
    z: 12.4,
    w: 32,
    d: 6.4,
    h: 6.8,
    face: "north",
    front: southFront,
    side: shopSide,
    roof,
  });

  const bookSign = document.createElement("canvas");
  bookSign.width = 256;
  bookSign.height = 80;
  const book = bookSign.getContext("2d");
  book.fillStyle = "#1e3a5f";
  book.fillRect(0, 0, 256, 80);
  book.fillStyle = "#f8fafc";
  book.font = "bold 42px sans-serif";
  book.textAlign = "center";
  book.textBaseline = "middle";
  book.fillText("BOOKS", 128, 40);
  addMesh(
    scene,
    new THREE.PlaneGeometry(2.2, 0.62),
    new THREE.MeshStandardMaterial({ map: canvasTexture(bookSign), roughness: 0.55 }),
    9.2,
    3.15,
    9.05,
    Math.PI,
  );
  const bookAwning = addMesh(
    scene,
    new THREE.BoxGeometry(3.2, 0.08, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.7 }),
    9.2,
    2.55,
    8.7,
  );
  bookAwning.rotation.x = -0.15;

  building(scene, world, RAPIER, {
    x: 31,
    z: 12.6,
    w: 12,
    d: 6,
    h: 8,
    face: "north",
    front: northShops,
    side: shopSide,
    roof,
  });

  chaiStall(scene, world, RAPIER);

  for (const [x, z] of [[-28, -7.5], [-8, -7.4], [4, -7.3], [28, -7.4], [-18, 7.5], [2, 7.4], [27, 7.5]]) {
    makeTree(scene, world, RAPIER, x, z);
  }
  for (const [x, z] of [[-24, -4.35], [-10, 4.35], [2, -4.35], [10, 4.35], [26, -4.35], [26, 4.35]]) {
    makeLamp(scene, world, RAPIER, x, z);
  }
  for (const [x, z] of [[-20, 3.55], [-8, -3.55], [1, 3.55], [11, -3.55], [24, 3.55]]) {
    makeBike(scene, x, z, 0);
  }
  makeSignal(scene, world, RAPIER, 13.4, -4.55);
  makeSignal(scene, world, RAPIER, 22.5, 4.55);

  makeFigure(scene, -6.7, 7.55, 0x9a3412, 0x44403c, Math.PI, 0.2);
  makeFigure(scene, -19.2, -5.5, 0xf5f5f4, 0x1e3a5f, 0.4, 1.1);
  makeFigure(scene, -13.4, -5.6, 0xfde68a, 0x44403c, -0.2, 2.2);
  makeFigure(scene, 10.6, 6.5, 0x1e3a5f, 0x292524, Math.PI, 0.6);
  makeFigure(scene, 12.2, 5.5, 0xe7e5e4, 0x7f1d1d, 1.2, 1.7);

  const benchMat = new THREE.MeshStandardMaterial({ color: 0x7c4a32, roughness: 0.8 });
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.42), benchMat);
  seat.position.y = 0.48;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.06), benchMat);
  back.position.set(0, 0.7, -0.16);
  bench.add(seat, back);
  bench.position.set(-2.2, 0.18, 7.2);
  bench.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(bench);

  skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(320, 20, 16),
    new THREE.MeshBasicMaterial({ map: skyCanvas(false, false), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  scene.add(skyMesh);
}

export function setStreetMood(night, rain) {
  if (skyMesh) skyMesh.material.map = skyCanvas(night, rain);
  for (const material of windowMaterials) material.emissiveIntensity = night ? 0.85 : 0;
  for (const lamp of lamps) {
    lamp.light.intensity = night ? 12 : 0;
    lamp.head.material.emissive.set(night ? 0xf6c56a : 0x000000);
    lamp.head.material.emissiveIntensity = night ? 1 : 0;
  }
}

export function tickStreet(time) {
  for (const person of people) {
    person.group.position.y = person.base + Math.sin(time * 0.0015 + person.phase) * 0.025;
  }
}

export function moodColors(night, rain) {
  if (night) return { sky: 0x121826, near: 28, far: 130, sun: 0.08, ambient: 0.22 };
  if (rain) return { sky: 0x7d8b96, near: 20, far: 95, sun: 0.42, ambient: 0.38 };
  return { sky: 0xc5d8ea, near: 40, far: 155, sun: 1.35, ambient: 0.55 };
}
