import * as THREE from 'three';
import type { CameraState } from '../lib/cameraController';
import type { QualityTier } from '../lib/performance';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Spaceship, type ShipInput } from './Spaceship';
import { DepthLayers, type DepthInput } from './DepthLayers';
import { SunCorona } from './SunCorona';
import { CosmicLayers, type CosmicInput } from './CosmicLayers';

// Lightweight real-time layer drawn over the cinematic plates: a wrapping starfield with
// speed streaks, plus four small particle systems that only exist near their scenes
// (atmosphere motes, Saturn ring debris, solar embers) and the ship.

const DEPTH = 2400;
const SPREAD = 1400;

const wrapVertex = /* glsl */ `
  uniform float uTravel;
  uniform float uDepth;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uTime;
  attribute float aSeed;
  varying float vAlpha;
  varying vec3 vColor;
  attribute vec3 color;
  void main() {
    vec3 p = position;
    p.z = mod(p.z - uTravel, uDepth) - uDepth;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depthFade = smoothstep(-uDepth, -uDepth * 0.7, p.z) * smoothstep(0.0, -40.0, p.z);
    float twinkle = 0.75 + 0.25 * sin(uTime * (0.6 + aSeed * 2.0) + aSeed * 40.0);
    vAlpha = depthFade * twinkle;
    vColor = color;
    gl_PointSize = uSize * uPixelRatio * (300.0 / -mv.z) * (0.6 + aSeed * 0.8);
  }
`;

const pointFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
  }
`;

const streakVertex = /* glsl */ `
  uniform float uTravel;
  uniform float uDepth;
  uniform float uStreak;
  attribute float aTail;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.z = mod(p.z - uTravel, uDepth) - uDepth;
    p.z += aTail * uStreak;
    vAlpha = (1.0 - aTail) * smoothstep(-uDepth, -uDepth * 0.6, p.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const streakFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(0.85, 0.9, 1.0, vAlpha * uOpacity); }
