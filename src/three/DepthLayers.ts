import * as THREE from 'three';

// Extra real-time depth over the footage:
//  - bokeh dust: large, soft, out-of-focus motes right in front of the lens (strong parallax)
//  - a satellite (ISS-like, built from primitives) crossing the frame while leaving Earth
//  - orbit rings with tiny moons, tilted in perspective around the smaller planets

export interface DepthInput {
  dt: number;
  time: number;
  travel: number;
  /** 0..1 progress of the satellite pass (Earth → low orbit); outside it is hidden. */
  satellite: number;
  /** Ring set for the current planet: screen position (0..1) and visibility. */
  rings: { weight: number; x: number; y: number; tilt: number };
  narrow: boolean;
  reduced: boolean;
}

function panelTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0c1a33';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(140,170,220,0.35)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= 256; x += 16) {
    g.moveTo(x, 0);
    g.lineTo(x, 64);
  }
  for (let y = 0; y <= 64; y += 16) {
    g.moveTo(0, y);
    g.lineTo(256, y);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildSatellite() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9cdd3, metalness: 0.8, roughness: 0.35 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb8893a, metalness: 0.9, roughness: 0.3 });
  const panel = new THREE.MeshStandardMaterial({ map: panelTexture(), metalness: 0.6, roughness: 0.25, emissive: 0x06101f, side: THREE.DoubleSide });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e6, metalness: 0.1, roughness: 0.7 });

  // Main truss.
  const truss = new THREE.Mesh(new THREE.BoxGeometry(46, 1.2, 1.2), metal);
  group.add(truss);
  // Pressurised modules along the centre.
  const modGeo = new THREE.CylinderGeometry(1.6, 1.6, 9, 20);
  modGeo.rotateX(Math.PI / 2);
  for (const z of [-5, 4]) {
    const m = new THREE.Mesh(modGeo, white);
    m.position.set(0, 0, z);
    group.add(m);
  }
  const node = new THREE.Mesh(new THREE.SphereGeometry(2, 20, 14), gold);
  group.add(node);
  // Solar arrays: four wings at each end.
  const arrayGeo = new THREE.PlaneGeometry(4.2, 16);
  for (const x of [-20, -15, 15, 20]) {
    for (const side of [-1, 1]) {
      const a = new THREE.Mesh(arrayGeo, panel);
      a.position.set(x, 0, side * 9.5);
      a.rotation.x = -Math.PI / 2;
      group.add(a);
    }
  }
  // Radiators.
  const rad = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), white);
  rad.position.set(0, -3, 0);
  rad.rotation.x = 0.3;
  group.add(rad);
  return group;
}

export class DepthLayers {
  readonly group = new THREE.Group();
  private dust: THREE.Points;
  private dustMat: THREE.ShaderMaterial;
  private satellite = buildSatellite();
  private rings = new THREE.Group();
  private ringMats: THREE.LineBasicMaterial[] = [];
  private moons: { mesh: THREE.Mesh; r: number; speed: number; phase: number; ring: THREE.Object3D }[] = [];
  private camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera, count: number) {
    this.camera = camera;

    // Bokeh dust.
    const n = count;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() * 2 - 1) * 90, (Math.random() * 2 - 1) * 55, -12 - Math.random() * 110], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uTravel: { value: 0 }, uOpacity: { value: 1 }, uPR: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uTravel; uniform float uPR;
        attribute float aSeed; varying float vA;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.13 + aSeed * 30.0) * 3.0;
          p.y += cos(uTime * 0.11 + aSeed * 20.0) * 2.0;
          p.z = mod(p.z + uTravel * (0.4 + aSeed * 0.6) + 122.0, 110.0) - 122.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float near = smoothstep(-122.0, -95.0, p.z) * smoothstep(-8.0, -30.0, p.z);
          vA = near * (0.35 + aSeed * 0.65);
          gl_PointSize = (30.0 + aSeed * 70.0) * uPR * (22.0 / -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          // Soft disc with a faint brighter rim, like an out-of-focus highlight.
          float a = exp(-d * d * 18.0) * vA * uOpacity;
          gl_FragColor = vec4(0.85, 0.9, 1.0, a * 0.07);
        }`,
    });
    this.dust = new THREE.Points(g, this.dustMat);
    this.dust.frustumCulled = false;

    this.satellite.scale.setScalar(0.9);
    this.satellite.visible = false;

    // Orbit rings: three tilted ellipses, each with a small moon travelling along it.
    const radii = [34, 48, 64];
    radii.forEach((r, i) => {
      const curve = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2);
      const pts = curve.getPoints(160).map((p) => new THREE.Vector3(p.x, p.y, 0));
      const mat = new THREE.LineBasicMaterial({ color: 0xdfe6f2, transparent: true, opacity: 0, depthWrite: false });
      this.ringMats.push(mat);
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
      const holder = new THREE.Group();
      holder.add(ring);
      holder.rotation.z = i * 0.35;
      this.rings.add(holder);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(0.9 + i * 0.3, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd7d3cc, roughness: 0.9, emissive: 0x222222 }));
      holder.add(moon);
      this.moons.push({ mesh: moon, r, speed: 0.12 / (i + 1), phase: i * 2.1, ring: holder });
    });
    this.rings.visible = false;

    this.group.add(this.dust, this.satellite, this.rings);
  }

  update(i: DepthInput) {
    const calm = i.reduced ? 0 : 1;
    this.dustMat.uniforms.uTime.value = i.time * calm;
    this.dustMat.uniforms.uTravel.value = i.travel * 0.02;

    // Satellite crosses from upper right to lower left, tumbling slowly, at mid depth.
    const s = i.satellite;
    const vis = s > 0 && s < 1;
    this.satellite.visible = vis;
    if (vis) {
      const e = s;
      this.satellite.position.set(THREE.MathUtils.lerp(i.narrow ? 70 : 150, i.narrow ? -70 : -150, e), THREE.MathUtils.lerp(42, 6, e), -210);
      this.satellite.rotation.set(0.5 + e * 0.6, e * 2.2 + i.time * 0.03 * calm, 0.25);
    }

    // Rings sit around the planet's screen position, a long way out, tilted like an orrery.
    const w = i.rings.weight;
    this.rings.visible = w > 0.01;
    if (this.rings.visible) {
      const depth = 360;
      const v = new THREE.Vector3(i.rings.x * 2 - 1, -(i.rings.y * 2 - 1), 0.5).unproject(this.camera);
      const dir = v.sub(this.camera.position).normalize();
      this.rings.position.copy(this.camera.position).addScaledVector(dir, depth);
      this.rings.rotation.set(i.rings.tilt, 0.35, 0);
      this.rings.scale.setScalar((i.narrow ? 0.7 : 1) * (0.92 + w * 0.08));
      this.ringMats.forEach((m, k) => (m.opacity = w * (0.2 - k * 0.04)));
      for (const m of this.moons) {
        const a = m.phase + i.time * m.speed * calm;
        m.mesh.position.set(Math.cos(a) * m.r, Math.sin(a) * m.r, 0);
        m.mesh.visible = w > 0.2;
      }
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose();
    });
  }
}
