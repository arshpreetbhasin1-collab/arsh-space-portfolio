import * as THREE from 'three';

export interface CosmicInput {
  dt: number;
  time: number;
  /** Visibility of the deep-space set (galaxy, comet). */
  deep: number;
  /** 0..1 position of the comet along its path through deep space. */
  comet: number;
  /** Visibility of Jupiter's moons. */
  jupiter: number;
  /** Stars and streaks are quieter while text-heavy stops are on screen. */
  calmSky: number;
  reduced: boolean;
  narrow: boolean;
}

const pointsMaterial = (size: number) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 0 }, uSize: { value: size }, uPR: { value: Math.min(window.devicePixelRatio || 1, 2) } },
    vertexShader: /* glsl */ `
      attribute vec3 color; attribute float aAlpha;
      uniform float uSize; uniform float uPR;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = color; vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPR * (400.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = exp(-d * d * 16.0) * vAlpha * uOpacity;
        gl_FragColor = vec4(vColor, a);
      }`,
  });

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(200,230,255,0.75)');
  grad.addColorStop(0.55, 'rgba(120,180,255,0.18)');
  grad.addColorStop(1, 'rgba(120,180,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function buildGalaxy(count: number) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const alpha = new Float32Array(count);
  const arms = 3;
  const core = new THREE.Color(1, 0.86, 0.62);
  const edge = new THREE.Color(0.55, 0.7, 1);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 0.7) * 260;
    const arm = (i % arms) * ((Math.PI * 2) / arms);
    const spin = r * 0.022;
    const scatter = (1 - r / 260) * 0.6 + 0.18;
    const a = arm + spin + (Math.random() - 0.5) * scatter;
    const jitter = () => (Math.random() - 0.5) * (8 + r * 0.12);
    pos.set([Math.cos(a) * r + jitter(), jitter() * 0.35, Math.sin(a) * r + jitter()], i * 3);
    c.copy(core).lerp(edge, Math.min(1, r / 200));
    col.set([c.r, c.g, c.b], i * 3);
    alpha[i] = 0.35 + Math.random() * 0.65;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const p = new THREE.Points(g, pointsMaterial(5.5));
  p.frustumCulled = false;
  return p;
}

function buildCometTail(count: number) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const alpha = new Float32Array(count);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seed[i] = Math.random();
    col.set([0.75 + Math.random() * 0.25, 0.88, 1], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const p = new THREE.Points(g, pointsMaterial(4));
  p.frustumCulled = false;
  return { points: p, seed };
}

type Streak = { line: THREE.Line; life: number; vel: THREE.Vector3 };