`;

function starColors(n: number, rng: () => number) {
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rng();
    // Mostly white, some warm and some blue-white, like a real sky.
    const col = r < 0.12 ? [1, 0.82, 0.62] : r < 0.3 ? [0.72, 0.82, 1] : [1, 1, 1];
    c.set(col, i * 3);
  }
  return c;
}

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePoints(n: number, rng: () => number, opts: { spread: number; ySpread?: number; yOffset?: number; size: number; color?: [number, number, number]; blending?: THREE.Blending }) {
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // Keep a clear tunnel around the camera so stars pass by instead of through the lens.
    let x = 0, y = 0;
    do {
      x = (rng() * 2 - 1) * opts.spread;
      y = (rng() * 2 - 1) * (opts.ySpread ?? opts.spread) + (opts.yOffset ?? 0);
    } while (Math.hypot(x, y) < opts.spread * 0.04);
    pos.set([x, y, -rng() * DEPTH], i * 3);
    seed[i] = rng();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const colors = opts.color ? new Float32Array(n * 3).map((_, i) => opts.color![i % 3] * (0.75 + 0.25 * rng())) : starColors(n, rng);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const m = new THREE.ShaderMaterial({
    vertexShader: wrapVertex,
    fragmentShader: pointFragment,
    transparent: true,
    depthWrite: false,
    blending: opts.blending ?? THREE.AdditiveBlending,
    uniforms: {
      uTravel: { value: 0 },
      uDepth: { value: DEPTH },
      uSize: { value: opts.size },
      uPixelRatio: { value: 1 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

export class SpaceCanvas {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private far: THREE.Points;
  private near: THREE.Points;
  private mid: THREE.Points;
  private nebula: THREE.Group;
  private nebulaData: { sp: THREE.Sprite; z: number }[] = [];
  private streaks: THREE.LineSegments;
  private atmosphere: THREE.Points;
  private rings: THREE.Points;
  private embers: THREE.Points;
  private light: THREE.DirectionalLight;
  private rim: THREE.DirectionalLight;
  readonly ship: Spaceship | null;
  private depth: DepthLayers | null;
  private corona = new SunCorona();
  private cosmic: CosmicLayers;
  private narrow = false;
  private time = 0;
  private lastTravel = 0;
  private velocity = 0;
  private disposed = false;

  /** `lite` is the phone build: stars, streaks, particles and the Sun corona only. */
  constructor(canvas: HTMLCanvasElement, tier: QualityTier, lite = false) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: tier === 'high' && !lite, powerPreference: lite ? 'default' : 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    const dpr = lite ? 1 : Math.min(window.devicePixelRatio || 1, tier === 'high' ? 1.5 : tier === 'medium' ? 1.25 : 1);
    this.renderer.setPixelRatio(dpr);
    this.camera = new THREE.PerspectiveCamera(60, 1, 1, DEPTH + 200);

    const rng = mulberry(7);
    const count = lite ? 0.22 : tier === 'high' ? 1 : tier === 'medium' ? 0.6 : 0.3;

    this.far = makePoints(Math.round(14000 * count), rng, { spread: SPREAD, size: 1.5 });
    this.mid = makePoints(Math.round(4500 * count), rng, { spread: SPREAD * 0.7, size: 2 });
    this.near = makePoints(Math.round(2000 * count), rng, { spread: SPREAD * 0.45, size: 2.6 });

    // Nebula glows: a handful of huge, faint, coloured clouds far out, so black space has depth.
    this.nebula = new THREE.Group();
    const cloudTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255,255,255,0.55)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.18)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    })();
    const hues = [0x3b5bdb, 0x7048e8, 0x1c7ed6, 0xc2255c, 0x0ca678, 0x5f3dc4];
    for (let i = 0; i < (lite ? 0 : 14); i++) {
      const m = new THREE.SpriteMaterial({ map: cloudTex, color: hues[i % hues.length], transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false });
      const sp = new THREE.Sprite(m);
      sp.position.set((rng() * 2 - 1) * 1500, (rng() * 2 - 1) * 800, -rng() * DEPTH);
      sp.scale.setScalar(600 + rng() * 900);
      this.nebula.add(sp);
      this.nebulaData.push({ sp, z: sp.position.z });
    }

    // Streaks: one short line per near star, visible only at speed.
    const nearPos = this.near.geometry.attributes.position.array as Float32Array;
    const n = Math.round(nearPos.length / 3);
    const sp = new Float32Array(n * 6);
    const tail = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      sp.set([nearPos[i * 3], nearPos[i * 3 + 1], nearPos[i * 3 + 2]], i * 6);
      sp.set([nearPos[i * 3], nearPos[i * 3 + 1], nearPos[i * 3 + 2]], i * 6 + 3);
      tail[i * 2] = 0;
      tail[i * 2 + 1] = 1;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('aTail', new THREE.BufferAttribute(tail, 1));
    this.streaks = new THREE.LineSegments(
      sg,
      new THREE.ShaderMaterial({
        vertexShader: streakVertex,
        fragmentShader: streakFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTravel: { value: 0 }, uDepth: { value: DEPTH }, uStreak: { value: 0 }, uOpacity: { value: 0 } },
      }),
    );
    this.streaks.frustumCulled = false;

    this.atmosphere = makePoints(Math.round(1600 * count), rng, { spread: 500, size: 5, color: [0.62, 0.8, 1] });
    this.rings = makePoints(Math.round(5000 * count), rng, { spread: 1200, ySpread: 18, yOffset: -70, size: 2.4, color: [0.95, 0.9, 0.8] });
    this.embers = makePoints(Math.round(1400 * count), rng, { spread: 700, size: 4.2, color: [1, 0.55, 0.18] });

    this.light = new THREE.DirectionalLight(0xffe2c4, 2.6);
    this.light.position.set(-1, 0.4, 0.3);
    this.rim = new THREE.DirectionalLight(0x9cc4ff, 1.4);
    this.rim.position.set(0.6, 0.8, -1);
    this.scene.add(this.light, this.rim, new THREE.AmbientLight(0x3a2a22, 0.5));

    if (lite) {
      this.ship = null;
      this.depth = null;
    } else {
      // Soft studio reflections so the hull reads as metal rather than flat grey.
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.55;
      pmrem.dispose();
      this.ship = new Spaceship();
      this.scene.add(this.ship.group, this.ship.pad);
      this.depth = new DepthLayers(this.camera, tier === 'high' ? 110 : tier === 'medium' ? 70 : 40);
      this.scene.add(this.depth.group);
    }
    this.scene.add(this.corona.mesh);
    this.cosmic = new CosmicLayers(this.camera, lite);
    this.scene.add(this.cosmic.group);

    this.scene.add(this.nebula, this.far, this.mid, this.near, this.streaks, this.atmosphere, this.rings, this.embers);
    for (const p of [this.far, this.mid, this.near, this.atmosphere, this.rings, this.embers]) {
      (p.material as THREE.ShaderMaterial).uniforms.uPixelRatio.value = dpr;
    }
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < 700 ? 72 : 60;
    this.narrow = w < 760;
    this.camera.updateProjectionMatrix();
  }

  render(
    cam: CameraState,
    env: { stars: number; particles: Record<string, number>; tint: [number, number, number] },
    dt: number,
    reduced: boolean,
    ship: Pick<ShipInput, 'launch' | 'hold' | 'land' | 'pointerX' | 'pointerY'>,
    depth: Pick<DepthInput, 'satellite' | 'rings'>,
    sun: number,
    cosmic: Pick<CosmicInput, 'deep' | 'comet' | 'jupiter' | 'calmSky'>,
  ) {
    if (this.disposed) return;
    this.time += dt;
    const travel = -cam.z;
    const raw = dt > 0 ? (travel - this.lastTravel) / dt : 0;
    this.lastTravel = travel;
    this.velocity += (Math.min(Math.abs(raw), 4000) - this.velocity) * Math.min(1, dt * 6);
    // Always drift a little so space never feels frozen.
    const idle = reduced ? 0 : this.time * 6;
    const t = travel + idle;

    this.camera.position.set(cam.x, cam.y, 0);
    this.camera.rotation.set(-cam.y * 0.0006, cam.x * 0.0008, cam.roll);

    const set = (p: THREE.Points | THREE.LineSegments, travelMul: number, opacity: number) => {
      const u = (p.material as THREE.ShaderMaterial).uniforms;
      u.uTravel.value = t * travelMul;
      if (u.uTime) u.uTime.value = this.time;
      u.uOpacity.value = opacity;
      p.visible = opacity > 0.003;
    };

    set(this.far, 0.35, 0.45 + env.stars * 0.55);
    set(this.mid, 0.65, 0.3 + env.stars * 0.7);
    for (const n of this.nebulaData) {
      n.sp.position.z = ((n.z + t * 0.2) % DEPTH) - DEPTH * 0.02;
      if (n.sp.position.z > -150) n.sp.position.z -= DEPTH;
    }
    set(this.near, 1, env.stars);
    const streak = reduced ? 0 : Math.min(1, this.velocity / 1800);
    (this.streaks.material as THREE.ShaderMaterial).uniforms.uStreak.value = streak * 120;
    set(this.streaks, 1, streak * 0.55 * env.stars);

    const pa = env.particles;
    set(this.atmosphere, 2.2, pa.atmosphere * 0.9);
    set(this.rings, 1.3, pa.rings * 0.9);
    set(this.embers, 1.6, pa.embers);

    // Key light takes the colour of wherever we are (warm near the Sun, cold far out).
    const [r, g, b] = env.tint;
    this.light.color.setRGB(0.75 + r * 1.5, 0.72 + g * 1.2, 0.68 + b);
    this.ship?.update({ ...ship, dt, time: this.time, speed: Math.min(1, this.velocity / 2200), narrow: this.narrow, reduced });
    this.depth?.update({ ...depth, dt, time: this.time, travel: t, narrow: this.narrow, reduced });
    this.corona.update(reduced ? 0 : this.time, sun, this.camera.aspect, this.narrow);
    this.cosmic.update({ ...cosmic, dt, time: this.time, reduced, narrow: this.narrow });

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.ship?.dispose();
    this.depth?.dispose();
    this.corona.dispose();
    this.cosmic.dispose();
    this.scene.environment?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}
