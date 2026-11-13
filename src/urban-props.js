import * as THREE from "three";
import { segmentDistance } from "./city.js";

// Original illustrative meshes. Existing street-corners.js owns the road
// ribbons, stalls, potholes, scaffolds and NPC cigarettes. This module fills
// two gaps: adult construction workers and a player-controlled smoking prop.
// Its bounded exhaust pool is opt-in to avoid doubling street-corners smoke.
export const MAX_WORKERS = 3;
export const MAX_SMOKE_PARTICLES = 96;

function coordinates(point) {
  if (Array.isArray(point))
    return [Number(point[0]) || 0, Number(point[1]) || 0];
  return [Number(point?.x) || 0, Number(point?.z) || 0];
}

export function urbanRoadSegments(roads = []) {
  const segments = [];
  for (const road of roads) {
    const points = road.a && road.b ? [road.a, road.b] : road.points;
    if (!Array.isArray(points)) continue;
    for (let i = 1; i < points.length; i++) {
      const a = coordinates(points[i - 1]);
      const b = coordinates(points[i]);
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 8) continue;
      segments.push({
        a,
        b,
        length,
        width: Math.max(2.5, Number(road.width) || 7),
        sidewalk: Math.max(0.7, Number(road.sidewalk) || 1.6),
      });
    }
  }
  return segments;
}

export function constructionWorkerPlans(roads, origin, blocked = () => false) {
  const [cx, cz] = coordinates(origin);
  const segments = urbanRoadSegments(roads);
  const nearby = segments
    .filter((r) => segmentDistance(cx, cz, r.a, r.b) <= 110)
    .sort(
      (a, b) =>
        segmentDistance(cx, cz, a.a, a.b) - segmentDistance(cx, cz, b.a, b.b),
    );
  const plans = [];
  for (const r of nearby) {
    const dx = (r.b[0] - r.a[0]) / r.length;
    const dz = (r.b[1] - r.a[1]) / r.length;
    for (const fraction of [0.38, 0.68]) {
      for (const side of [1, -1]) {
        const x =
          r.a[0] +
          dx * r.length * fraction +
          dz * (r.width / 2 + r.sidewalk / 2) * side;
        const z =
          r.a[1] +
          dz * r.length * fraction -
          dx * (r.width / 2 + r.sidewalk / 2) * side;
        if (blocked(x, z, 0.45)) continue;
        if (
          segments.some(
            (other) =>
              segmentDistance(x, z, other.a, other.b) < other.width / 2 + 0.25,
          )
        )
          continue;
        if (plans.some((plan) => Math.hypot(x - plan.x, z - plan.z) < 13))
          continue;
        plans.push({ x, z, yaw: Math.atan2(dx, dz) + (Math.PI / 2) * side });
        if (plans.length === MAX_WORKERS) return plans;
      }
    }
  }
  return plans;
}

function mesh(parent, geometry, material, x, y, z) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function buildWorker(index, materials) {
  const root = new THREE.Group();
  root.name = "adult-construction-worker";
  root.userData.adult = true;
  root.userData.role = "construction";
  const { skin, vest, fabric, helmet, metal } = materials;
  mesh(root, new THREE.CylinderGeometry(0.2, 0.18, 0.56, 8), vest, 0, 1.13, 0);
  mesh(root, new THREE.SphereGeometry(0.18, 10, 8), skin, 0, 1.62, 0);
  mesh(
    root,
    new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    helmet,
    0,
    1.68,
    0,
  );
  mesh(
    root,
    new THREE.CylinderGeometry(0.23, 0.23, 0.04, 10),
    helmet,
    0,
    1.68,
    0,
  );
  for (const side of [-1, 1]) {
    mesh(
      root,
      new THREE.CylinderGeometry(0.075, 0.08, 0.66, 6),
      fabric,
      side * 0.115,
      0.49,
      0,
    );
    mesh(
      root,
      new THREE.BoxGeometry(0.18, 0.13, 0.28),
      fabric,
      side * 0.115,
      0.12,
      -0.045,
    );
    mesh(
      root,
      new THREE.BoxGeometry(0.05, 0.47, 0.02),
      helmet,
      side * 0.12,
      1.13,
      -0.19,
    );
  }
  const arm = new THREE.Group();
  arm.position.set(0.25, 1.38, 0);
  mesh(
    arm,
    new THREE.CylinderGeometry(0.055, 0.06, 0.48, 6),
    skin,
    0,
    -0.24,
    0,
  );
  mesh(
    arm,
    new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6),
    metal,
    0,
    -0.52,
    -0.13,
  );
  mesh(arm, new THREE.BoxGeometry(0.28, 0.18, 0.025), metal, 0, -0.96, -0.13);
  root.add(arm);
  const otherArm = new THREE.Group();
  otherArm.position.set(-0.25, 1.38, 0);
  mesh(
    otherArm,
    new THREE.CylinderGeometry(0.055, 0.06, 0.48, 6),
    skin,
    0,
    -0.24,
    0,
  );
  otherArm.rotation.x = -0.3;
  root.add(otherArm);
  root.userData.tick = (time) => {
    arm.rotation.x = -0.15 - (Math.sin(time * 1.8 + index) + 1) * 0.22;
    root.rotation.z = Math.sin(time * 1.8 + index) * 0.025;
  };
  return root;
}