export class CosmicLayers {
  readonly group = new THREE.Group();
  private galaxy: THREE.Points;
  private comet = new THREE.Group();
  private cometHead: THREE.Sprite;
  private tail: { points: THREE.Points; seed: Float32Array };
  private streaks: Streak[] = [];
  private nextStreak = 3;
  private moons = new THREE.Group();
  private moonData: { mesh: THREE.Mesh; r: number; speed: number; phase: number }[] = [];
  private camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera, lite: boolean) {
    this.camera = camera;

    this.galaxy = buildGalaxy(lite ? 2200 : 7000);
    this.galaxy.visible = false;

    this.cometHead = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.cometHead.scale.setScalar(44);
    this.tail = buildCometTail(lite ? 260 : 700);
    this.comet.add(this.tail.points, this.cometHead);
    this.comet.visible = false;

    for (let i = 0; i < 3; i++) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(-1, 0, 0)]);
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0.2, 0.3, 0.5]), 3));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      line.frustumCulled = false;
      line.visible = false;
      this.streaks.push({ line, life: 0, vel: new THREE.Vector3() });
      this.group.add(line);
    }

    // Galilean moons: rough real colours, drawn as small lit spheres.
    const moons: [number, number, number, number][] = [
      [0xd9c77a, 8, 150, 0.5],
      [0xe9e4da, 7, 205, 0.36],
      [0x9c8f80, 11, 265, 0.25],
      [0x5e5750, 10, 330, 0.17],
    ];
    moons.forEach(([color, size, r, speed], i) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, transparent: true }));
      this.moons.add(mesh);
      this.moonData.push({ mesh, r, speed, phase: i * 1.7 });
    });
    this.moons.visible = false;

    this.group.add(this.galaxy, this.comet, this.moons);
  }

  update(i: CosmicInput) {
    const calm = i.reduced ? 0 : 1;

    // Galaxy: far out, upper right, turning slowly.
    this.galaxy.visible = i.deep > 0.01;
    if (this.galaxy.visible) {
      this.galaxy.position.set(i.narrow ? 40 : 300, i.narrow ? 220 : 120, -1100);
      this.galaxy.scale.setScalar(i.narrow ? 1.4 : 2);
      this.galaxy.rotation.set(1.05, 0, 0.5);
      this.galaxy.rotateY(i.time * 0.02 * calm);
      (this.galaxy.material as THREE.ShaderMaterial).uniforms.uOpacity.value = i.deep * 1.3;
    }

    // Comet: crosses deep space from upper right to lower left with its tail streaming back.
    const ct = i.comet;
    this.comet.visible = i.deep > 0.01 && ct > 0 && ct < 1;
    if (this.comet.visible) {
      const from = new THREE.Vector3(i.narrow ? 140 : 320, i.narrow ? 220 : 170, -700);
      const to = new THREE.Vector3(i.narrow ? -140 : -320, i.narrow ? -120 : -60, -520);
      const head = from.clone().lerp(to, ct);
      this.cometHead.position.copy(head);
      (this.cometHead.material as THREE.SpriteMaterial).opacity = i.deep;
      const back = from.clone().sub(to).normalize();
      const pos = this.tail.points.geometry.attributes.position as THREE.BufferAttribute;
      const alpha = this.tail.points.geometry.attributes.aAlpha as THREE.BufferAttribute;
      const n = this.tail.seed.length;
      for (let k = 0; k < n; k++) {
        const s = this.tail.seed[k];
        const along = ((s + i.time * 0.08 * calm) % 1) * 230;
        const spread = along * 0.1;
        pos.setXYZ(
          k,
          head.x + back.x * along + Math.sin(s * 91) * spread,
          head.y + back.y * along + Math.cos(s * 57) * spread,
          head.z + back.z * along + Math.sin(s * 33) * spread,
        );
        alpha.setX(k, (1 - along / 230));
      }
      pos.needsUpdate = true;
      alpha.needsUpdate = true;
      (this.tail.points.material as THREE.ShaderMaterial).uniforms.uOpacity.value = i.deep;
    }

    // Shooting stars: an occasional short streak in the dark stretches.
    this.nextStreak -= i.dt;
    if (this.nextStreak <= 0 && calm && i.calmSky > 0.5) {
      this.nextStreak = 4 + Math.random() * 7;
      const s = this.streaks.find((x) => x.life <= 0);
      if (s) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        s.line.position.set((Math.random() - 0.5) * 500, 120 + Math.random() * 140, -520);
        s.vel.set(dir * (380 + Math.random() * 220), -(160 + Math.random() * 120), 0);
        s.life = 1;
        s.line.visible = true;
      }
    }
    for (const s of this.streaks) {
      if (s.life <= 0) continue;
      s.life -= i.dt * 1.4;
      s.line.position.addScaledVector(s.vel, i.dt);
      const len = 90;
      const v = s.vel.clone().normalize().multiplyScalar(-len);
      const attr = s.line.geometry.attributes.position as THREE.BufferAttribute;
      attr.setXYZ(1, v.x, v.y, 0);
      attr.needsUpdate = true;
      (s.line.material as THREE.LineBasicMaterial).opacity = Math.sin(Math.max(0, s.life) * Math.PI) * 0.9;
      if (s.life <= 0) s.line.visible = false;
    }

    // Jupiter's moons: a tilted orbit around the planet's on-screen position.
    this.moons.visible = i.jupiter > 0.01;
    if (this.moons.visible) {
      const v = new THREE.Vector3(i.narrow ? 0 : 0.18, i.narrow ? 0.1 : -0.05, 0.5).unproject(this.camera);
      const dir = v.sub(this.camera.position).normalize();
      const center = this.camera.position.clone().addScaledVector(dir, 480);
      for (const m of this.moonData) {
        const a = m.phase + i.time * m.speed * 0.3 * calm;
        const x = Math.cos(a) * m.r;
        const z = Math.sin(a) * m.r;
        m.mesh.position.set(center.x + x, center.y + z * 0.12 - x * 0.08, center.z + z);
        // Fade on the far side, where the moon would be behind the planet.
        const front = Math.sin(a) > -0.15 || Math.abs(x) > m.r * 0.55 ? 1 : 0.1;
        (m.mesh.material as THREE.MeshStandardMaterial).opacity = i.jupiter * front;
      }
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
  }
}