export function mayUseSmokingProp(target) {
  const data = target?.userData;
  const age = data?.age ?? data?.role?.age;
  return Boolean(
    target &&
    !data?.child &&
    data?.role?.kind !== "child" &&
    !(Number.isFinite(age) && age < 18),
  );
}

function makePlayerCigarette(materials) {
  const root = new THREE.Group();
  root.name = "player-cigarette";
  root.position.set(0.1, 1.48, -0.21);
  const stick = mesh(
    root,
    new THREE.CylinderGeometry(0.006, 0.006, 0.075, 6),
    materials.paper,
    0,
    0,
    0,
  );
  stick.rotation.x = Math.PI / 2;
  mesh(
    root,
    new THREE.SphereGeometry(0.007, 6, 4),
    materials.ember,
    0,
    0,
    -0.04,
  );
  return root;
}

export function exhaustInterval(speed) {
  if (!Number.isFinite(speed) || Math.abs(speed) < 0.8) return Infinity;
  return Math.max(0.22, 0.5 - Math.abs(speed) * 0.015);
}

export function createUrbanProps(scene, options = {}) {
  if (!scene?.add)
    throw new TypeError("createUrbanProps requires a Three.js scene");
  const {
    roads = [],
    spawn = [0, 0],
    blocked = () => false,
    player = null,
    exhaust = false,
  } = options;
  const root = new THREE.Group();
  root.name = "urban-props";
  scene.add(root);
  const material = (color, extras = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extras });
  const materials = {
    skin: material(0xb98458),
    vest: material(0xe17b22),
    fabric: material(0x364347),
    helmet: material(0xf2d55b),
    metal: material(0x7f8584, { metalness: 0.5, roughness: 0.5 }),
    paper: material(0xe7e0d0),
    ember: material(0xac4325, { emissive: 0x85290c }),
  };
  const workers = [];
  let center = coordinates(spawn);
  let disposed = false;
  let smokingTarget = null;
  let cigarette = null;
  let smokeWait = 0;
  const sources = new WeakMap();
  const positions = new Float32Array(MAX_SMOKE_PARTICLES * 3);
  const opacities = new Float32Array(MAX_SMOKE_PARTICLES);
  const sizes = new Float32Array(MAX_SMOKE_PARTICLES);
  const particles = Array.from({ length: MAX_SMOKE_PARTICLES }, () => ({
    life: 0,
    maxLife: 1,
    vx: 0,
    vz: 0,
  }));
  let cursor = 0;
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  smokeGeo.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1));
  smokeGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  const smokeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { color: { value: new THREE.Color(0xb6b6af) } },
    vertexShader:
      "attribute float aOpacity; attribute float aSize; varying float alpha; void main(){ alpha=aOpacity; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(aSize*180.0/max(1.0,-mv.z),1.0,28.0); }",
    fragmentShader:
      "uniform vec3 color; varying float alpha; void main(){ float d=length(gl_PointCoord-vec2(.5)); gl_FragColor=vec4(color,alpha*(1.0-smoothstep(.12,.5,d))); }",
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.name = "bounded-urban-smoke";
  smoke.frustumCulled = false;
  root.add(smoke);

  function clearWorkers() {
    for (const worker of workers) {
      worker.userData.disposed = true;
      root.remove(worker);
      if (options.disposeWorker) options.disposeWorker(worker);
      else worker.traverse((object) => object.geometry?.dispose());
    }
    workers.length = 0;
  }

  function placeWorkers(position) {
    clearWorkers();
    const plans =
      options.constructionPlans ||
      constructionWorkerPlans(roads, position, blocked);
    for (const plan of plans.slice(0, MAX_WORKERS)) {
      if (blocked(plan.x, plan.z, 0.4)) continue;
      const worker = buildWorker(workers.length, materials);
      worker.position.set(plan.x, 0, plan.z);
      worker.rotation.y = plan.yaw || 0;
      workers.push(worker);
      root.add(worker);
    }
    options.hydrateWorkers?.(workers);
  }
  placeWorkers(center);

  function emit(x, y, z, strength = 0.14) {
    const index = cursor++ % MAX_SMOKE_PARTICLES;
    const phase = index * 2.4;
    positions.set([x, y, z], index * 3);
    particles[index] = {
      life: 1.35,
      maxLife: 1.35,
      vx: Math.sin(phase) * 0.12,
      vz: Math.cos(phase) * 0.08,
      strength,
    };
    sizes[index] = 0.1;
    opacities[index] = strength;
  }

  const samplePosition = new THREE.Vector3();
  function setSmoking(enabled, target = player) {
    if (cigarette) {
      cigarette.removeFromParent();
      cigarette.traverse((object) => object.geometry?.dispose());
      cigarette = null;
    }
    smokingTarget = null;
    smokeWait = 0;
    if (disposed || !enabled || !mayUseSmokingProp(target)) return false;
    cigarette = makePlayerCigarette(materials);
    target.add(cigarette);
    smokingTarget = target;
    return true;
  }

  function update(dt, time, playerPosition, traffic = []) {
    if (disposed) return;
    const step = Math.max(0, Math.min(Number(dt) || 0, 0.1));
    const elapsed = Number(time) || 0;
    const [px, pz] = coordinates(playerPosition || center);
    if (
      !options.constructionPlans &&
      Math.hypot(px - center[0], pz - center[1]) > 180
    ) {
      center = [px, pz];
      placeWorkers(center);
    }
    for (const worker of workers) {
      if (worker.userData.mixer) worker.userData.walk?.(step, 0);
      else worker.userData.tick(elapsed);
    }
    if (smokingTarget?.visible && cigarette) {
      smokeWait -= step;
      if (smokeWait <= 0) {
        cigarette.getWorldPosition(samplePosition);
        emit(samplePosition.x, samplePosition.y, samplePosition.z, 0.19);
        smokeWait = 0.24;
      }
    }
    if (exhaust && step > 0) {
      let emitted = 0;
      for (const entry of traffic) {
        const vehicle = entry?.mesh || entry;
        if (!vehicle?.position || vehicle.visible === false) continue;
        const prior = sources.get(vehicle);
        const now = vehicle.position;
        if (prior) {
          const distance = Math.hypot(now.x - prior.x, now.z - prior.z);
          const speed = distance / step;
          const nearby = Math.hypot(now.x - px, now.z - pz) < 100;
          if (
            nearby &&
            distance < 15 &&
            elapsed >= prior.next &&
            Number.isFinite(exhaustInterval(speed)) &&
            emitted < 8
          ) {
            vehicle.localToWorld(samplePosition.set(0, 0.38, 1.45));
            emit(samplePosition.x, samplePosition.y, samplePosition.z, 0.12);
            prior.next = elapsed + exhaustInterval(speed);
            emitted++;
          }
        }
        sources.set(vehicle, { x: now.x, z: now.z, next: prior?.next || 0 });
      }
    }
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      particle.life = Math.max(0, particle.life - step);
      if (particle.life <= 0) {
        opacities[i] = 0;
        continue;
      }
      positions[i * 3] += particle.vx * step;
      positions[i * 3 + 1] += 0.48 * step;
      positions[i * 3 + 2] += particle.vz * step;
      const t = 1 - particle.life / particle.maxLife;
      sizes[i] = 0.1 + t * 0.42;
      opacities[i] = particle.strength * (1 - t);
    }
    smokeGeo.attributes.position.needsUpdate = true;
    smokeGeo.attributes.aOpacity.needsUpdate = true;
    smokeGeo.attributes.aSize.needsUpdate = true;
  }

  function dispose() {
    if (disposed) return;
    setSmoking(false);
    disposed = true;
    clearWorkers();
    smokeGeo.dispose();
    smokeMat.dispose();
    for (const value of Object.values(materials)) value.dispose();
    root.removeFromParent();
  }

  return {
    group: root,
    update,
    setSmoking,
    dispose,
    get diagnostics() {
      return {
        workers: workers.length,
        detailedWorkers: workers.filter(
          (w) => w.userData.cast === "construction-worker",
        ).length,
        smoking: Boolean(smokingTarget),
        activeParticles: particles.filter((particle) => particle.life > 0)
          .length,
        particleLimit: MAX_SMOKE_PARTICLES,
        exhaustEnabled: exhaust,
        disposed,
      };
    },
  };
}
